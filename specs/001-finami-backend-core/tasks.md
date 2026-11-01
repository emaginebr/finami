# Tasks: Núcleo do Backend do Finami

**Input**: Design documents from `/specs/001-finami-backend-core/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: a spec não pede TDD. Foram incluídos apenas os testes unitários previstos no plano
(research R-15) para as regras críticas — dinheiro/arredondamento, livro-razão, permissões e
extrato — e um teste de integração opcional de concorrência. Eles vêm depois da implementação
de cada história.

**Organization**: tarefas agrupadas por user story (US1–US6 da spec), em ordem de prioridade.

**Convenções obrigatórias para TODAS as tarefas** (não repetidas em cada linha):
- Seguir a skill `dotnet-architecture` (constituição, Princípio I): DTO → Infra.Interfaces → Domain → Infra → Application.
- Namespaces file-scoped `Finami.<Camada>.<Pasta>`; campos privados `_camelCase`; `[JsonPropertyName("camelCase")]` em toda propriedade de DTO.
- Banco: tabelas/colunas snake_case, PK `{entidade}_id` bigint identity com `HasConstraintName("{tabela}_pkey")`, FK `fk_{pai}_{filho}` com `DeleteBehavior.ClientSetNull`, `timestamp without time zone` em UTC, `varchar` com tamanho, enums como `integer` (ver data-model.md).
- Controllers: `[Authorize]` (exceto os 🔓 de contracts/api.md), try/catch mapeando exceções de domínio (T020) e terminando em `catch (Exception ex) { return StatusCode(500, ex.Message); }`.
- Interfaces de repositório genéricas `I{Entity}Repository<TModel> where TModel : class`; repositórios só de leitura e inserção para `transactions` e `ledger_entries` (imutáveis).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: user story da spec (US1…US6)

## Path Conventions

Solução única em `backend/` (plan.md → Project Structure). Projetos: `backend/Finami.DTO`,
`backend/Finami.Infra.Interfaces`, `backend/Finami.Domain`, `backend/Finami.Infra`,
`backend/Finami.Application`, `backend/Finami.API`, `backend/Finami.Tests`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: criar a solução, os projetos, as referências e os pacotes.

- [X] T001 Criar `backend/Finami.sln` e os projetos `net8.0`: classlibs `Finami.DTO`, `Finami.Infra.Interfaces`, `Finami.Domain`, `Finami.Infra`, `Finami.Application`; webapi com controllers `Finami.API`; xunit `Finami.Tests` (via `dotnet new` + `dotnet sln add`), com `<Nullable>enable</Nullable>` e `<ImplicitUsings>enable</ImplicitUsings>` em todos os `.csproj`
- [X] T002 Configurar referências entre projetos conforme a skill: Domain → Infra.Interfaces, DTO; Infra → Domain, Infra.Interfaces; Application → DTO, Domain, Infra, Infra.Interfaces; API → Application, DTO, Domain; Tests → Domain, Infra, DTO (`dotnet add reference` em cada `.csproj` de `backend/`)
- [X] T003 [P] Adicionar pacotes em `backend/Finami.Infra/Finami.Infra.csproj`: `Microsoft.EntityFrameworkCore` 9.x, `Npgsql.EntityFrameworkCore.PostgreSQL` 9.x, `Microsoft.EntityFrameworkCore.Design` 9.x, `Microsoft.Extensions.Caching.Memory`, `Microsoft.Extensions.Http`, `Google.Apis.Auth`
- [X] T004 [P] Adicionar pacotes em `backend/Finami.Domain/Finami.Domain.csproj`: `FluentValidation` 11.x, `Microsoft.Extensions.Identity.Core` 8.x, `Microsoft.Extensions.Options`, `System.IdentityModel.Tokens.Jwt` 8.x
- [X] T005 [P] Adicionar pacotes em `backend/Finami.API/Finami.API.csproj` (`Swashbuckle.AspNetCore` 8.x, `Microsoft.AspNetCore.Authentication.JwtBearer` 8.x, `Microsoft.EntityFrameworkCore.Design` 9.x) e em `backend/Finami.Tests/Finami.Tests.csproj` (`Moq`, `FluentAssertions` 6.x, `Microsoft.EntityFrameworkCore` 9.x)
- [X] T006 [P] Criar `backend/.gitignore` (bin/, obj/, *.user, appsettings.*.local.json) e `backend/.editorconfig` com file-scoped namespaces e `_camelCase` para campos privados

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: base comum a todas as histórias — enums, exceções, dinheiro, contexto, DI, API host.

**⚠️ CRITICAL**: nenhuma user story começa antes do fim desta fase.

- [X] T007 [P] Criar enums em `backend/Finami.Domain/Enums/`: `Currency.cs` (Brl=1, Btc=2), `AccountKind.cs` (Wallet=1, ExternalSource=2, ExternalSink=3, Exchange=4), `TransactionType.cs` (ExternalIncome=1, ExternalExpense=2, Transfer=3, BtcPurchase=4, BtcSale=5, Reversal=6), `StatementVisibility.cs` (ResponsibleOnly=1, AllMembers=2, MembersSummary=3)
- [X] T008 [P] Criar exceções de domínio em `backend/Finami.Domain/Exceptions/`: `DomainException` (base, com `Errors: List<string>`), `ValidationException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`, `ConflictException`, `BusinessRuleException`, `QuoteUnavailableException`
- [X] T009 [P] Criar `backend/Finami.Domain/Services/Money.cs` (static): `Precision(Currency)` (Brl=2, Btc=8), `Truncate(decimal, Currency)` (arredonda para baixo), `HasValidScale(decimal, Currency)`, `EnsurePositive`; conforme research R-08
- [X] T010 [P] Criar `backend/Finami.DTO/ErrorResult.cs` com `[JsonPropertyName("sucesso")] bool Sucesso`, `[JsonPropertyName("mensagem")] string Mensagem`, `[JsonPropertyName("erros")] List<string> Erros`
- [X] T011 [P] Criar classes de configuração em `backend/Finami.DTO/Settings/`: `JwtSettings` (Secret, Issuer, Audience, ExpirationMinutes=480), `GoogleSettings` (ClientId), `BtcQuoteSettings` (PrimaryUrl, FallbackUrl, CacheSeconds=60, StaleAfterSeconds=300, TimeoutSeconds=5), `CorsSettings` (AllowedOrigins: string[])
- [X] T012 Criar `backend/Finami.Infra/Context/FinamiContext.cs` (DbContext vazio de entidades por enquanto) com um `ValueConverter<DateTime, DateTime>` que grava UTC e lê como `DateTimeKind.Utc` aplicado a todas as propriedades `DateTime`/`DateTime?` em `ConfigureConventions`, e coluna `timestamp without time zone` por padrão
- [X] T013 Criar `backend/Finami.Infra.Interfaces/Repository/IUnitOfWork.cs` (`BeginTransactionAsync()`, `CommitAsync()`, `RollbackAsync()`, `LockAccountsAsync(IEnumerable<long> accountIds)`) e a implementação `backend/Finami.Infra/Repository/UnitOfWork.cs` usando `Database.BeginTransactionAsync(IsolationLevel.ReadCommitted)` e `SELECT account_id FROM accounts WHERE account_id = ANY(@ids) ORDER BY account_id FOR UPDATE` (research R-07)
- [X] T014 Criar `backend/Finami.Infra/Context/FinamiContextFactory.cs` (`IDesignTimeDbContextFactory`) lendo `ConnectionStrings__FinamiContext` do ambiente, para `dotnet ef`
- [X] T015 Criar `backend/Finami.Application/Startup.cs` com `ConfigureFinami(this IServiceCollection, IConfiguration)`: binds de `JwtSettings`/`GoogleSettings`/`BtcQuoteSettings`/`CorsSettings`, `AddDbContext<FinamiContext>(UseNpgsql(ConnectionStrings:FinamiContext))`, `AddMemoryCache()`, `IUnitOfWork`, e `AddValidatorsFromAssembly` do Domain; seções vazias comentadas para Repositories/AppServices/Services que cada história preencherá
- [X] T016 Configurar autenticação JWT Bearer em `backend/Finami.Application/Startup.cs` (`AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer` validando issuer, audience, lifetime e `SymmetricSecurityKey(Jwt:Secret)`, `ClockSkew` 1 min; falhar no startup se `Secret` < 32 bytes)
- [X] T017 Criar `backend/Finami.API/Program.cs`: `ConfigureFinami`, controllers com `JsonStringEnumConverter`, Swagger com esquema Bearer (apenas Development), CORS (`AllowAnyOrigin` somente em Development; `Cors:AllowedOrigins` nos demais — Princípio VI), `UseAuthentication`/`UseAuthorization`, `MapControllers`
- [X] T018 [P] Criar `backend/Finami.API/appsettings.json` e `appsettings.Development.json`, `appsettings.Docker.json`, `appsettings.Production.json` com as seções `ConnectionStrings`, `Jwt`, `Google`, `BtcQuote` (URLs de research R-09), `Cors`, sem secrets reais (skill `dotnet-env`)
- [X] T019 [P] Criar `backend/Finami.API/Extensions/ClaimsPrincipalExtensions.cs` com `GetUserId()` (lê `ClaimTypes.NameIdentifier`/`sub`, lança `UnauthorizedException` se ausente)
- [X] T020 Criar `backend/Finami.API/Controllers/FinamiControllerBase.cs` (herda `ControllerBase`) com `protected async Task<IActionResult> Execute(Func<Task<IActionResult>> action)` que captura `ValidationException`→400, `UnauthorizedException`→401, `ForbiddenException`→403, `NotFoundException`→404, `ConflictException`→409, `BusinessRuleException`→422, `QuoteUnavailableException`→503 (todas com `ErrorResult`) e por último `catch (Exception ex) { return StatusCode(500, ex.Message); }` (Princípio VII)
- [X] T021 Verificar o build: `dotnet build backend/Finami.sln` sem erros

**Checkpoint**: solução compila; API sobe (sem endpoints de negócio) com Swagger em Development.

---

## Phase 3: User Story 1 - Cadastro e acesso à conta (Priority: P1) 🎯 MVP

**Goal**: auto-cadastro com email e senha, login por email/senha e por Google, emissão de JWT, `GET /api/auth/me`.

**Independent Test**: `POST /api/auth/register` → `POST /api/auth/login` → `GET /api/auth/me` com o Bearer retorna 200; senha errada → 401 genérico; sem token → 401; `POST /api/auth/google` com ID token válido cria/vincula o usuário (quickstart, passo 1).

### Implementation for User Story 1

- [X] T022 [P] [US1] Criar `backend/Finami.Domain/Models/User.cs` (UserId, FirstName, LastName, Email?, PasswordHash?, GoogleSubject?, CreatedByUserId?, CreatedAt, UpdatedAt?) com `CanLogin` (email != null), `HasPassword`, `SetEmail(string?)` (trim + lowercase), `LinkGoogle(string subject)`, `UpdateName(first, last)` validando não vazio
- [X] T023 [P] [US1] Criar DTOs em `backend/Finami.DTO/Auth/`: `RegisterInfo` (firstName, lastName, email, password), `LoginInfo` (email, password), `GoogleLoginInfo` (idToken), `AuthResult` (token, expiresAt, isNewUser, user); e `backend/Finami.DTO/Users/UserInfo.cs` (userId, firstName, lastName, email, hasPassword, hasGoogle, canLogin, createdByUserId, createdAt)
- [X] T024 [P] [US1] Criar `backend/Finami.Infra.Interfaces/Repository/IUserRepository.cs` (`GetByIdAsync`, `GetByEmailAsync`, `GetByGoogleSubjectAsync`, `ExistsEmailAsync(string email, long? exceptUserId)`, `InsertAsync`, `UpdateAsync`, `ListCreatedByAsync(long userId)`)
- [X] T025 [P] [US1] Criar `backend/Finami.Infra.Interfaces/AppServices/IGoogleTokenAppService.cs` com `Task<TPayload> ValidateAsync(string idToken)` genérico, e o DTO `backend/Finami.DTO/Auth/GoogleUserPayload.cs` (Subject, Email, EmailVerified, GivenName, FamilyName)
- [X] T026 [US1] Configurar `User` em `backend/Finami.Infra/Context/FinamiContext.cs`: tabela `users`, colunas conforme data-model.md, índice único parcial em `email` (`HasFilter("email IS NOT NULL")`) e em `google_subject`, FK auto-referente `fk_user_created_user` (`created_by_user_id`, ClientSetNull)
- [X] T027 [P] [US1] Implementar `backend/Finami.Infra/Repository/UserRepository.cs` (`IUserRepository<User>`), comparando email já normalizado em minúsculas
- [X] T028 [P] [US1] Implementar `backend/Finami.Infra/AppServices/GoogleTokenAppService.cs` com `GoogleJsonWebSignature.ValidateAsync(idToken, new ValidationSettings { Audience = [GoogleSettings.ClientId] })`; lança `UnauthorizedException` se inválido ou `EmailVerified == false` (research R-04)
- [X] T029 [P] [US1] Criar validadores em `backend/Finami.Domain/Validators/RegisterInfoValidator.cs` (nomes obrigatórios ≤ 120, email válido ≤ 254, senha ≥ 8) e `LoginInfoValidator.cs`
- [X] T030 [US1] Criar `backend/Finami.Domain/Interfaces/ITokenService.cs` e `backend/Finami.Domain/Services/TokenService.cs`: gera JWT HMAC-SHA256 com claims `sub`, `email`, `name`, `exp` = agora + `ExpirationMinutes`; retorna token e `expiresAt`
- [X] T031 [US1] Criar `backend/Finami.Domain/Interfaces/IAuthService.cs` e `backend/Finami.Domain/Services/AuthService.cs`: `RegisterAsync` (valida, email único → `ConflictException`, `PasswordHasher<User>.HashPassword`), `LoginAsync` (usuário sem email/senha ou senha inválida → `UnauthorizedException("Email ou senha inválidos.")`; rehash se `SuccessRehashNeeded`), `GoogleLoginAsync` (busca por `google_subject`, senão por email e vincula, senão cria com nomes do Google; `isNewUser`), `GetMeAsync(userId)`; mapeamento manual `User → UserInfo`
- [X] T032 [US1] Criar `backend/Finami.API/Controllers/AuthController.cs` (`[Route("api/auth")]`): 🔓 `POST register` (201), 🔓 `POST login`, 🔓 `POST google` (`[AllowAnonymous]`), `GET me` (`[Authorize]`), todos via `Execute(...)` de T020
- [X] T033 [US1] Registrar em `backend/Finami.Application/Startup.cs`: `IUserRepository<User>`, `IGoogleTokenAppService<GoogleUserPayload>`, `IPasswordHasher<User>`, `ITokenService`, `IAuthService`
- [X] T034 [US1] Gerar a migration `InitialUsers`: `dotnet ef migrations add InitialUsers --project backend/Finami.Infra --startup-project backend/Finami.API --output-dir Migrations`
- [X] T035 [P] [US1] Testes unitários em `backend/Finami.Tests/Domain/AuthServiceTests.cs` (Moq do repositório e do Google): cadastro com email duplicado → `ConflictException`; login com senha errada e usuário sem senha → mesma `UnauthorizedException`; Google cria usuário novo; Google com email existente vincula sem duplicar
- [X] T036 [P] [US1] Testes unitários em `backend/Finami.Tests/Domain/TokenServiceTests.cs`: token contém `sub`/`email` e expira em `ExpirationMinutes`

**Checkpoint**: US1 funcional e testável sozinha (MVP de identidade).

---

## Phase 4: User Story 2 - Carteiras e saldos (Priority: P1)

**Goal**: CRUD de carteiras do próprio usuário, contas de sistema, entradas e saídas externas, saldo derivado do livro-razão.

**Independent Test**: criar carteiras BRL e BTC, `POST /api/transactions/income` e `/expense`, conferir `balance` em `GET /api/wallets/{id}`; excluir carteira com lançamentos → 422; desativar → não aceita novas transações (quickstart, passos 4–5).

### Implementation for User Story 2

- [X] T037 [P] [US2] Criar `backend/Finami.Domain/Models/Account.cs` (AccountId, Kind, UserId?, GroupId?, Name, Description?, Currency, IsVirtual, IsActive, CreatedByUserId?, CreatedAt) com `IsWallet`, `Deactivate()`, `UpdateDetails(name, description, isVirtual)` (moeda imutável — FR-020), `EnsureActive()` → `BusinessRuleException`
- [X] T038 [P] [US2] Criar `backend/Finami.Domain/Models/Transaction.cs` (cabeçalho imutável, campos de data-model.md) e `backend/Finami.Domain/Models/LedgerEntry.cs` (LedgerEntryId, TransactionId, AccountId, Amount assinado, Currency, OccurredAt); `Transaction.Entries` como coleção de navegação
- [X] T039 [P] [US2] Criar DTOs em `backend/Finami.DTO/Wallets/`: `WalletInfo` (inclui balance, estimatedBrl, canControl), `WalletInsertInfo` (name, description, currency, isVirtual, ownerUserId?, groupId?), `WalletUpdateInfo`, `WalletPublicInfo`; e em `backend/Finami.DTO/Transactions/`: `IncomeInfo`/`ExpenseInfo` (walletId, amount, description?), `TransactionInfo`, `TransactionAccountInfo`, `QuoteRefInfo` (contracts/api.md)
- [X] T040 [P] [US2] Criar `backend/Finami.Infra.Interfaces/Repository/IAccountRepository.cs` (`GetByIdAsync`, `ListByOwnerAsync(userId, includeInactive)`, `GetSystemAccountAsync(AccountKind, Currency)`, `GetBalanceAsync(accountId)`, `GetBalancesAsync(IEnumerable<long>)`, `HasEntriesAsync(accountId)`, `InsertAsync`, `UpdateAsync`, `DeleteAsync`)
- [X] T041 [P] [US2] Criar `backend/Finami.Infra.Interfaces/Repository/ITransactionRepository.cs` (`InsertWithEntriesAsync(TModel)`, `GetByIdAsync` com entradas, `GetReversalOfAsync(transactionId)`) — sem update/delete
- [X] T042 [US2] Configurar em `backend/Finami.Infra/Context/FinamiContext.cs`: `accounts` (CHECK de data-model.md, FKs `fk_user_account`, `fk_group_account` — coluna `group_id` já criada, FK adicionada em US4 —, `fk_user_account_creator`), `transactions` (`numeric(20,8)`, FKs `fk_account_transaction_source`, `fk_account_transaction_destination`, `fk_user_transaction`, `fk_transaction_reversal` + índice único em `reversed_transaction_id`), `ledger_entries` (`fk_transaction_ledger_entry`, `fk_account_ledger_entry`, índice `(account_id, occurred_at)`); seed `HasData` das 6 contas de sistema (ExternalSource/ExternalSink/Exchange × BRL/BTC) com ids 1–6 e `UseIdentityByDefaultColumn` para permitir o seed
- [X] T043 [P] [US2] Implementar `backend/Finami.Infra/Repository/AccountRepository.cs` (saldo = `SUM(amount)` de `ledger_entries`, `0` se vazio)
- [X] T044 [P] [US2] Implementar `backend/Finami.Infra/Repository/TransactionRepository.cs` (insere cabeçalho e lançamentos no mesmo `SaveChangesAsync`, dentro da transação aberta pelo `IUnitOfWork`)
- [X] T045 [P] [US2] Criar validadores `backend/Finami.Domain/Validators/WalletInsertInfoValidator.cs` (nome ≤ 120, descrição ≤ 500, moeda válida) e `AmountInfoValidator.cs` (amount > 0)
- [X] T046 [US2] Criar `backend/Finami.Domain/Interfaces/IAccessPolicy.cs` e `backend/Finami.Domain/Services/AccessPolicy.cs` com `CanControlWallet(long userId, Account wallet)` (por enquanto: titular) e `EnsureCanControlWallet` → `ForbiddenException`; regra de grupo será estendida em T079
- [X] T047 [US2] Criar `backend/Finami.Domain/Interfaces/IWalletService.cs` e `backend/Finami.Domain/Services/WalletService.cs`: `CreateAsync` (sem `ownerUserId` = chamador; com `ownerUserId` ≠ chamador → `ForbiddenException` até US4), `ListAsync`, `GetAsync` (com balance e canControl), `UpdateAsync`, `DeactivateAsync`, `DeleteAsync` (422 se `HasEntriesAsync`), `GetPublicAsync` (só dados de FR-026a; sem saldo)
- [X] T048 [US2] Criar `backend/Finami.Domain/Interfaces/ILedgerService.cs` e `backend/Finami.Domain/Services/LedgerService.cs` com o núcleo `PostAsync(type, source, destination, sourceAmount, destinationAmount, quote?, description, userId, reversedId?)`: valida escala com `Money.HasValidScale`, origem ≠ destino, contas ativas; abre `IUnitOfWork`, `LockAccountsAsync` das contas de carteira envolvidas, revalida saldo da origem quando ela for carteira (`BusinessRuleException("Saldo insuficiente na carteira de origem.")`), monta 2 lançamentos (mesma moeda) ou 4 (com contas Exchange — research R-06), insere e faz commit; rollback em erro
- [X] T049 [US2] Implementar em `backend/Finami.Domain/Services/LedgerService.cs` os métodos `IncomeAsync` (ExternalSource da moeda → carteira, `ExternalIncome`) e `ExpenseAsync` (carteira → ExternalSink, `ExternalExpense`), exigindo `CanControlWallet`, e `GetAsync(transactionId, userId)` (permite se controla origem ou destino)
- [X] T050 [US2] Criar `backend/Finami.API/Controllers/WalletsController.cs` (`api/wallets`): `POST`, `GET` (filtros `ownerUserId`, `includeInactive`), `GET {id}`, `PUT {id}`, `POST {id}/deactivate`, `DELETE {id}`, `GET {id}/public`
- [X] T051 [US2] Criar `backend/Finami.API/Controllers/TransactionsController.cs` (`api/transactions`) com `POST income`, `POST expense`, `GET {id}`
- [X] T052 [US2] Registrar em `backend/Finami.Application/Startup.cs`: `IAccountRepository<Account>`, `ITransactionRepository<Transaction>`, `IAccessPolicy`, `IWalletService`, `ILedgerService`
- [X] T053 [US2] Gerar a migration `AddWalletsAndLedger`: `dotnet ef migrations add AddWalletsAndLedger --project backend/Finami.Infra --startup-project backend/Finami.API`
- [X] T054 [P] [US2] Testes unitários em `backend/Finami.Tests/Domain/MoneyTests.cs` (precisão, truncamento nunca para cima, escala inválida)
- [X] T055 [P] [US2] Testes unitários em `backend/Finami.Tests/Domain/LedgerServiceIncomeExpenseTests.cs`: entrada gera 2 lançamentos que somam 0; saída acima do saldo → `BusinessRuleException` sem inserir; carteira inativa → recusada; quem não é titular → `ForbiddenException`

**Checkpoint**: US1 + US2 funcionais; o usuário controla suas carteiras e saldos.

---

## Phase 5: User Story 3 - Transferência com compra e venda de bitcoin (Priority: P1)

**Goal**: transferir entre quaisquer carteiras (origem controlada, destino qualquer carteira ativa), convertendo BRL↔BTC na cotação atual; preview; estorno.

**Independent Test**: com Nubank (BRL, com saldo) e Ledger (BTC), `POST /api/transactions/transfer` → `type: "BtcPurchase"` com `destinationAmount = trunc8(amount / priceBrl)` e cotação gravada; venda inversa → `BtcSale`; transferência para carteira de outro usuário → `Transfer`; saldo insuficiente → 422; cotação indisponível → 503; estorno duplicado → 409 (quickstart, passos 7–11).

### Implementation for User Story 3

- [X] T056 [P] [US3] Criar `backend/Finami.Domain/Models/BtcQuote.cs` (BtcQuoteId, PriceBrl, QuotedAt, FetchedAt, Source) com `IsStale(DateTime nowUtc, TimeSpan maxAge)`
- [X] T057 [P] [US3] Criar DTOs: `backend/Finami.DTO/Quotes/BtcQuoteInfo.cs` (priceBrl, quotedAt, source, isStale), `backend/Finami.DTO/Transactions/TransferInfo.cs` (sourceWalletId, destinationWalletId, amount, description?), `TransferPreviewResult.cs` (type, sourceAmount, destinationAmount, quote), `ReverseInfo.cs` (description?)
- [X] T058 [P] [US3] Criar `backend/Finami.Infra.Interfaces/AppServices/IBtcQuoteAppService.cs` (`Task<TQuote?> FetchAsync(CancellationToken)`) e `backend/Finami.Infra.Interfaces/Repository/IBtcQuoteRepository.cs` (`InsertAsync`, `GetLatestAsync`)
- [X] T059 [US3] Configurar `btc_quotes` em `backend/Finami.Infra/Context/FinamiContext.cs` (colunas de data-model.md) e a FK `fk_btc_quote_transaction` de `transactions.btc_quote_id`
- [X] T060 [P] [US3] Implementar `backend/Finami.Infra/AppServices/BtcQuoteAppService.cs` (`HttpClient` tipado, timeout `BtcQuoteSettings.TimeoutSeconds`): CoinGecko (`bitcoin.brl`, `bitcoin.last_updated_at` → `QuotedAt`) e, em falha, Mercado Bitcoin (`[0].last`, `[0].date`); retorna `null` se ambas falharem; loga a falha
- [X] T061 [P] [US3] Implementar `backend/Finami.Infra/Repository/BtcQuoteRepository.cs`
- [X] T062 [US3] Criar `backend/Finami.Domain/Interfaces/IQuoteService.cs` e `backend/Finami.Domain/Services/QuoteService.cs`: `GetCurrentAsync()` (cache `IMemoryCache` por `CacheSeconds`; em miss chama o AppService, persiste a nova cotação; se a fonte falhar, devolve a última do banco marcada `isStale`; se não houver nenhuma → `QuoteUnavailableException`) e `GetForConversionAsync()` (lança `QuoteUnavailableException` se `IsStale(StaleAfterSeconds)` — FR-029)
- [X] T063 [US3] Implementar `TransferAsync` e `PreviewTransferAsync` em `backend/Finami.Domain/Services/LedgerService.cs`: `EnsureCanControlWallet(origem)`; destino qualquer carteira (`Kind = Wallet`) ativa; tipo decidido pelas moedas; conversão com `Money.Truncate` (compra `amount / price` em BTC, venda `amount × price` em BRL); resultado 0 → `BusinessRuleException("Valor pequeno demais para conversão.")`; grava `btc_quote_id` e `quote_price_brl`; preview não abre transação de banco
- [X] T064 [US3] Implementar `ReverseAsync(transactionId, userId, description)` em `backend/Finami.Domain/Services/LedgerService.cs`: original inexistente → 404; tipo `Reversal` → 422; já estornada → `ConflictException`; usuário precisa controlar a conta de entrada da original; posta `Reversal` com origem/destino e valores invertidos, mesma cotação, `reversed_transaction_id`; tratar violação do índice único como `ConflictException`
- [X] T065 [US3] Adicionar a `backend/Finami.API/Controllers/TransactionsController.cs`: `POST transfer`, `POST transfer/preview`, `POST {id}/reverse`; incluir `reversedByTransactionId` em `TransactionInfo`
- [X] T066 [US3] Registrar em `backend/Finami.Application/Startup.cs`: `AddHttpClient<IBtcQuoteAppService<BtcQuote>, BtcQuoteAppService>`, `IBtcQuoteRepository<BtcQuote>`, `IQuoteService`
- [X] T067 [US3] Gerar a migration `AddBtcQuotes`: `dotnet ef migrations add AddBtcQuotes --project backend/Finami.Infra --startup-project backend/Finami.API`
- [X] T068 [P] [US3] Testes unitários em `backend/Finami.Tests/Domain/LedgerServiceTransferTests.cs`: compra R$1.000 a R$500.000 → 0,00200000 BTC e 4 lançamentos somando 0 por moeda; venda 0,01 BTC → R$5.000,00; compra que trunca para 0 → recusada; cotação stale → `QuoteUnavailableException`; destino de outro usuário aceito; origem de outro usuário → `ForbiddenException`; estorno duplicado → `ConflictException`
- [X] T069 [P] [US3] Testes unitários em `backend/Finami.Tests/Infra/BtcQuoteAppServiceTests.cs` com `HttpMessageHandler` fake: parse CoinGecko; fallback para Mercado Bitcoin; ambas falham → `null`
- [X] T070 [P] [US3] Teste de integração em `backend/Finami.Tests/Integration/ConcurrentTransferTests.cs` (`[Trait("Category","Integration")]`, ignorado sem `FINAMI_TEST_DB`): 2 transferências paralelas que juntas excedem o saldo → só uma aceita; invariante SC-002 via `SELECT ... HAVING SUM(amount) <> 0` vazio

**Checkpoint**: núcleo financeiro completo (US1–US3) — MVP funcional.

---

## Phase 6: User Story 4 - Grupos familiares (Priority: P2)

**Goal**: grupos com responsável, membros, usuários sem credenciais, carteiras vinculadas a grupo controladas pelo responsável, configuração de visibilidade.

**Independent Test**: criar grupo, cadastrar Pedro sem email (`canLogin: false`), incluí-lo, criar carteira para ele vinculada ao grupo e movimentá-la como responsável; não-responsável tentando incluir membro → 403; retirar membro desvincula as carteiras dele; carteira pessoal do membro inacessível ao responsável (quickstart, passos 2–4).

### Implementation for User Story 4

- [X] T071 [P] [US4] Criar `backend/Finami.Domain/Models/Group.cs` (GroupId, Name, UserId, StatementVisibility, CreatedAt, Members) com `IsResponsible(userId)`, `Rename`, `SetVisibility`, e `backend/Finami.Domain/Models/GroupMember.cs` (GroupMemberId, GroupId, UserId, JoinedAt)
- [X] T072 [P] [US4] Criar DTOs em `backend/Finami.DTO/Groups/`: `GroupInfo`, `GroupInsertInfo` (name), `GroupUpdateInfo` (name?, statementVisibility?), `GroupMemberInfo`, `AddMemberInfo` (userId); e em `backend/Finami.DTO/Users/`: `UserInsertInfo` (firstName, lastName, email?, password?), `UserUpdateInfo`, `PasswordUpdateInfo` (currentPassword?, newPassword), `UserSummaryInfo` (userId, firstName, lastName); e `backend/Finami.DTO/Wallets/WalletGroupInfo.cs` (groupId?)
- [X] T073 [P] [US4] Criar `backend/Finami.Infra.Interfaces/Repository/IGroupRepository.cs` (`GetByIdAsync` com membros, `ListByMemberAsync(userId)`, `IsMemberAsync(groupId, userId)`, `ShareGroupAsync(userA, userB)`, `InsertAsync`, `UpdateAsync`, `AddMemberAsync`, `RemoveMemberAsync`) e estender `IAccountRepository` com `ListByGroupAsync(groupId)` e `UnlinkFromGroupAsync(groupId, ownerUserId)`
- [X] T074 [US4] Configurar em `backend/Finami.Infra/Context/FinamiContext.cs`: `groups` (`fk_user_group`, `statement_visibility` integer default 1), `group_members` (`fk_group_group_member`, `fk_user_group_member`, índice único `(group_id, user_id)`), FK `fk_group_account` em `accounts.group_id`
- [X] T075 [P] [US4] Implementar `backend/Finami.Infra/Repository/GroupRepository.cs` e os novos métodos em `backend/Finami.Infra/Repository/AccountRepository.cs`
- [X] T076 [P] [US4] Criar validadores `backend/Finami.Domain/Validators/GroupInsertInfoValidator.cs`, `UserInsertInfoValidator.cs` (email/senha opcionais; se senha informada exige email e ≥ 8), `PasswordUpdateInfoValidator.cs`
- [X] T077 [US4] Criar `backend/Finami.Domain/Interfaces/IUserService.cs` e `backend/Finami.Domain/Services/UserService.cs`: `CreateAsync` (FR-003, `CreatedByUserId` = chamador), `GetAsync` (o próprio, quem cadastrou ou grupo em comum), `UpdateAsync` e `ChangePasswordAsync` (o próprio ou quem cadastrou — FR-010/011; `currentPassword` obrigatório só quando o próprio já tem senha), `ListCreatedByMeAsync`, `SearchByEmailAsync` (exato, retorna `UserSummaryInfo`)
- [X] T078 [US4] Criar `backend/Finami.Domain/Interfaces/IGroupService.cs` e `backend/Finami.Domain/Services/GroupService.cs`: `CreateAsync` (responsável + membro na mesma operação — FR-012/016), `ListMineAsync` (com `isResponsible`), `GetAsync` (membro), `UpdateAsync` (responsável; nome e visibilidade), `AddMemberAsync` (responsável; duplicado → 409), `RemoveMemberAsync` (responsável; retirar o responsável → 422; desvincula carteiras do membro no grupo dentro de `IUnitOfWork` — FR-019d)
- [X] T079 [US4] Estender `backend/Finami.Domain/Services/AccessPolicy.cs`: `CanControlWallet` = titular **ou** responsável do grupo vinculado (FR-019b); `CanEditUserProfile` (o próprio ou `CreatedByUserId`); `EnsureGroupResponsible`
- [X] T080 [US4] Estender `backend/Finami.Domain/Services/WalletService.cs`: `CreateAsync` com `ownerUserId` ≠ chamador exige `groupId` em que o chamador é responsável e o titular é membro (FR-019c); `groupId` informado pelo próprio titular exige que ele seja membro; `SetGroupAsync` — vincular (titular membro do grupo) / desvincular (só responsável) (FR-019d); `ListAsync` passa a incluir carteiras de grupos onde o chamador é responsável e aceita filtro `groupId`
- [X] T081 [US4] Criar `backend/Finami.API/Controllers/UsersController.cs` (`api/users`: `POST`, `GET {id}`, `PUT {id}`, `PUT {id}/password`, `GET created-by-me`, `GET search?email=`) e `backend/Finami.API/Controllers/GroupsController.cs` (`api/groups`: `POST`, `GET`, `GET {id}`, `PUT {id}`, `POST {id}/members`, `DELETE {id}/members/{userId}`)
- [X] T082 [US4] Adicionar `PUT {id}/group` em `backend/Finami.API/Controllers/WalletsController.cs`
- [X] T083 [US4] Registrar em `backend/Finami.Application/Startup.cs`: `IGroupRepository<Group>`, `IUserService`, `IGroupService`
- [X] T084 [US4] Gerar a migration `AddGroups`: `dotnet ef migrations add AddGroups --project backend/Finami.Infra --startup-project backend/Finami.API`
- [X] T085 [P] [US4] Testes unitários em `backend/Finami.Tests/Domain/AccessPolicyTests.cs`: titular controla; responsável controla carteira vinculada; responsável **não** controla carteira pessoal do membro; quem cadastrou edita perfil do usuário sem login
- [X] T086 [P] [US4] Testes unitários em `backend/Finami.Tests/Domain/GroupServiceTests.cs`: não-responsável incluindo membro → `ForbiddenException`; responsável não pode sair → `BusinessRuleException`; retirar membro desvincula as carteiras dele

**Checkpoint**: gestão familiar completa; US1–US4 funcionam juntas e de forma independente.

---

## Phase 7: User Story 5 - Cotação do bitcoin (Priority: P2)

**Goal**: endpoint de cotação e valor estimado em BRL das carteiras de bitcoin.

**Independent Test**: `GET /api/quotes/btc` → `priceBrl`, `quotedAt`, `isStale: false`; com as fontes inacessíveis (URLs inválidas na config) → última conhecida com `isStale: true`, ou 503 se nunca houve cotação (quickstart, passo 6).

### Implementation for User Story 5

- [X] T087 [US5] Criar `backend/Finami.API/Controllers/QuotesController.cs` (`api/quotes`) com `GET btc` chamando `IQuoteService.GetCurrentAsync()` (depende de T062)
- [X] T088 [US5] Preencher `estimatedBrl` em `WalletInfo` nas carteiras BTC em `backend/Finami.Domain/Services/WalletService.cs` (`balance × priceBrl`, truncado em 2 casas; `null` se não houver cotação — nunca falhar a listagem por causa da cotação)
- [X] T089 [P] [US5] Testes unitários em `backend/Finami.Tests/Domain/QuoteServiceTests.cs`: cache hit não chama o AppService; fonte falha → última do banco com `isStale`; nada no banco → `QuoteUnavailableException`; `GetForConversionAsync` recusa cotação com mais de 5 min

**Checkpoint**: cotação transparente para o usuário.

---

## Phase 8: User Story 6 - Extrato por período (Priority: P2)

**Goal**: extratos por carteira, usuário e grupo, com totais por moeda, transferências internas e regras de visibilidade.

**Independent Test**: com transações em datas variadas, gerar `/api/statements/wallets/{id}`, `/users/{id}` e `/groups/{id}` e conferir `closing = opening + totalIn − totalOut` por moeda; visibilidade `ResponsibleOnly` → 403 para membro, `MembersSummary` → `detailLevel: "Summary"` sem `entries`, `AllMembers` → `Full`; `start > end` → 400 (quickstart, passos 12–13).

### Implementation for User Story 6

- [X] T090 [P] [US6] Criar DTOs em `backend/Finami.DTO/Statements/`: `StatementQuery` (start, end como `DateOnly`), `StatementResult` (scope, scopeId, start, end, detailLevel, totals, entries), `StatementTotalInfo` (currency, openingBalance, totalIn, totalOut, closingBalance), `StatementEntryInfo` (transactionId, occurredAt, type, sourceName, destinationName, currency, amount, quotePriceBrl, description, internal)
- [X] T091 [P] [US6] Criar `backend/Finami.Infra.Interfaces/Repository/ILedgerRepository.cs` (`GetOpeningBalancesAsync(IEnumerable<long> accountIds, DateTime beforeUtc)` agrupado por moeda; `ListEntriesAsync(IEnumerable<long> accountIds, DateTime fromUtc, DateTime toUtc)` trazendo cabeçalho, contas de origem/destino e cotação) e implementar `backend/Finami.Infra/Repository/LedgerRepository.cs` usando o índice `(account_id, occurred_at)`, `AsNoTracking`
- [X] T092 [US6] Estender `backend/Finami.Domain/Services/AccessPolicy.cs` com `GroupStatementAccess(userId, Group)` → `Full` (responsável, ou membro com `AllMembers`) / `Summary` (membro com `MembersSummary`) / `Denied` (FR-035/035a) e `CanViewWalletStatement` (controla a carteira, ou membro do grupo vinculado com `AllMembers`)
- [X] T093 [US6] Criar `backend/Finami.Domain/Interfaces/IStatementService.cs` e `backend/Finami.Domain/Services/StatementService.cs`: valida `start ≤ end` e período ≤ 366 dias (400); converte datas de `America/Sao_Paulo` para UTC `[start 00:00, end+1 00:00)` (research R-13/R-14); resolve o conjunto de contas por escopo (carteira; carteiras do titular — para terceiros, só as que o chamador controla; carteiras vinculadas ao grupo); calcula saldo inicial, itens por lançamento, `internal` apenas em `Transfer` de mesma moeda com as duas pontas no escopo, `totalIn`/`totalOut` excluindo internos, `closing`; `Summary` devolve `entries` vazio
- [X] T094 [US6] Criar `backend/Finami.API/Controllers/StatementsController.cs` (`api/statements`): `GET wallets/{walletId}`, `GET users/{userId}`, `GET groups/{groupId}` com `[FromQuery] start`, `end`
- [X] T095 [US6] Registrar em `backend/Finami.Application/Startup.cs`: `ILedgerRepository<LedgerEntry>`, `IStatementService`
- [X] T096 [P] [US6] Testes unitários em `backend/Finami.Tests/Domain/StatementServiceTests.cs`: saldo inicial e final corretos; transferência BRL→BRL interna ao grupo marcada `internal` e fora dos totais; compra de BTC no escopo conta como saída BRL e entrada BTC; período vazio → opening = closing; `start > end` → `ValidationException`; `MembersSummary` sem entries; `ResponsibleOnly` para membro → `ForbiddenException`

**Checkpoint**: todas as user stories funcionais.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: documentação, revisão de segurança e validação final.

- [X] T097 [P] Criar `backend/Finami.API/Finami.API.http` com o roteiro do quickstart.md (register, login, wallets, income, transfer, reverse, groups, statements) usando variáveis `@token`, `@baseUrl`
- [X] T098 [P] Adicionar comentários XML `/// <summary>` nos controllers e habilitar `IncludeXmlComments` no Swagger em `backend/Finami.API/Program.cs` e `GenerateDocumentationFile` em `backend/Finami.API/Finami.API.csproj`
- [X] T099 Revisar todos os controllers em `backend/Finami.API/Controllers/` contra contracts/api.md: `[Authorize]` presente (exceto register/login/google), rotas, status codes e respostas `ErrorResult`; e contra a constituição (Princípio VII)
- [X] T100 [P] Revisar segurança: senha e `password_hash` nunca retornados em DTOs; mensagens de login genéricas; `Jwt:Secret` sem valor real nos `appsettings*.json`; CORS aberto só em Development; logs sem tokens
- [X] T101 Rodar `dotnet build backend/Finami.sln` e `dotnet test backend/Finami.sln --filter "Category!=Integration"` e corrigir falhas
- [ ] T102 Executar o roteiro de validação de `specs/001-finami-backend-core/quickstart.md` (passos 1–14) contra um PostgreSQL acessível, incluindo a consulta de invariante SC-002
- [X] T103 [P] Gerar `backend/README.md` com a skill `readme-generator` (stack, variáveis de ambiente, migrations, execução, testes)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — **bloqueia todas as histórias**.
- **US1 (Phase 3)**: depende da Phase 2. Fornece autenticação, que todas as outras histórias usam (`[Authorize]` + `GetUserId()`).
- **US2 (Phase 4)**: depende de US1 (usuário titular e token).
- **US3 (Phase 5)**: depende de US2 (contas, `LedgerService.PostAsync`).
- **US4 (Phase 6)**: depende de US2 (carteiras para vincular); independente de US3.
- **US5 (Phase 7)**: depende de US3 (T062 `QuoteService`); pode rodar em paralelo com US4.
- **US6 (Phase 8)**: depende de US2 (lançamentos); o extrato de grupo depende de US4. Pode começar após US2 para os escopos carteira/usuário.
- **Polish (Phase 9)**: depois de todas as histórias desejadas.

### Grafo de conclusão das histórias

```text
Setup → Foundational → US1 → US2 ─┬─→ US3 ──→ US5
                                  ├─→ US4 ──┐
                                  └─────────┴─→ US6
```

### Within Each User Story

- DTOs, modelos e interfaces [P] primeiro → configuração do `FinamiContext` → repositórios/AppServices → serviços de domínio → controllers → registro no `Startup` → migration → testes.
- Tarefas que editam o mesmo arquivo (`FinamiContext.cs`, `Startup.cs`, `LedgerService.cs`, `AccessPolicy.cs`, `WalletService.cs`, `TransactionsController.cs`) **não** são [P] entre si e seguem a ordem dos IDs.

### Parallel Opportunities

- Setup: T003–T006.
- Foundational: T007–T011, T018, T019.
- US1: T022–T025; depois T027–T029; testes T035–T036.
- US2: T037–T041; depois T043–T045; testes T054–T055.
- US3: T056–T058; depois T060–T061; testes T068–T070.
- US4: T071–T073; depois T075–T076; testes T085–T086.
- Após US3: US4 e US5 em paralelo (desenvolvedores diferentes), cuidando das edições sequenciais em `Startup.cs` e `WalletService.cs`.

---

## Parallel Example: User Story 3

```text
# Modelos, DTOs e contratos juntos:
Task: "T056 Criar BtcQuote em backend/Finami.Domain/Models/BtcQuote.cs"
Task: "T057 Criar DTOs de cotação e transferência em backend/Finami.DTO/"
Task: "T058 Criar IBtcQuoteAppService e IBtcQuoteRepository em backend/Finami.Infra.Interfaces/"

# Infra em paralelo:
Task: "T060 Implementar BtcQuoteAppService em backend/Finami.Infra/AppServices/BtcQuoteAppService.cs"
Task: "T061 Implementar BtcQuoteRepository em backend/Finami.Infra/Repository/BtcQuoteRepository.cs"

# Testes em paralelo:
Task: "T068 LedgerServiceTransferTests"
Task: "T069 BtcQuoteAppServiceTests"
Task: "T070 ConcurrentTransferTests (Integration)"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup) + Phase 2 (Foundational).
2. Phase 3 (US1) → **validar**: cadastro, login e Google funcionando.
3. Phase 4 (US2) + Phase 5 (US3) → **validar**: carteiras, entradas/saídas, transferências e compra/venda de BTC. Este é o MVP funcional (as três histórias P1).

### Incremental Delivery

1. MVP (US1–US3) → demo.
2. US4 (grupos) → demo da gestão familiar.
3. US5 (cotação) → demo.
4. US6 (extratos) → demo.
5. Polish → validação completa do quickstart.

### Commits

Usar o formato do `GitVersion.yml` do repositório (skill `gitversion`): `feat(auth): ...`, `feat(wallets): ...`, `feat(ledger): ...`, `feat(groups): ...`, `feat(quotes): ...`, `feat(statements): ...`, `test(...)`, `chore(backend): ...` — um commit por tarefa ou grupo lógico.

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- [USn] mapeia a tarefa à user story da spec para rastreabilidade.
- Não executar `docker`/`docker compose` (constituição, Princípio II); usar um PostgreSQL acessível para migrations e testes de integração.
- Transações e lançamentos nunca são alterados nem apagados pela aplicação.
- Parar em cada checkpoint para validar a história de forma independente.
