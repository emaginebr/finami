# Research: Servidor MCP do Finami com conexão via OAuth

**Feature**: `004-mcp-oauth-server` · **Data**: 2026-11-01

Formato: **Decisão / Racional / Alternativas**. Nenhum item "NEEDS CLARIFICATION" restante.

---

## R-01 — SDK e transporte do MCP

**Decisão**: SDK oficial C# do MCP (`ModelContextProtocol.AspNetCore`, versão estável mais
recente compatível com `net8.0`, fixada no `.csproj`), hospedado **dentro do `Finami.API`** em
`/mcp`, transporte **Streamable HTTP** em modo **stateless** (sem sessão em memória, cada
requisição carrega o token). Revisão do protocolo: 2025-06-18 ou superior (a que o SDK negociar).

**Racional**: o SDK oficial (mantido com a Microsoft) implementa o protocolo, a descoberta de
ferramentas, resultados estruturados e o metadado de recurso protegido (RFC 9728). Rodar no mesmo
processo permite que cada ferramenta chame **os mesmos serviços de domínio** dos controllers
(`ILedgerService`, `IWalletService`…), o que garante FR-013 (mesmas regras e mensagens) sem
duplicar lógica. Stateless funciona atrás do proxy e com mais de uma réplica.

**Alternativas**: servidor MCP separado em Node/TypeScript chamando a API REST (duplica deploy,
autenticação e mapeamento de erros; sai da stack fixa do backend); SSE legado (descontinuado no
protocolo); stdio (só local, não serve a assistentes web como o claude.ai).

## R-02 — Servidor de autorização OAuth 2.1

**Decisão**: implementar no backend um servidor de autorização **próprio e mínimo**, com só o que
a especificação de autorização do MCP exige:

| Endpoint | Padrão |
|---|---|
| `GET /.well-known/oauth-protected-resource` | RFC 9728 (recurso `/mcp`) |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 |
| `POST /oauth/register` | RFC 7591 (registro dinâmico) |
| `GET /oauth/authorize` | OAuth 2.1, `response_type=code`, PKCE `S256` obrigatório |
| `POST /oauth/token` | `authorization_code` e `refresh_token` |
| `POST /oauth/revoke` | RFC 7009 |

Parâmetro `resource` (RFC 8707) aceito e conferido contra a URL do MCP.

**Racional**: o conjunto é pequeno e bem definido; implementar sobre EF Core mantém as tabelas no
padrão do Princípio V (snake_case, `*_pkey`, `ClientSetNull`) e nas skills `dotnet-architecture`.
Todo o material sensível usa primitivas prontas (`RandomNumberGenerator`, SHA-256,
`CryptographicOperations.FixedTimeEquals`).

**Alternativas**: OpenIddict (maduro, mas não tem registro dinâmico pronto, traz um esquema de
tabelas próprio fora do Princípio V e uma camada grande para 6 endpoints); provedor externo
(Auth0/Keycloak — custo, nova infraestrutura, e o login do Finami já existe); Duende
IdentityServer (licença comercial).

## R-03 — Formato dos tokens e revogação imediata

**Decisão**: **tokens opacos** (32 bytes aleatórios, base64url, prefixos `fma_` para acesso e
`fmr_` para renovação), guardados só como **SHA-256**. Um esquema de autenticação próprio
(`McpBearer`) valida o token por consulta indexada ao hash, confere expiração, conexão ativa e
escopo, e monta o `ClaimsPrincipal` com `sub` (userId), `grant_id`, `client_id` e `scope`.
Acesso: 1 h. Renovação: 30 dias, renovados a cada uso (expiração deslizante); cada uso emite um
par novo e marca o anterior como usado (**rotação**). Reuso de um token de renovação já usado
revoga a conexão inteira.

**Racional**: com token opaco, "Desconectar" vale na hora (SC-004) sem lista de bloqueio; o JWT
do app nunca é aceito no MCP e o token do MCP nunca é aceito no app, porque são esquemas
distintos e o `/api/*` só aceita `JwtBearer` (FR-009). O custo é uma consulta por chamada, coberta
por índice único.

**Alternativas**: JWT com audiência `finami-mcp` (revogação só ao vencer, ou exigiria consulta
ao banco de qualquer forma); reaproveitar o JWT do app (viola FR-009).

## R-04 — Tela de consentimento e login

**Decisão**: `GET /oauth/authorize` valida cliente, `redirect_uri` (igualdade exata, exceto porta
em loopback — RFC 8252), `code_challenge_method=S256`, escopos e `resource`. Se algo falhar
**antes** de confirmar o `redirect_uri`, mostra uma página de erro simples e não redireciona. Se
estiver válido, grava um **pedido de autorização** (vale 10 min) e redireciona para o frontend em
`{App:PublicUrl}/autorizar?pedido={requestId}`. A página `/autorizar`:

1. sem sessão → vai para o login atual (email/senha ou Google) e volta para `/autorizar` (estado
   de navegação que o `LoginPage` já usa);
2. com sessão → `GET /api/oauth/requests/{id}` (JWT do app) e mostra nome do assistente,
   endereço de retorno (domínio), permissões em linguagem simples e o seletor "Só consultar" /
   "Consultar e fazer alterações";
3. "Autorizar" → `POST /api/oauth/requests/{id}/approve { scopes }` → a API cria/atualiza a
   conexão, emite o código (10 min, uso único) e devolve `redirectUrl`; "Negar" →
   `POST …/deny` devolve `redirectUrl` com `error=access_denied`. O frontend faz
   `window.location.assign(redirectUrl)`.

**Racional**: reaproveita o login, o Google e o visual do app (FR-006, Princípio IX) sem criar
cookies de sessão na API (Princípio VI proíbe tokens em cookie). A aprovação exige o JWT do app,
então só a própria pessoa aprova.

**Alternativas**: página de login renderizada pela API (Razor) — duplicaria o login e o Google e
fugiria do design do app; cookie de sessão na API — fere o Princípio VI.

## R-05 — Registro dinâmico de clientes

**Decisão**: `POST /oauth/register` aberto (sem token inicial), com limite de 10 registros por
hora por IP. Aceita `client_name` (obrigatório, até 120), `redirect_uris` (1–5; `https://` ou
`http://localhost`/`127.0.0.1`/`[::1]`; esquemas próprios de app nativo aceitos se tiverem ponto,
ex. `com.exemplo.app:/cb`), `grant_types` ⊆ {`authorization_code`,`refresh_token`},
`token_endpoint_auth_method` ∈ {`none`, `client_secret_post`, `client_secret_basic`}. Para
métodos com segredo, gera `client_secret` devolvido uma única vez e guardado como hash.
Clientes sem nenhuma conexão por 30 dias são removidos pela limpeza.

**Racional**: é o que Claude (web, desktop, Claude Code) e o MCP Inspector esperam (US1-1, SC-001).
O limite por IP e a limpeza evitam lixo e abuso.

## R-06 — Escopos

**Decisão**: `finami:read` e `finami:write` (write implica read na prática: a tela mostra
"Consultar e fazer alterações"). Escopo padrão quando o cliente não pede nenhum: `finami:read
finami:write` (o que o cliente anuncia nos metadados), sempre com a pessoa podendo reduzir para
só leitura. Cada ferramenta declara o escopo exigido; a lista completa de ferramentas é sempre
exibida, e a chamada sem escopo recebe erro "permissão insuficiente" (FR-019).
Reautorizar o mesmo cliente **substitui** os escopos da conexão ativa e revoga os tokens
anteriores (edge case "autoriza duas vezes").

## R-07 — Ferramentas, erros e resultados

**Decisão**: classes de ferramentas em `Finami.API/Mcp/Tools/` (uma por área), com atributos do
SDK, nomes em português snake_case sem acento (ex. `registrar_despesa`), descrições e parâmetros
em português, e anotações `readOnlyHint`, `destructiveHint`, `idempotentHint`. Cada ferramenta
chama o serviço de domínio com `userId` do token. Um filtro único converte `DomainException` em
resultado de erro do MCP (`isError: true`) com a **mesma mensagem** do app e um código
(`validacao`, `nao_encontrado`, `sem_permissao`, `conflito`, `regra_de_negocio`,
`cotacao_indisponivel`, `permissao_insuficiente`, `limite_excedido`); outras exceções viram
"Erro interno. Tente novamente." e são registradas (o equivalente MCP do Princípio VII).
Resultados devolvem **conteúdo estruturado** (o próprio DTO do domínio, já com
`[JsonPropertyName]`) mais um texto curto em português (FR-016).

**Racional**: mesma fonte de verdade do app; anotações orientam o assistente a pedir confirmação
antes de escrever ou excluir (FR-014).

## R-08 — Repetição segura (idempotência)

**Decisão**: parâmetro opcional `chave_repeticao` (até 64 caracteres) nas ferramentas que criam
lançamentos, carteiras, famílias, pessoas e convites. Tabela `mcp_idempotency_keys` com índice
único `(user_id, tool_name, idempotency_key)`: a ferramenta insere a chave com status
`EmAndamento`, executa, e grava o resultado serializado. Repetição com resultado gravado devolve o
mesmo resultado; repetição durante a execução recebe `conflito` ("Operação em andamento, tente em
instantes."); falha da operação apaga a chave. Validade: 24 h.

**Racional**: assistentes repetem chamadas em falha de rede (US3-3, SC-006); o índice único
resolve corridas sem trava em memória.

## R-09 — Limite de taxa, auditoria e último uso

**Decisão**:
- `RateLimiter` nativo do ASP.NET Core: janela fixa de **60 chamadas/min por conexão** em `/mcp`
  (FR-023), 10/h por IP em `/oauth/register`, 30/min por IP em `/oauth/token`. Acima do limite:
  HTTP 429 com `Retry-After`.
- Auditoria (`mcp_audit_logs`): uma linha por ferramenta de **escrita** executada — usuário,
  conexão, cliente, ferramenta, resultado (`Sucesso`/código de erro), id afetado, data. Sem
  argumentos brutos (podem conter descrições pessoais) nem tokens (FR-024).
- `last_used_at` da conexão atualizado no máximo 1 vez por minuto por conexão.

## R-10 — Limpeza

**Decisão**: `BackgroundService` (`OAuthCleanupService`) a cada hora apaga pedidos de autorização
vencidos, tokens de acesso vencidos há mais de 1 dia, tokens de renovação vencidos ou revogados há
mais de 30 dias, chaves de repetição com mais de 24 h e clientes dinâmicos sem conexão há 30 dias.
Logs de auditoria ficam 1 ano.

## R-11 — URLs, proxy e ambientes

**Decisão**: novas configurações:

| Chave | dev | homolog (Docker) | prod |
|---|---|---|---|
| `Mcp__PublicUrl` (issuer e base) | `http://localhost:5145` | `http://localhost:5145` | `https://{DOMAIN}` |
| `App__PublicUrl` (frontend, tela `/autorizar`) | `http://localhost:5173` | `http://localhost:8080` | `https://{DOMAIN}` |

Recurso protegido = `{Mcp__PublicUrl}/mcp`. O `Caddyfile` de produção passa a encaminhar
`/mcp*`, `/oauth/*` e `/.well-known/oauth-*` para a API. HTTP só é aceito quando a URL pública é
`localhost` (FR-026). CORS: `/mcp`, `/oauth/token`, `/oauth/register`, `/oauth/revoke` e
`/.well-known/*` aceitam qualquer origem **sem credenciais** (autenticação só por token no
cabeçalho, sem cookies), necessário para clientes que rodam no navegador; `/api/*` mantém a
política atual.

**Racional**: `Program.cs` já confia em `X-Forwarded-*` atrás do Caddy; a URL pública vem de
configuração para não depender do `Host` recebido (evita issuer forjado).

## R-12 — Ferramentas de saldo total e paginação de extrato

**Decisão**: `saldo_total` usa o mesmo cálculo da Home (soma das carteiras ativas visíveis,
convertendo BTC pela cotação atual, devolvendo a cotação usada). Os extratos do domínio devolvem
o período inteiro; o MCP pagina **na camada da ferramenta** (cursor = índice do último lançamento
entregue, codificado em base64url com o período) com padrão 20 e máximo 50 (FR-017), mantendo
saldo inicial e final do período em todas as páginas.

**Racional**: não altera os serviços já testados; extratos são limitados a 1 ano pelo domínio,
então paginar em memória é barato.

## R-13 — Testes

**Decisão**:
- Backend (xUnit + Moq + FluentAssertions): `OAuthServiceTests` (registro, validação de
  redirect, PKCE certo/errado, código vencido/reusado, rotação e detecção de reuso, revogação,
  escopos reduzidos, reautorização), `McpBearerHandlerTests` (token válido, vencido, revogado,
  JWT do app recusado), testes das ferramentas (escopo de escrita exigido, mapeamento de erros,
  isolamento entre usuários, idempotência, paginação de extrato), `OAuthConnectionServiceTests`
  (listar, desconectar, desconectar todos).
- Integração: teste com `WebApplicationFactory` + cliente MCP do SDK fazendo o fluxo completo
  (registro → authorize → approve → token → `tools/list` → `tools/call` → revoke → 401), com
  banco PostgreSQL de homolog ou provedor em memória se o Npgsql não estiver disponível.
- Frontend (Vitest + Testing Library + axe): página `/autorizar` (sem sessão, consentimento,
  só leitura, negar, pedido vencido) e seção "Assistentes conectados".
- Manual (quickstart): MCP Inspector e Claude Code contra o homolog.

## R-14 — Distribuição entre agentes (Princípio VIII)

- `ux-designer`: mockups `oauth-consent.html` (tela de autorização, estados) e
  `account-connections.html` (seção "Assistentes conectados"), mais a página de erro do OAuth.
- `dotnet-senior-developer`: entidades, migration `AddOAuthAndMcp`, `OAuthService`,
  `OAuthConnectionService`, esquema `McpBearer`, endpoints OAuth e de consentimento, servidor MCP
  com ferramentas/recursos/prompts, rate limiting, auditoria, limpeza, Caddyfile/compose, testes.
- `frontend-react-developer`: entidade `OAuthConnection` e `OAuthRequest` (skill
  `react-architecture`), página `/autorizar`, seção em Conta, i18n, testes.
