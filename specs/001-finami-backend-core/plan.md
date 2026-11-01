# Implementation Plan: Núcleo do Backend do Finami

**Branch**: `001-finami-backend-core` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-finami-backend-core/spec.md`

## Summary

API REST em .NET 8 (Clean Architecture, pasta `backend/`) para gestão financeira familiar:
usuários com ou sem credenciais, autenticação JWT própria e login Google por ID token, grupos
com responsável e visibilidade de extrato configurável, carteiras BRL/BTC como contas de um
livro-razão de partidas dobradas (transações imutáveis + lançamentos, contas de sistema
externas e de câmbio), compra/venda automática de bitcoin na cotação atual (CoinGecko com
fallback Mercado Bitcoin), estorno, e extratos por período por carteira, usuário ou grupo.
Consistência garantida por transação de banco com lock por conta (`SELECT … FOR UPDATE`).

## Technical Context

**Language/Version**: C# 12 / .NET 8 (`net8.0`; build com SDK 9.0.309 instalado)
**Primary Dependencies**: ASP.NET Core 8 Web API, EF Core 9.x + Npgsql.EntityFrameworkCore.PostgreSQL 9.x, Swashbuckle 8.x, Microsoft.AspNetCore.Authentication.JwtBearer 8.x, Google.Apis.Auth, Microsoft.Extensions.Identity.Core (PasswordHasher), FluentValidation
**Storage**: PostgreSQL (snake_case, `numeric(20,8)` para valores, `timestamp without time zone` em UTC)
**Testing**: xUnit + Moq + FluentAssertions (`Finami.Tests`); categoria `Integration` contra PostgreSQL real opcional (`FINAMI_TEST_DB`)
**Target Platform**: Linux server / container (deploy), desenvolvimento em Windows sem Docker
**Project Type**: web-service (somente backend)
**Performance Goals**: extrato anual de grupo (10 membros, 5.000 transações) < 3 s (SC-006); demais operações interativas < 1 s
**Constraints**: saldo nunca negativo sob concorrência (SC-005); soma por moeda dos lançamentos = 0 (SC-002); cotação para conversão com idade ≤ 5 min (FR-029); sem Docker local
**Scale/Scope**: uso familiar — dezenas de usuários por grupo, milhares de transações/ano por grupo; ~30 endpoints, 7 tabelas

Nenhum item ficou como NEEDS CLARIFICATION — todos resolvidos em [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Princípio | Avaliação | Status |
|---|---|---|---|
| I | Skills obrigatórias | Entidades seguirão `dotnet-architecture` (DTO → Infra.Interfaces → Domain → Infra → Application). Frontend fora do escopo (`react-architecture` n/a). | ✅ |
| II | Stack fixa | .NET 8, EF Core 9, PostgreSQL, Swashbuckle 8; nenhum ORM extra; sem Docker local. Bibliotecas auxiliares (JwtBearer, Google.Apis.Auth, Identity.Core, FluentValidation) não substituem itens da stack. | ✅ |
| III | Case de diretórios | Regras são de frontend (`Contexts/`, `Services/`, `hooks/`, `types/`); no backend, pastas em PascalCase (`Services/`, `Models/`). | ✅ |
| IV | Convenções de código | Namespaces file-scoped `Finami.*`, `_camelCase` em campos privados, `[JsonPropertyName]` camelCase em todos os DTOs. | ✅ |
| V | Banco de dados | snake_case plural, PK `{entidade}_id` bigint identity, `{tabela}_pkey`, `fk_{pai}_{filho}`, `ClientSetNull`, `timestamp without time zone`, `varchar` com tamanho, enums `integer`. Ver [data-model.md](./data-model.md). | ✅ |
| VI | Autenticação | Constituição define **Basic Authentication** com `AuthenticationHandler` customizado. O plano usa **JWT Bearer + login Google**, pedidos explicitamente na feature. Demais regras mantidas: token em localStorage (nunca cookie), `[Authorize]` em controllers sensíveis, CORS aberto só em Development, secrets fora do frontend. | ✅ Resolvido na constituição v2.0.0 (Princípio VI agora define JWT Bearer) |
| VII | Erros no backend | Todo controller termina em `catch (Exception ex) { return StatusCode(500, ex.Message); }`; exceções de domínio tipadas são capturadas antes e mapeadas para 400/401/403/404/409/422/503 com envelope `{ sucesso, mensagem, erros }`. | ✅ |
| — | Variáveis de ambiente | Mantém `ConnectionStrings__FinamiContext` e `ASPNETCORE_ENVIRONMENT`; adiciona `Jwt__*`, `Google__ClientId`, `BtcQuote__*`, `Cors__AllowedOrigins`. | ✅ |

**Resultado do gate (pré-pesquisa)**: aprovado com 1 violação justificada.
**Re-check pós-design (Fase 1)**: o data model, os contratos e o quickstart foram revisados
contra a tabela acima — nenhuma nova violação. Os controllers expostos em
[contracts/api.md](./contracts/api.md) são todos `[Authorize]`, exceto `auth/register`,
`auth/login` e `auth/google`.

## Project Structure

### Documentation (this feature)

```text
specs/001-finami-backend-core/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões técnicas (R-01 a R-16)
├── data-model.md        # Fase 1 — tabelas, enums, regras, invariantes
├── quickstart.md        # Fase 1 — execução local e roteiro de validação
├── contracts/
│   └── api.md           # Fase 1 — contrato REST
├── checklists/
│   └── requirements.md  # Qualidade da spec
└── tasks.md             # Fase 2 (/speckit.tasks — não criado aqui)
```

### Source Code (repository root)

```text
backend/
├── Finami.sln
├── Finami.DTO/
│   ├── Auth/            # RegisterInfo, LoginInfo, GoogleLoginInfo, AuthResult
│   ├── Users/           # UserInfo, UserInsertInfo, UserUpdateInfo, PasswordUpdateInfo
│   ├── Groups/          # GroupInfo, GroupInsertInfo, GroupUpdateInfo, GroupMemberInfo
│   ├── Wallets/         # WalletInfo, WalletInsertInfo, WalletUpdateInfo, WalletPublicInfo
│   ├── Transactions/    # TransactionInfo, IncomeInfo, ExpenseInfo, TransferInfo, TransferPreviewResult
│   ├── Quotes/          # BtcQuoteInfo
│   ├── Statements/      # StatementResult, StatementTotalInfo, StatementEntryInfo
│   ├── Settings/        # JwtSettings, GoogleSettings, BtcQuoteSettings
│   └── ErrorResult.cs   # { sucesso, mensagem, erros }
├── Finami.Infra.Interfaces/
│   ├── Repository/      # IUserRepository<T>, IGroupRepository<T>, IAccountRepository<T>,
│   │                    # ITransactionRepository<T>, ILedgerRepository<T>, IBtcQuoteRepository<T>,
│   │                    # IUnitOfWork (transação de banco + lock de contas)
│   └── AppServices/     # IBtcQuoteAppService<T>, IGoogleTokenAppService<T>
├── Finami.Domain/
│   ├── Enums/           # Currency, AccountKind, TransactionType, StatementVisibility
│   ├── Models/          # User, Group, GroupMember, Account, Transaction, LedgerEntry, BtcQuote
│   ├── Exceptions/      # Validation/Unauthorized/Forbidden/NotFound/Conflict/BusinessRule/QuoteUnavailable
│   ├── Validators/      # FluentValidation dos DTOs de entrada
│   ├── Interfaces/      # IAuthService, ITokenService, IUserService, IGroupService, IWalletService,
│   │                    # ILedgerService, IQuoteService, IStatementService, IAccessPolicy
│   └── Services/        # implementações; Money (trunc/precisão), AccessPolicy
├── Finami.Infra/
│   ├── Context/         # FinamiContext (Fluent API, ValueConverter UTC, seed das 6 contas de sistema)
│   ├── Repository/      # implementações + UnitOfWork (FOR UPDATE ordenado por account_id)
│   ├── AppServices/     # BtcQuoteAppService (CoinGecko + Mercado Bitcoin), GoogleTokenAppService
│   └── Migrations/
├── Finami.Application/
│   └── Startup.cs       # DI centralizado, JWT, CORS, HttpClients, IMemoryCache
├── Finami.API/
│   ├── Controllers/     # Auth, Users, Groups, Wallets, Transactions, Quotes, Statements
│   ├── Extensions/      # ClaimsPrincipal.GetUserId()
│   ├── Program.cs
│   ├── appsettings.json / appsettings.{Development,Docker,Production}.json
│   └── Finami.API.http
└── Finami.Tests/
    ├── Domain/          # Money, LedgerService, AccessPolicy, GroupService, StatementService, AuthService
    ├── Infra/           # BtcQuoteAppService (HttpMessageHandler fake)
    └── Integration/     # [Trait("Category","Integration")] concorrência e invariante SC-002
```

**Structure Decision**: solução .NET única em `backend/`, seguindo as camadas da skill
`dotnet-architecture` com `Finami.API` como camada de apresentação. Não há frontend nesta
feature (pasta `frontend/` será criada em feature futura).

### Fluxos-chave de design

- **Transferência** (`LedgerService.TransferAsync`): valida DTO → carrega contas → checa
  `AccessPolicy.CanControlWallet(origem)` e destino ativo → decide tipo pela moeda → se houver
  conversão, obtém cotação (`QuoteService.GetForConversionAsync`, erro 503 se `stale`) e calcula
  com `Money.Truncate` → abre `IUnitOfWork` → `LockAccountsAsync` (origem, destino; ordem
  crescente de id) → recalcula saldo da origem → grava cabeçalho + 2 ou 4 lançamentos →
  commit.
- **Estorno**: mesmo caminho, com origem/destino e valores invertidos da original, cotação
  reaproveitada, unicidade garantida por índice único em `reversed_transaction_id`.
- **Extrato**: `StatementService` resolve o conjunto de contas do escopo e o nível de detalhe
  (`AccessPolicy.GroupStatementAccess`), busca saldos iniciais (`SUM` antes de `start`) e
  lançamentos do período em 2 consultas indexadas, e marca `internal` em transferências de
  mesma moeda com as duas pontas no escopo.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Princípio VI — JWT Bearer + login Google no lugar de Basic Authentication | Pedido explícito da feature; FR-006/FR-007 exigem login Google e credencial assinada com validade limitada | Basic Auth reenvia email/senha a cada requisição e não funciona para usuários que só entram com Google (sem senha). **Resolvido**: a constituição v2.0.0 (2026-11-01) adotou JWT Bearer, o handler `JwtBearer` e a chave de localStorage `"finami:auth"`; esta linha fica só como histórico. |
