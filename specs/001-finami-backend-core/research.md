# Research: Núcleo do Backend do Finami

**Feature**: `001-finami-backend-core` | **Date**: 2026-11-01

Cada item segue o formato **Decision / Rationale / Alternatives considered**.

---

## R-01. Runtime, framework e ambiente local

- **Decision**: .NET 8 (`net8.0`), ASP.NET Core Web API com controllers, EF Core 9.x +
  `Npgsql.EntityFrameworkCore.PostgreSQL` 9.x, Swashbuckle 8.x. O build local usa o SDK 9.0.309
  já instalado (ele compila `net8.0`); para executar a API e os testes é necessário o runtime
  ASP.NET Core 8 instalado.
- **Rationale**: stack fixa da constituição (Princípio II). EF Core 9 suporta `net8.0`.
- **Alternatives considered**: .NET 9/10 — rejeitado, viola a stack fixa; Minimal APIs —
  rejeitado, a constituição pressupõe controllers com `[Authorize]` e try/catch (Princípios VI e VII).

## R-02. Arquitetura da solução

- **Decision**: Clean Architecture conforme a skill `dotnet-architecture` (obrigatória pelo
  Princípio I): `Finami.DTO`, `Finami.Infra.Interfaces`, `Finami.Domain`, `Finami.Infra`,
  `Finami.Application` (composição/DI em `Startup.cs`), `Finami.API` (controllers) e
  `Finami.Tests` (xUnit), todos em `backend/`.
- **Rationale**: padrão obrigatório; mantém regras de negócio (ledger, conversão, permissões)
  isoladas e testáveis sem banco.
- **Alternatives considered**: projeto único — rejeitado pelo Princípio I.

## R-03. Autenticação por token (JWT) — desvio da constituição

- **Decision**: JWT Bearer (`Microsoft.AspNetCore.Authentication.JwtBearer`), assinado com
  HMAC-SHA256, chave em `Jwt__Secret` (mínimo 32 bytes), validade padrão de 8 horas
  (`Jwt__ExpirationMinutes`), claims `sub` (userId), `email`, `name`. Sem refresh token nesta
  versão. Header `Authorization: Bearer {token}`. O frontend futuro guarda o token em
  localStorage (a constituição proíbe cookies — mantido).
- **Rationale**: pedido explícito do usuário; a spec exige "credencial assinada com validade
  limitada" (FR-007). JWT é stateless e funciona bem com SPA e com o login Google.
- **Alternatives considered**: Basic Authentication (constituição, Princípio VI) — rejeitado:
  envia credenciais a cada requisição, não funciona para usuários Google (que não têm senha) e
  contraria o pedido explícito. Registrado em *Complexity Tracking*; recomenda-se emenda MINOR
  da constituição (v1.1.0) trocando o esquema para JWT Bearer.

## R-04. Login com Google

- **Decision**: fluxo de **ID token**: o frontend obtém um ID token pelo Google Identity
  Services e envia para `POST /api/auth/google`; o backend valida com
  `Google.Apis.Auth` (`GoogleJsonWebSignature.ValidateAsync`, conferindo `aud` =
  `Google__ClientId` e `email_verified = true`), localiza o usuário pelo `google_subject` ou
  pelo email (vinculando) ou cria um novo, e devolve o JWT do Finami.
- **Rationale**: o backend não precisa de client secret nem de redirect/cookies; casa com o
  token em localStorage; atende FR-006 (criação no primeiro acesso e vínculo por email).
- **Alternatives considered**: fluxo authorization-code com `AddGoogle()` no servidor —
  rejeitado: depende de cookie de correlação e redirect, o que conflita com "nunca cookies" e
  complica uma API pura.

## R-05. Hash de senha

- **Decision**: `PasswordHasher<User>` de `Microsoft.Extensions.Identity.Core` (PBKDF2 com
  salt, formato versionado, suporta rehash), sem adotar o ASP.NET Identity completo.
- **Rationale**: atende FR-008 com componente oficial e sem tabelas extras.
- **Alternatives considered**: BCrypt.Net — viável, mas adiciona dependência de terceiros;
  ASP.NET Identity completo — excessivo para o modelo de usuário simples pedido.

## R-06. Modelo contábil (plano de contas / partidas dobradas)

- **Decision**: cada **transação** (cabeçalho) tem uma conta de saída e uma de entrada (como pede
  a spec) e gera **lançamentos** (`ledger_entries`) com valor assinado por conta. Contas =
  tabela `accounts`, que abrange carteiras de usuário e contas de sistema. Contas de sistema
  semeadas por moeda: `ExternalSource`, `ExternalSink` e `Exchange` (câmbio) — 6 no total.
  - Mesma moeda: 2 lançamentos (origem −v, destino +v).
  - Compra/venda de BTC: 4 lançamentos — origem −v (moeda A), Câmbio(A) +v, Câmbio(B) −w,
    destino +w (moeda B). Assim a soma por moeda é sempre zero (SC-002), mesmo com conversão.
- **Rationale**: é o método contábil padrão para multimoeda (conta de câmbio/"trading
  account"); permite auditar SC-002 com uma única consulta e calcular saldo de qualquer conta
  pela soma dos seus lançamentos (FR-021).
- **Alternatives considered**: só o cabeçalho com `debit_amount`/`credit_amount` — mais simples,
  mas a soma por moeda não fecha em conversões; saldo materializado como coluna — rejeitado
  pela spec (saldo derivado do histórico), embora um cache possa ser adicionado no futuro.

## R-07. Concorrência e saldo não negativo

- **Decision**: cada transação roda em uma transação de banco (`READ COMMITTED`) que primeiro
  bloqueia as linhas das contas envolvidas com `SELECT ... FOR UPDATE` (ordenadas por
  `account_id` para evitar deadlock), recalcula o saldo da origem pela soma dos lançamentos e
  só então grava cabeçalho + lançamentos. Contas de sistema não são bloqueadas nem validadas
  quanto a saldo (podem ficar negativas por definição).
- **Rationale**: atende FR-031 e SC-005 com a garantia do próprio PostgreSQL; volume familiar
  torna o custo do lock irrelevante.
- **Alternatives considered**: `SERIALIZABLE` com retry — mais complexo; token de concorrência
  otimista (`xmin`) em coluna de saldo — exigiria saldo materializado.

## R-08. Precisão e arredondamento

- **Decision**: valores em `numeric(20,8)` no banco e `decimal` no C#. Real arredondado para
  2 casas, Bitcoin para 8. Na conversão, o valor de destino é **truncado** (arredondamento para
  baixo) na precisão da moeda de destino: compra `btc = trunc8(brl / price)`; venda
  `brl = trunc2(btc × price)`. Valor de entrada com mais casas que a moeda de origem é recusado
  (400) em vez de arredondado silenciosamente. Compra que resulte em 0 BTC é recusada.
- **Rationale**: truncar nunca cria valor do nada e mantém SC-004 (diferença ≤ 1 unidade da
  moeda de destino); recusar entrada com casas a mais é mais previsível do que arredondar.
  Ajusta a edge case da spec ("arredondado") para "recusado" no caso do valor de origem.
- **Alternatives considered**: `double` — rejeitado (erro binário); arredondamento bancário —
  pode arredondar para cima e criar centavos.

## R-09. Fonte da cotação do bitcoin

- **Decision**: `BtcQuoteAppService` (Infra, `HttpClient` tipado) com fonte primária
  **CoinGecko** `GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_last_updated_at=true`
  e fallback **Mercado Bitcoin** `GET https://api.mercadobitcoin.net/api/v4/tickers?symbols=BTC-BRL`.
  Cache em memória por 60 s (`IMemoryCache`); cada cotação nova é persistida em `btc_quotes`
  para servir de "última cotação conhecida" e para auditoria. Cotação com mais de 5 min é
  `stale` (FR-029, SC-008). Timeout HTTP de 5 s por fonte. URLs e TTLs configuráveis
  (`BtcQuote__*`).
- **Rationale**: ambas públicas e sem chave; duas fontes reduzem indisponibilidade; o cache
  evita rate limit (CoinGecko free ≈ 30 req/min).
- **Alternatives considered**: Binance (par BTCBRL) — viável como terceira fonte; API paga
  — desnecessária para uso familiar.

## R-10. Permissões (autorização de recurso)

- **Decision**: um único serviço de domínio `AccessPolicy` com regras puras e testáveis:
  - `CanControlWallet(user, wallet)` = titular **ou** responsável pelo grupo vinculado.
  - `CanEditUserProfile(user, target)` = o próprio **ou** quem o cadastrou (`created_by_user_id`).
  - `CanManageGroup(user, group)` = responsável.
  - `GroupStatementAccess(user, group)` = `Full` / `Summary` / `Denied`, conforme
    `statement_visibility` e se é responsável/membro.
  Violações lançam `ForbiddenException` → 403.
- **Rationale**: FR-036/SC-007 exigem cobertura total; centralizar evita esquecimentos e
  permite testes unitários por regra.
- **Alternatives considered**: policies do ASP.NET (`IAuthorizationHandler`) por recurso —
  espalham a regra entre API e Domain.

## R-11. Tratamento de erros e formato de resposta

- **Decision**: exceções de domínio tipadas (`ValidationException` → 400,
  `UnauthorizedException` → 401, `ForbiddenException` → 403, `NotFoundException` → 404,
  `BusinessRuleException` → 422, `QuoteUnavailableException` → 503) capturadas nos controllers
  **antes** do `catch (Exception ex) → StatusCode(500, ex.Message)` exigido pelo Princípio VII.
  Envelope de erro conforme a constituição: `{ "sucesso": false, "mensagem": "...", "erros": [] }`.
  Respostas de sucesso retornam o DTO diretamente.
- **Rationale**: o Princípio VII exige o catch 500; códigos específicos são necessários para a
  spec (401 genérico no login, 403 nas permissões, recusas de regra de negócio) e não o
  contrariam — apenas o precedem.
- **Alternatives considered**: middleware global de exceção — removeria o try/catch exigido
  pela constituição.

## R-12. Validação de entrada

- **Decision**: FluentValidation (skill `dotnet-fluent-validation`) para os DTOs de entrada,
  chamado pelos serviços de domínio; erros viram `ValidationException` com a lista em `erros`.
- **Rationale**: skill disponível no projeto; mantém validação fora dos controllers.
- **Alternatives considered**: DataAnnotations — mais limitado para regras condicionais (ex.:
  senha obrigatória somente no auto-cadastro).

## R-13. Extrato

- **Decision**: o extrato é calculado sobre `ledger_entries` filtrando pelo conjunto de contas
  do escopo (1 carteira; carteiras do titular; carteiras vinculadas ao grupo) e por
  `occurred_at` em `[start 00:00, end+1 00:00)` (datas no fuso `America/Sao_Paulo`, convertidas
  para UTC). Saldo inicial = soma dos lançamentos antes do início. Totais por moeda. Uma
  transferência **na mesma moeda** cujas contas de saída e de entrada estão ambas no escopo é
  marcada `internal = true` e não entra em `totalIn`/`totalOut` (FR-034). Compras/vendas de BTC
  nunca são internas, pois mudam a composição por moeda do escopo (saída em BRL, entrada em BTC);
  assim `closing = opening + totalIn − totalOut` vale sempre, por moeda. Visibilidade `Summary`
  devolve só os totais. Índice `(account_id, occurred_at)`.
- **Rationale**: atende FR-033/034/035a e SC-003/SC-006 com consultas indexadas simples.
- **Alternatives considered**: tabela de saldos diários — otimização prematura para o volume
  familiar (SC-006: 5.000 transações/ano).

## R-14. Datas e horários

- **Decision**: gravar `timestamp without time zone` (Princípio V) sempre em **UTC**
  (`DateTime.UtcNow`, `DateTimeKind.Utc` reaplicado na leitura via `ValueConverter`). A API
  devolve ISO-8601 com `Z`. Filtros de extrato recebem datas (`yyyy-MM-dd`) interpretadas em
  `America/Sao_Paulo`.
- **Rationale**: respeita a convenção da constituição sem ambiguidade de fuso.
- **Alternatives considered**: `timestamptz` — mais correto no PostgreSQL, mas viola o Princípio V.

## R-15. Testes

- **Decision**: `Finami.Tests` com xUnit + Moq + FluentAssertions (skill `dotnet-test`),
  organizado por camada. Foco em: conversão/arredondamento, montagem de lançamentos,
  `AccessPolicy`, regras de grupo, montagem do extrato, emissão/validação de JWT. Testes
  dependentes de PostgreSQL real (concorrência com `FOR UPDATE`) ficam em uma categoria
  `Integration` que só roda quando `FINAMI_TEST_DB` estiver definido.
- **Rationale**: a constituição proíbe Docker local (sem Testcontainers); regras críticas
  ficam no Domain e são testáveis sem banco.
- **Alternatives considered**: EF InMemory/SQLite — não reproduzem `FOR UPDATE` nem tipos
  `numeric`, gerando falsa confiança nos testes de concorrência.

## R-16. Configuração por ambiente

- **Decision**: `appsettings.json` + `appsettings.{Development,Docker,Production}.json` (skill
  `dotnet-env`), secrets apenas por variável de ambiente: `ConnectionStrings__FinamiContext`,
  `Jwt__Secret`, `Jwt__Issuer`, `Jwt__Audience`, `Jwt__ExpirationMinutes`, `Google__ClientId`,
  `BtcQuote__PrimaryUrl`, `BtcQuote__FallbackUrl`, `BtcQuote__CacheSeconds`,
  `BtcQuote__StaleAfterSeconds`, `Cors__AllowedOrigins`. CORS `AllowAnyOrigin` apenas em
  Development (Princípio VI).
- **Rationale**: segue a constituição (seção Variáveis de Ambiente) e acrescenta as novas.
- **Alternatives considered**: user-secrets — útil em dev, mas não substitui as variáveis de ambiente.
