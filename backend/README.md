# Finami — Backend

API REST de gestão financeira familiar: usuários (com ou sem login), grupos familiares, carteiras em
Real e Bitcoin, transferências com compra/venda automática de bitcoin na cotação atual, histórico
imutável em partidas dobradas e extratos por período.

Especificação: [`specs/001-finami-backend-core`](../specs/001-finami-backend-core/spec.md) ·
Contrato da API: [`contracts/api.md`](../specs/001-finami-backend-core/contracts/api.md)

## Stack

| Tecnologia | Versão | Uso |
|---|---|---|
| .NET / ASP.NET Core | 8.0 | Web API com controllers |
| Entity Framework Core + Npgsql | 9.x | ORM e migrations (PostgreSQL) |
| Swashbuckle | 8.x | Swagger (apenas em Development) |
| JWT Bearer | 8.x | Autenticação por token |
| Google.Apis.Auth | 1.69 | Validação do ID token do Google |
| FluentValidation | 11.x | Validação de entrada |
| xUnit + Moq + FluentAssertions | — | Testes |

## Estrutura (Clean Architecture)

```text
backend/
├── Finami.DTO               # contratos da API e classes de configuração (sem dependências)
├── Finami.Infra.Interfaces  # interfaces genéricas de repositórios e AppServices
├── Finami.Domain            # modelos, enums, regras de negócio, validadores, serviços
├── Finami.Infra             # DbContext, migrations, repositórios, AppServices (cotação, Google)
├── Finami.Application       # composição/DI (Startup.cs), JWT
├── Finami.API               # controllers, Program.cs, appsettings, Finami.API.http
└── Finami.Tests             # testes unitários e de integração
```

## Conceitos principais

- **Carteira = conta**. Cada transação tem uma conta de saída e uma de entrada e gera lançamentos
  (`ledger_entries`) com valor assinado. O saldo é sempre a soma dos lançamentos.
- **Contas de sistema** (semeadas): origem externa, destino externo e câmbio, para BRL e BTC.
  Entradas/saídas de fora do sistema usam as contas externas; compras e vendas de BTC passam pelas
  contas de câmbio, de modo que cada moeda sempre fecha em zero.
- **Conversão**: BRL→BTC é compra, BTC→BRL é venda, na cotação atual (CoinGecko, com fallback para
  o Mercado Bitcoin). O valor convertido é truncado (BRL 2 casas, BTC 8 casas). Cotação com mais de
  5 minutos não é aceita para conversão.
- **Imutabilidade**: transações nunca são alteradas; correções são feitas por estorno.
- **Concorrência**: cada transação bloqueia as carteiras envolvidas (`SELECT … FOR UPDATE`) antes de
  conferir o saldo, então o saldo nunca fica negativo.
- **Grupos**: o responsável inclui/retira membros, controla as carteiras vinculadas ao grupo e
  define a visibilidade do extrato (`ResponsibleOnly`, `AllMembers`, `MembersSummary`).
- **Adicionar membro e convites** (feature 003, contrato em
  `specs/003-family-member-invites/contracts/api.md`):
  - `POST /api/groups/{groupId}/member-lookup` verifica o email (normalizado) e devolve `Available`,
    `Registered`, `AlreadyMember` ou `PendingInvite`.
  - `POST /api/groups/{groupId}/members/new` cadastra a pessoa (com ou sem email) e a inclui na
    família na mesma transação; email já cadastrado → 409.
  - `POST /api/groups/{groupId}/members` só inclui direto quem foi cadastrado pelo responsável;
    qualquer outra pessoa precisa de convite (422).
  - Convites: `POST`/`GET /api/groups/{groupId}/invitations`, `DELETE …/invitations/{invitationId}`,
    `POST /api/invitations/{invitationId}/accept` e `/decline`. No máximo um convite pendente por
    pessoa e família (índice único parcial `ix_group_invitations_pending`). Aceitar/recusar/cancelar
    bloqueiam a linha do convite (`SELECT … FOR UPDATE`); se a família não existe mais ou quem
    convidou deixou de ser o responsável, o convite vira `Canceled` e a resposta é 409.
  - Notificações: `GET /api/notifications?beforeId=&limit=` (cursor, 1–50, padrão 20),
    `GET /api/notifications/unread-count` e `POST /api/notifications/read` (204). A notificação de
    convite traz o estado **atual** do convite (join), não uma cópia.
- **Saldos por membro** (somente leitura):
  - `GET /api/groups/{groupId}/balances` — totais por membro das carteiras ativas do grupo. O nível
    de detalhe (`detailLevel`) segue a visibilidade do extrato: o responsável e os membros em
    `AllMembers` veem `Full` (totais + carteiras), `MembersSummary` vê `Summary` (só totais) e
    `ResponsibleOnly` vê `Hidden` (só a lista de membros, valores `null`). Não membro → 404.
  - `GET /api/users/{userId}/group-balances` — carteiras do usuário em cada família visível para
    quem pergunta; o próprio vê todos os grupos; sem grupo visível → 404.
  - O BTC é estimado em BRL (truncado em 2 casas) com a cotação atual ou a última conhecida, mesmo
    desatualizada (`quote.isStale`); sem cotação, o BTC fica fora dos totais (`btcExcluded`).
  - Contrato: `specs/002-finami-frontend-mobile/contracts/api-additions.md`.
- **Valores como string**: os campos numéricos das requisições (ex.: `amount` em
  `/api/transactions/*`) aceitam número ou string JSON (`"amount": "0.00000001"`), via
  `JsonNumberHandling.AllowReadingFromString` em `Finami.API/Extensions/JsonOptionsExtensions.cs`.
  As respostas continuam com números e as validações (casas decimais, valor > 0) não mudam.

## Servidor MCP (feature 004)

A API publica um servidor [MCP](https://modelcontextprotocol.io) para assistentes de IA (Claude,
Claude Code, ChatGPT, MCP Inspector…) consultarem e lançarem dados **em nome da pessoa**, com as
mesmas regras e mensagens do app. Contratos: `specs/004-mcp-oauth-server/contracts/`.

- **Endereço**: `{Mcp__PublicUrl}/mcp` (dev: `http://localhost:5145/mcp`; prod: `https://<domínio>/mcp`).
  Transporte Streamable HTTP, sem sessão (SDK `ModelContextProtocol.AspNetCore`).
- **Autorização**: OAuth 2.1 com PKCE (S256) e registro dinâmico de cliente. O assistente descobre
  tudo sozinho a partir do `401` em `/mcp` (`WWW-Authenticate: Bearer resource_metadata=…`):
  `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`,
  `POST /oauth/register`, `GET /oauth/authorize` (leva à tela `/autorizar` do app), `POST /oauth/token`
  e `POST /oauth/revoke`. Tokens opacos (`fma_…` acesso, 60 min; `fmr_…` renovação com rotação,
  30 dias) guardados só como SHA-256; o token do MCP não vale em `/api/*` e o JWT do app não vale em `/mcp`.
- **Escopos**: `finami:read` (consultas) e `finami:write` (alterações; inclui leitura). Ferramenta de
  escrita numa conexão só leitura devolve `permissao_insuficiente` sem executar nada.
- **Conexões**: a pessoa vê e desconecta assistentes em **Conta → Assistentes conectados**
  (`GET/DELETE /api/oauth/connections`, `GET /api/oauth/mcp-info`); desconectar revoga os tokens na hora.

### Como conectar

- **Claude (claude.ai / app)**: Configurações → Conectores → *Adicionar conector personalizado* →
  URL `https://<domínio>/mcp` → *Conectar* → entrar no Finami e autorizar.
- **Claude Code**: `claude mcp add --transport http finami https://<domínio>/mcp` e depois `/mcp`
  dentro do Claude Code para autenticar no navegador.
- **MCP Inspector** (dev): `npx @modelcontextprotocol/inspector` → Streamable HTTP →
  `http://localhost:5145/mcp` → *Quick OAuth Flow*.

### Ferramentas (38), recursos e prompts

| Área | Leitura (`finami:read`) | Escrita (`finami:write`) |
|---|---|---|
| Perfil | `obter_perfil` | `atualizar_perfil` |
| Saldos | `saldo_total`, `saldos_da_familia`, `saldos_da_pessoa`, `cotacao_bitcoin` | — |
| Carteiras | `listar_carteiras`, `obter_carteira` | `criar_carteira`⟲, `atualizar_carteira`, `mover_carteira_de_familia`, `desativar_carteira`, `excluir_carteira` |
| Extratos e lançamentos | `extrato_carteira`, `extrato_pessoa`, `extrato_familia`, `obter_lancamento`, `previa_transferencia` | `registrar_receita`⟲, `registrar_despesa`⟲, `registrar_transferencia`⟲, `estornar_lancamento` |
| Famílias | `listar_familias`, `obter_familia`, `listar_pessoas_criadas_por_mim`, `verificar_email_para_familia`, `listar_convites_da_familia` | `criar_familia`⟲, `renomear_familia`, `criar_pessoa_na_familia`⟲, `retirar_membro`, `convidar_para_familia`⟲, `cancelar_convite`, `aceitar_convite`, `recusar_convite` |
| Notificações | `listar_notificacoes`, `contar_notificacoes_nao_lidas` | `marcar_notificacoes_como_lidas` |

- Valores em número decimal na moeda da carteira (BRL até 2 casas, BTC até 8); datas `AAAA-MM-DD` no
  fuso America/Sao_Paulo. Extratos e notificações são paginados (`limite` 1–50, padrão 20, e
  `cursor` = `proximoCursor` da página anterior).
- ⟲ = aceita `chave_repeticao` (até 64 caracteres, válida por 24 h): repetir a chamada com a mesma
  chave devolve o mesmo resultado sem lançar de novo.
- Resultado: `structuredContent` com o DTO da API (camelCase) + resumo em português. Erro:
  `isError: true` com `{ codigo, mensagem, erros }` — `validacao`, `nao_encontrado`, `sem_permissao`,
  `conflito`, `regra_de_negocio`, `cotacao_indisponivel`, `permissao_insuficiente`, `erro_interno`.
- Recursos: `finami://perfil`, `finami://carteiras`, `finami://familias`,
  `finami://notificacoes/nao-lidas`. Prompts: `resumo_do_mes`, `registrar_gasto`, `revisar_convites`.
- Fora do MCP (FR-020): senha, cadastro, login, exclusão de conta e gestão de conexões.

### Proteções

- **Limite de taxa** (RateLimiter nativo, janela fixa, `429` + `Retry-After`): 60 chamadas/min por
  conexão em `/mcp`, 10 registros/h por IP em `/oauth/register`, 30/min por IP em `/oauth/token`
  (`Mcp__RateLimitPerMinute`, `Mcp__RegisterRateLimitPerHour`, `Mcp__TokenRateLimitPerMinute`; `0` desliga).
- **Auditoria**: cada ferramenta de escrita grava em `mcp_audit_logs` pessoa, conexão, ferramenta,
  resultado e id afetado — nunca argumentos nem tokens.
- **Limpeza horária** (`OAuthCleanupService`): pedidos vencidos, tokens de acesso vencidos há 1 dia,
  tokens de renovação vencidos/revogados há 30 dias, chaves de repetição com mais de 24 h, clientes
  dinâmicos sem uso há 30 dias e auditoria com mais de 1 ano.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | Sim | `Development`, `Docker` ou `Production` |
| `ConnectionStrings__FinamiContext` | Sim | Connection string do PostgreSQL |
| `Jwt__Secret` | Sim | Chave HMAC do JWT, com pelo menos 32 bytes (a API não sobe sem ela) |
| `Jwt__Issuer` / `Jwt__Audience` | Não | Padrão `finami` |
| `Jwt__ExpirationMinutes` | Não | Validade do token; padrão 480 |
| `Google__ClientId` | Para login Google | OAuth Client ID (tipo Web) |
| `BtcQuote__PrimaryUrl` / `BtcQuote__FallbackUrl` | Não | Fontes de cotação |
| `BtcQuote__CacheSeconds` / `BtcQuote__StaleAfterSeconds` | Não | Padrão 60 / 300 |
| `Cors__AllowedOrigins__0` … | Fora de Development | Origens permitidas (em Development qualquer origem) |
| `Database__MigrateOnStartup` | Não | `true` aplica as migrations pendentes ao iniciar; padrão `false` |
| `Mcp__PublicUrl` | Para o MCP | URL pública da API (issuer OAuth; recurso = `{url}/mcp`). `https`, ou `http` só em localhost |
| `App__PublicUrl` | Para o MCP | URL pública do frontend (tela `/autorizar`) |
| `Mcp__AccessTokenMinutes` / `Mcp__RefreshTokenDays` / `Mcp__CodeMinutes` | Não | Padrão 60 / 30 / 10 |
| `Mcp__RateLimitPerMinute` / `Mcp__RegisterRateLimitPerHour` / `Mcp__TokenRateLimitPerMinute` | Não | Padrão 60 / 10 / 30 (`0` desliga) |
| `Mcp__CleanupEnabled` | Não | Limpeza horária do OAuth/MCP; padrão `true` |

As variáveis seguem a convenção padrão do ASP.NET Core (`Secao__Chave`); não há prefixo.

## Ambientes

| | dev | homolog | prod |
|---|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Development` | `Docker` | `Production` |
| Onde roda | `dotnet run` na máquina | docker-compose local | docker-compose no servidor (só a API, banco externo), atrás do proxy HTTPS do servidor |
| Arquivo de configuração | `appsettings.Development.json` (valores preenchidos) | `appsettings.Docker.json` (sem segredos) | `appsettings.Production.json` (sem segredos) |
| Segredos vêm de | o próprio JSON (valores só-dev) | `.env` → variáveis do compose | `.env.prod` → variáveis do compose |
| `Database:MigrateOnStartup` | `false` (use `dotnet ef database update`) | `true` | `true` |
| CORS | qualquer origem | `http://localhost:8080` (frontend do compose) | nenhuma (mesma origem via proxy do servidor); sobrescreva com `Cors__AllowedOrigins__0` se preciso |
| Swagger | sim | não | não |
| Logging padrão | `Debug` | `Information` | `Warning` |

Variáveis injetadas pelo compose em homolog/prod: `ConnectionStrings__FinamiContext`, `Jwt__Secret`,
`Jwt__Issuer`, `Jwt__Audience`, `Google__ClientId`, `Cors__AllowedOrigins__0`,
`Database__MigrateOnStartup`, `Mcp__PublicUrl` e `App__PublicUrl`. Sem `Jwt__Secret` com 32+ bytes a API não sobe.

Fora de Development a API lê `X-Forwarded-For`/`X-Forwarded-Proto` (`UseForwardedHeaders`) e confia
em qualquer proxy, pois só é alcançável pela rede interna do compose — não publique a porta 8080 da
API diretamente na internet.

### Health check

`GET /health` (anônimo) responde `200 Healthy` quando a API está de pé e consegue conectar no
PostgreSQL (`FinamiContext.Database.CanConnectAsync`); caso contrário, `503 Unhealthy`. A imagem
Docker inclui `curl` para o healthcheck do compose:

```yaml
healthcheck:
  test: ["CMD", "curl", "-fsS", "http://localhost:8080/health"]
```

### Migrations na inicialização

Com `Database__MigrateOnStartup=true` a API executa `Database.MigrateAsync()` antes de começar a
atender requisições. Se a migration falhar, o processo encerra (o compose reinicia o contêiner).

### Imagem Docker

`backend/Dockerfile` (contexto de build = pasta `backend/`): build com SDK 9.0, runtime
`aspnet:8.0` (Debian), porta `8080`, usuário não-root `app`. O projeto `Finami.Tests` não entra na
imagem.

## Executando (dev)

Pré-requisito: PostgreSQL local em `localhost:5432` com usuário/senha `postgres`/`postgres` (os
valores estão em `appsettings.Development.json`; o banco `finami_dev` é criado pelo `database update`).

```powershell
cd backend
dotnet build Finami.sln
$env:ConnectionStrings__FinamiContext = "Host=localhost;Port=5432;Database=finami_dev;Username=postgres;Password=postgres"
dotnet ef database update --project Finami.Infra --startup-project Finami.API
dotnet run --project Finami.API
```

O `dotnet ef` usa `FinamiContextFactory`, que lê `ConnectionStrings__FinamiContext` (sem ela,
cai no padrão `Database=finami`, usuário `finami`). O `dotnet run` usa o perfil `http` do
`launchSettings.json` (`ASPNETCORE_ENVIRONMENT=Development`).

Swagger: `http://localhost:5145/swagger`. O arquivo `Finami.API/Finami.API.http` traz o roteiro
completo de chamadas.

### Migrations

```powershell
dotnet ef migrations add <Nome> --project Finami.Infra --startup-project Finami.API --output-dir Migrations
```

Migrations existentes: `InitialUsers`, `AddWalletsAndLedger` (inclui o seed das contas de sistema),
`AddBtcQuotes`, `AddGroups`, `AddInvitationsAndNotifications` (`group_invitations` e `notifications`),
`AddOAuthAndMcp` (clientes, conexões, pedidos e tokens OAuth, chaves de repetição e auditoria do MCP).

## Testes

```powershell
dotnet test Finami.sln                                   # unitários
$env:FINAMI_TEST_DB = "Host=...;Database=finami_test;..."
dotnet test Finami.sln --filter "Category=Integration"   # concorrência real no PostgreSQL
```

Os testes de integração são ignorados automaticamente quando `FINAMI_TEST_DB` não está definido.

## Respostas de erro

Toda resposta diferente de 2xx (exceto 500) usa o envelope:

```json
{ "sucesso": false, "mensagem": "Saldo insuficiente na carteira de origem.", "erros": [] }
```

| Status | Quando |
|---|---|
| 400 | Validação de entrada |
| 401 | Não autenticado ou credenciais inválidas |
| 403 | Sem permissão sobre o recurso |
| 404 | Recurso inexistente |
| 409 | Email já usado, membro duplicado, convite pendente duplicado ou convite que não está mais disponível, transação já estornada |
| 422 | Regra de negócio (saldo insuficiente, carteira inativa, valor pequeno demais para conversão, inclusão direta de quem precisa ser convidado) |
| 410 | Pedido de autorização OAuth vencido ou já respondido |
| 503 | Cotação do bitcoin indisponível ou desatualizada |
| 500 | Erro inesperado (corpo com a mensagem da exceção) |
