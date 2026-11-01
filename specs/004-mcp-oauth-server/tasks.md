---
description: "Task list — Servidor MCP do Finami com conexão via OAuth"
---

# Tasks: Servidor MCP do Finami com conexão via OAuth

**Input**: Design documents from `/specs/004-mcp-oauth-server/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (oauth.md, mcp-tools.md, api.md, ui.md), quickstart.md

**Tests**: incluídos — SC-003 exige verificação automatizada de autorização e isolamento em todas as ferramentas, e research R-13 define os testes.

**Organization**: tarefas agrupadas por user story; cada tarefa termina com o agente responsável (Princípio VIII).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1…US6 da spec
- Caminhos: `backend/…` (.NET, Clean Architecture) e `frontend/src/…` (React)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependência nova, configurações e design das telas.

- [X] T001 Adicionar o pacote `ModelContextProtocol.AspNetCore` (versão estável mais recente compatível com `net8.0`, confirmada no NuGet e fixada) em `backend/Finami.API/Finami.API.csproj` e confirmar `dotnet build backend/Finami.sln` → dotnet-senior-developer
- [X] T002 [P] Criar `McpSettings` (`PublicUrl`, `AccessTokenMinutes=60`, `RefreshTokenDays=30`, `CodeMinutes=10`, `RateLimitPerMinute=60`) e `AppSettings` (`PublicUrl`) em `backend/Finami.DTO/Settings/McpSettings.cs` e `backend/Finami.DTO/Settings/AppSettings.cs`; adicionar as seções `Mcp` e `App` em `backend/Finami.API/appsettings.json`, `appsettings.Development.json` (`http://localhost:5145` / `http://localhost:5173`), `appsettings.Docker.json` e `appsettings.Production.json` (valores vazios vindos de env) → dotnet-senior-developer
- [X] T003 [P] Adicionar `Mcp__PublicUrl: ${MCP_PUBLIC_URL}` e `App__PublicUrl: ${APP_PUBLIC_URL}` em `docker-compose.yml` e `docker-compose-prod.yml` (prod: `https://${DOMAIN}`), e as variáveis em `.env.example` e `.env.prod.example` (research R-11) → dotnet-senior-developer
- [X] T004 [P] Criar mockups `docs/design/mockups/oauth-consent.html` (estados: pronto, só leitura pedida, enviando, vencido, erro de rede), `docs/design/mockups/account-connections.html` (lista, confirmação, vazio com copiar) e `docs/design/mockups/oauth-error.html`, mais a seção de componentes em `docs/design/components.md`, conforme `contracts/ui.md` e Princípio IX → ux-designer

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: entidades, tabelas, repositórios e utilitários de criptografia usados por todas as stories.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T005 [P] Criar enums `OAuthClientAuthMethod`, `OAuthGrantStatus`, `OAuthRevokeReason`, `OAuthRequestStatus`, `OAuthTokenType`, `IdempotencyStatus` em `backend/Finami.Domain/Enums/` conforme `data-model.md` → dotnet-senior-developer
- [X] T006 [P] Criar modelos `OAuthClient`, `OAuthGrant`, `OAuthAuthorizationRequest`, `OAuthToken`, `McpIdempotencyKey`, `McpAuditLog` em `backend/Finami.Domain/Models/` (skill `dotnet-architecture`) → dotnet-senior-developer
- [X] T007 Configurar as 6 tabelas no `backend/Finami.Infra/Context/FinamiContext.cs` (snake_case, `*_pkey`, FKs `fk_*` `ClientSetNull`, índices únicos `client_id`, `request_key`, `token_hash`, `code_hash` parcial, `(user_id, oauth_client_id) WHERE status = 1`, `(user_id, tool_name, idempotency_key)`, `(user_id, created_at DESC)` em auditoria) → dotnet-senior-developer
- [X] T008 Gerar a migration `AddOAuthAndMcp` em `backend/Finami.Infra/Migrations/` com `dotnet ef migrations add` e revisar o SQL gerado → dotnet-senior-developer
- [X] T009 [P] Criar interfaces de repositório (`IOAuthClientRepository`, `IOAuthGrantRepository`, `IOAuthRequestRepository`, `IOAuthTokenRepository`, `IMcpIdempotencyRepository`, `IMcpAuditRepository`) em `backend/Finami.Infra.Interfaces/Repository/` com as consultas: por `client_id`, por `request_key`, por `code_hash`, por `token_hash` com conexão, conexões ativas por usuário, revogar tokens de uma conexão → dotnet-senior-developer
- [X] T010 Implementar os repositórios em `backend/Finami.Infra/Repository/` e registrar no DI em `backend/Finami.Application/Startup.cs` → dotnet-senior-developer
- [X] T011 [P] Criar `OAuthCrypto` em `backend/Finami.Domain/Services/OAuthCrypto.cs`: gerar valores aleatórios base64url com prefixo (`fmc_`, `fma_`, `fmr_`), SHA-256 hex, verificação PKCE S256 com `CryptographicOperations.FixedTimeEquals`; testes em `backend/Finami.Tests/Domain/OAuthCryptoTests.cs` (vetor do RFC 7636 apêndice B) → dotnet-senior-developer
- [X] T012 [P] Criar DTOs do protocolo (snake_case) `OAuthClientRegistrationInfo/Result`, `OAuthTokenResult`, `OAuthErrorResult`, `AuthorizationServerMetadata`, `ProtectedResourceMetadata` em `backend/Finami.DTO/OAuth/OAuthProtocolDtos.cs` e DTOs do app (camelCase) `OAuthRequestInfo`, `OAuthApproveInfo`, `OAuthRedirectResult`, `OAuthConnectionInfo`, `McpInfoResult` em `backend/Finami.DTO/OAuth/OAuthAppDtos.cs` → dotnet-senior-developer
- [X] T013 [P] Criar exceção de domínio `OAuthProtocolException` (código OAuth + descrição + status HTTP) em `backend/Finami.Domain/Exceptions/OAuthProtocolException.cs` → dotnet-senior-developer

**Checkpoint**: banco migrado com as tabelas novas; build verde.

---

## Phase 3: User Story 1 - Conectar um assistente pelo OAuth (Priority: P1) 🎯 MVP

**Goal**: o assistente se registra, a pessoa autoriza no app e o assistente chama `obter_perfil`.

**Independent Test**: MCP Inspector → Quick OAuth Flow → autorizar em `/autorizar` → `tools/call obter_perfil` mostra o nome da pessoa (quickstart passos 1–4, 13–14).

### Tests for User Story 1

- [X] T014 [P] [US1] Testes de `OAuthService` em `backend/Finami.Tests/Domain/OAuthServiceTests.cs`: registro (válido, redirect http fora de loopback, >5 URIs, método sem segredo/com segredo); authorize (cliente desconhecido, redirect não registrado, loopback com outra porta aceito, sem PKCE, `plain`, escopo inválido, `resource` errado); approve (cria conexão, só leitura, write completa read, reautorização substitui escopos e revoga tokens, pedido vencido → 410); deny; token (código ok, PKCE errado, redirect diferente, código vencido, código reusado revoga conexão); refresh (rotação, reuso revoga conexão, conexão revogada, redução de escopo); revoke → dotnet-senior-developer
- [X] T015 [P] [US1] Testes do esquema `McpBearer` em `backend/Finami.Tests/Api/McpBearerHandlerTests.cs`: token válido monta claims `sub`, `grant_id`, `client_id`, `scope`; vencido, revogado, conexão revogada e JWT do app → falha; desafio 401 com `WWW-Authenticate` e `resource_metadata` → dotnet-senior-developer
- [X] T016 [P] [US1] Teste de integração em `backend/Finami.Tests/Api/McpOAuthFlowTests.cs` com `WebApplicationFactory`: `POST /mcp` sem token → 401; metadados; register → authorize (302 para `/autorizar`) → approve via `/api/oauth/requests/{key}/approve` com JWT do app → token → cliente MCP do SDK `tools/list` e `obter_perfil`; token do MCP em `/api/auth/me` → 401 → dotnet-senior-developer

### Implementation for User Story 1

- [X] T017 [US1] Implementar `IOAuthService`/`OAuthService` em `backend/Finami.Domain/Interfaces/IOAuthService.cs` e `backend/Finami.Domain/Services/OAuthService.cs`: `RegisterClientAsync`, `StartAuthorizationAsync` (valida e grava pedido, devolve `requestKey` ou erro com/sem redirect), `GetRequestAsync`, `ApproveAsync`, `DenyAsync`, `ExchangeCodeAsync`, `RefreshAsync`, `RevokeTokenAsync`, `ValidateAccessTokenAsync` — tudo em transação `IUnitOfWork` onde houver troca de estado, conforme `contracts/oauth.md` e research R-02..R-06 → dotnet-senior-developer
- [X] T018 [P] [US1] Validators FluentValidation para registro de cliente e `OAuthApproveInfo` em `backend/Finami.Domain/Validators/OAuthValidators.cs` (skill `dotnet-fluent-validation`) → dotnet-senior-developer
- [X] T019 [US1] Criar `OAuthController` em `backend/Finami.API/Controllers/OAuthController.cs` (anônimo): `GET /.well-known/oauth-authorization-server`, `GET /.well-known/oauth-protected-resource` (+ `/mcp`), `POST /oauth/register`, `GET /oauth/authorize` (302 para `{App:PublicUrl}/autorizar?pedido=` ou página HTML de erro conforme `oauth-error.html`), `POST /oauth/token` (form, `Cache-Control: no-store`, autenticação de cliente `none`/post/basic), `POST /oauth/revoke`; mapear `OAuthProtocolException` para o formato `{ error, error_description }` → dotnet-senior-developer
- [X] T020 [US1] Criar `OAuthConsentController` em `backend/Finami.API/Controllers/OAuthConsentController.cs` com `[Authorize]` (JWT do app): `GET /api/oauth/requests/{requestKey}`, `POST …/approve`, `POST …/deny`, via `FinamiControllerBase.Execute` (410 para pedido vencido) conforme `contracts/api.md` → dotnet-senior-developer
- [X] T021 [US1] Criar o esquema de autenticação `McpBearer` em `backend/Finami.API/Auth/McpBearerHandler.cs` e `backend/Finami.API/Auth/McpScopes.cs` (constantes `finami:read`/`finami:write`, helper `HasScope`), com desafio `WWW-Authenticate: Bearer resource_metadata="…"`; registrar em `backend/Finami.Application/Startup.cs` sem alterar o `JwtBearer` padrão das rotas `/api/*` → dotnet-senior-developer
- [X] T022 [US1] Criar `McpToolBase` em `backend/Finami.API/Mcp/McpToolBase.cs`: obter `userId`/`grantId` do `ClaimsPrincipal`, exigir escopo (`permissao_insuficiente`), converter `DomainException` em resultado `isError` com `{ codigo, mensagem, erros }`, fallback `erro_interno` com log, montar resultado com `structuredContent` + texto em pt-BR (`contracts/mcp-tools.md` §Regras comuns) → dotnet-senior-developer
- [X] T023 [US1] Configurar o servidor MCP em `backend/Finami.API/Mcp/McpServerSetup.cs` (`AddMcpServer().WithHttpTransport(stateless).WithToolsFromAssembly()`, `serverInfo`, `instructions` em pt-BR) e em `backend/Finami.API/Program.cs` mapear `app.MapMcp("/mcp").RequireAuthorization(McpBearer)`, com política CORS `McpPublic` (qualquer origem, sem credenciais, expõe `WWW-Authenticate`) só em `/mcp`, `/oauth/*` e `/.well-known/*` → dotnet-senior-developer
- [X] T024 [US1] Criar a ferramenta `obter_perfil` em `backend/Finami.API/Mcp/Tools/ProfileTools.cs` (`IAuthService.GetMeAsync`, `readOnlyHint`) → dotnet-senior-developer
- [X] T025 [P] [US1] Criar tipos, service e hook do pedido de autorização em `frontend/src/types/oauthRequest.ts`, `frontend/src/Services/oauthRequestService.ts` (get/approve/deny com `apiFetch`) seguindo `react-architecture` (sem Context: uso pontual na página) → frontend-react-developer
- [X] T026 [US1] Criar a página `frontend/src/pages/AuthorizePage.tsx` em `/autorizar` (fora das abas, `AuthLayout`): redireciona ao login sem sessão preservando `?pedido=`, estados carregando/pronto/enviando/vencido/erro, grupo de rádio de permissões, "Trocar de conta", Autorizar/Negar com `window.location.assign(redirectUrl)` (mockup `oauth-consent.html`, `contracts/ui.md`); registrar rota em `frontend/src/routes.tsx` → frontend-react-developer
- [X] T027 [US1] Ajustar `frontend/src/pages/LoginPage.tsx` (e o login Google) para voltar à rota de origem **com query string** após entrar, cobrindo `/autorizar?pedido=…` → frontend-react-developer
- [X] T028 [P] [US1] Adicionar textos do namespace `oauth` em `frontend/src/i18n/pt-BR.json` → frontend-react-developer
- [X] T029 [US1] Testes em `frontend/src/pages/AuthorizePage.test.tsx`: sem sessão redireciona; mostra nome/host/escopos; "Consultar" envia só `finami:read`; só-leitura pedida esconde a opção de alterações; Negar chama deny; 410 sem botões; axe sem violações → frontend-react-developer

**Checkpoint**: conexão completa com qualquer cliente MCP; `obter_perfil` funciona.

---

## Phase 4: User Story 2 - Consultar saldos, carteiras e extratos (Priority: P1)

**Goal**: ferramentas e recursos de leitura com os mesmos números do app.

**Independent Test**: `saldo_total`, `listar_carteiras`, `extrato_carteira` paginado comparados com o app (quickstart passos 5, 6, 9).

### Tests for User Story 2

- [X] T030 [P] [US2] Testes em `backend/Finami.Tests/Api/McpReadToolsTests.cs`: `saldo_total` igual ao cálculo da Home; `extrato_carteira` paginado (concatenação das páginas = extrato completo, saldos inicial/final em todas as páginas, cursor inválido → `validacao`); id de outra pessoa → `nao_encontrado`/`sem_permissao`; mapeamento de `QuoteUnavailableException` → `cotacao_indisponivel` → dotnet-senior-developer

### Implementation for User Story 2

- [X] T031 [P] [US2] Criar `McpPaging` em `backend/Finami.API/Mcp/McpPaging.cs` (limite 1–50 padrão 20; cursor base64url com período + offset; `proximoCursor`) conforme research R-12 → dotnet-senior-developer
- [X] T032 [P] [US2] Criar `backend/Finami.API/Mcp/Tools/BalanceTools.cs` com `saldo_total`, `saldos_da_familia`, `saldos_da_pessoa` → dotnet-senior-developer
- [X] T033 [P] [US2] Criar `backend/Finami.API/Mcp/Tools/WalletReadTools.cs` com `listar_carteiras`, `obter_carteira` → dotnet-senior-developer
- [X] T034 [P] [US2] Criar `backend/Finami.API/Mcp/Tools/StatementTools.cs` com `extrato_carteira`, `extrato_pessoa`, `extrato_familia` (datas `AAAA-MM-DD`, fuso America/Sao_Paulo) e `obter_lancamento` → dotnet-senior-developer
- [X] T035 [P] [US2] Criar `backend/Finami.API/Mcp/Tools/GroupReadTools.cs` com `listar_familias`, `obter_familia`, `listar_pessoas_criadas_por_mim` e `backend/Finami.API/Mcp/Tools/QuoteTools.cs` com `cotacao_bitcoin` → dotnet-senior-developer
- [X] T036 [US2] Criar recursos `finami://perfil`, `finami://carteiras`, `finami://familias` em `backend/Finami.API/Mcp/Resources/FinamiResources.cs` e registrar no `McpServerSetup` → dotnet-senior-developer

**Checkpoint**: MVP de consulta completo (US1 + US2).

---

## Phase 5: User Story 3 - Lançar receitas, despesas e transferências (Priority: P1)

**Goal**: escrita de lançamentos com escopo, idempotência e auditoria.

**Independent Test**: `registrar_despesa` com a mesma `chave_repeticao` duas vezes → um lançamento; conexão só leitura → `permissao_insuficiente` (quickstart passos 7, 8, 10).

### Tests for User Story 3

- [X] T037 [P] [US3] Testes de `McpIdempotencyService` em `backend/Finami.Tests/Domain/McpIdempotencyTests.cs`: primeira execução grava resultado; repetição devolve o mesmo; repetição em andamento → `conflito`; falha apaga a chave; 100 repetições → 1 execução do serviço → dotnet-senior-developer
- [X] T038 [P] [US3] Testes em `backend/Finami.Tests/Api/McpTransactionToolsTests.cs`: receita/despesa/transferência/estorno chamam o serviço com `userId` do token; conexão só leitura → `permissao_insuficiente` sem chamar o serviço; `BusinessRuleException` → `regra_de_negocio` com a mesma mensagem; `previa_transferencia` exige só leitura; auditoria gravada em sucesso e erro → dotnet-senior-developer

### Implementation for User Story 3

- [X] T039 [P] [US3] Implementar `IMcpIdempotencyService`/`McpIdempotencyService` em `backend/Finami.Domain/Interfaces/IMcpIdempotencyService.cs` e `backend/Finami.Domain/Services/McpIdempotencyService.cs` (insere `InProgress`, violação única → resultado gravado ou `ConflictException` "Operação em andamento, tente em instantes.", grava `result_json`, apaga em falha) → dotnet-senior-developer
- [X] T040 [P] [US3] Implementar `IMcpAuditService`/`McpAuditService` em `backend/Finami.Domain/Interfaces/IMcpAuditService.cs` e `backend/Finami.Domain/Services/McpAuditService.cs` (sem argumentos brutos nem tokens) → dotnet-senior-developer
- [X] T041 [US3] Estender `McpToolBase` em `backend/Finami.API/Mcp/McpToolBase.cs` com `ExecuteWriteAsync` (exige `finami:write`, aplica `chave_repeticao` quando informada, registra auditoria com `outcome` e `target_id`) → dotnet-senior-developer
- [X] T042 [US3] Criar `backend/Finami.API/Mcp/Tools/TransactionTools.cs` com `registrar_receita`, `registrar_despesa`, `previa_transferencia`, `registrar_transferencia`, `estornar_lancamento` (anotações e resumo com saldo novo conforme `contracts/mcp-tools.md`) → dotnet-senior-developer

**Checkpoint**: núcleo P1 completo (conectar, consultar, lançar).

---

## Phase 6: User Story 4 - Gerenciar conexões autorizadas no app (Priority: P2)

**Goal**: seção "Assistentes conectados" em Conta, com desconexão imediata.

**Independent Test**: conectar, desconectar em Conta e ver a chamada seguinte do assistente receber 401 (quickstart passos 11–12).

### Tests for User Story 4

- [X] T043 [P] [US4] Testes de `OAuthConnectionService` em `backend/Finami.Tests/Domain/OAuthConnectionServiceTests.cs`: lista só as próprias ativas; desconectar revoga conexão e tokens (validação de acesso e refresh falham); conexão de outra pessoa → 404; desconectar todos; `last_used_at` atualizado no máximo 1×/min → dotnet-senior-developer
- [X] T044 [P] [US4] Testes em `frontend/src/components/account/ConnectedAssistants.test.tsx`: lista com selo de permissão e datas; desconectar com confirmação e toast; desconectar todos; vazio com endereço e copiar; axe → frontend-react-developer

### Implementation for User Story 4

- [X] T045 [US4] Implementar `IOAuthConnectionService`/`OAuthConnectionService` em `backend/Finami.Domain/Interfaces/IOAuthConnectionService.cs` e `backend/Finami.Domain/Services/OAuthConnectionService.cs` (listar, desconectar, desconectar todos, `TouchLastUsedAsync`) e chamar `TouchLastUsedAsync` no `McpBearerHandler` → dotnet-senior-developer
- [X] T046 [US4] Adicionar ao `backend/Finami.API/Controllers/OAuthConsentController.cs`: `GET /api/oauth/connections`, `DELETE /api/oauth/connections/{id}`, `DELETE /api/oauth/connections`, `GET /api/oauth/mcp-info` → dotnet-senior-developer
- [X] T047 [P] [US4] Criar entidade `OAuthConnection` (skill `react-architecture`): `frontend/src/types/oauthConnection.ts`, `frontend/src/Services/oauthConnectionService.ts`, `frontend/src/Contexts/OAuthConnectionContext.tsx`, `frontend/src/hooks/useOAuthConnection.ts` e registrar o provider em `frontend/src/main.tsx` → frontend-react-developer
- [X] T048 [US4] Criar `frontend/src/components/account/ConnectedAssistants.tsx` (mockup `account-connections.html`, `ConfirmModal`, toasts via `react-alert`) e inserir a seção em `frontend/src/pages/AccountPage.tsx`; textos em `frontend/src/i18n/pt-BR.json` → frontend-react-developer

**Checkpoint**: pessoa controla e revoga conexões pelo app.

---

## Phase 7: User Story 5 - Família, convites e notificações pelo assistente (Priority: P2)

**Goal**: ferramentas de família/convites/notificações com as regras da feature 003.

**Independent Test**: `listar_notificacoes` + `aceitar_convite` na conta convidada → família aparece no app (quickstart passo 15).

### Tests for User Story 5

- [X] T049 [P] [US5] Testes em `backend/Finami.Tests/Api/McpGroupToolsTests.cs`: aceitar/recusar convite; não responsável convidando/retirando → `sem_permissao`; `verificar_email_para_familia` devolve os 4 status; `marcar_notificacoes_como_lidas` com 0 ou >100 ids → `validacao`; escopo de escrita exigido → dotnet-senior-developer

### Implementation for User Story 5

- [X] T050 [P] [US5] Criar `backend/Finami.API/Mcp/Tools/GroupWriteTools.cs` com `criar_familia`, `renomear_familia`, `criar_pessoa_na_familia`, `retirar_membro`, `verificar_email_para_familia` (leitura) → dotnet-senior-developer
- [X] T051 [P] [US5] Criar `backend/Finami.API/Mcp/Tools/InvitationTools.cs` com `listar_convites_da_familia` (leitura), `convidar_para_familia`, `cancelar_convite`, `aceitar_convite`, `recusar_convite` → dotnet-senior-developer
- [X] T052 [P] [US5] Criar `backend/Finami.API/Mcp/Tools/NotificationTools.cs` com `listar_notificacoes`, `contar_notificacoes_nao_lidas`, `marcar_notificacoes_como_lidas` e o recurso `finami://notificacoes/nao-lidas` em `backend/Finami.API/Mcp/Resources/FinamiResources.cs` → dotnet-senior-developer

**Checkpoint**: família e convites pelo assistente.

---

## Phase 8: User Story 6 - Gerenciar carteiras e perfil pelo assistente (Priority: P3)

**Goal**: completar a cobertura de escrita (carteiras e perfil).

**Independent Test**: `criar_carteira` BTC numa família e `atualizar_perfil`, conferindo no app.

### Tests for User Story 6

- [X] T053 [P] [US6] Testes em `backend/Finami.Tests/Api/McpWalletToolsTests.cs`: criar, atualizar, mover de família, desativar, excluir com lançamentos → mesma recusa do app; `atualizar_perfil` só altera a própria pessoa; escopo de escrita exigido → dotnet-senior-developer

### Implementation for User Story 6

- [X] T054 [P] [US6] Criar `backend/Finami.API/Mcp/Tools/WalletWriteTools.cs` com `criar_carteira`, `atualizar_carteira`, `mover_carteira_de_familia`, `desativar_carteira`, `excluir_carteira` (mesma regra do `DELETE /api/wallets/{id}`) → dotnet-senior-developer
- [X] T055 [P] [US6] Adicionar `atualizar_perfil` em `backend/Finami.API/Mcp/Tools/ProfileTools.cs` (`IUserService.UpdateAsync` com o próprio `userId`) → dotnet-senior-developer

**Checkpoint**: 38 ferramentas disponíveis.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T056 [P] Criar os prompts `resumo_do_mes`, `registrar_gasto`, `revisar_convites` em `backend/Finami.API/Mcp/Prompts/FinamiPrompts.cs` e registrar no `McpServerSetup` → dotnet-senior-developer
- [X] T057 Configurar rate limiting em `backend/Finami.API/Program.cs`: 60/min por `grant_id` em `/mcp`, 10/h por IP em `/oauth/register`, 30/min por IP em `/oauth/token`, resposta 429 com `Retry-After` (research R-09) → dotnet-senior-developer
- [X] T058 [P] Criar `backend/Finami.API/Hosted/OAuthCleanupService.cs` (`BackgroundService` horário, research R-10) e registrar no DI → dotnet-senior-developer
- [X] T059 [P] Teste de contrato em `backend/Finami.Tests/Api/McpToolsCatalogTests.cs`: `tools/list` devolve exatamente as 38 ferramentas de `contracts/mcp-tools.md`, com descrição em pt-BR, anotações `readOnlyHint`/`destructiveHint` corretas e nenhuma ferramenta de senha/conta/conexões (FR-020) → dotnet-senior-developer
- [X] T060 [P] Atualizar `Caddyfile` para encaminhar `/mcp*`, `/oauth/*` e `/.well-known/oauth-*` para `api:8080`, e incluir `MCP_PUBLIC_URL`/`APP_PUBLIC_URL` em `.github/workflows/deploy-prod.yml` → dotnet-senior-developer
- [X] T061 [P] Documentar o MCP (endereço, escopos, como conectar no Claude/Claude Code, ferramentas) em `backend/README.md` e na seção correspondente do `README.md` raiz → dotnet-senior-developer
- [X] T062 Revisão de acessibilidade e fidelidade ao mockup de `/autorizar`, seção Conta e página de erro; registrar em `docs/design/REVIEW-004.md` → ux-designer
- [X] T063 Rodar `dotnet test backend/Finami.sln`, `npm run lint`, `npm test` e `npm run build` em `frontend/` e corrigir falhas → dotnet-senior-developer / frontend-react-developer
- [X] T064 Subir homolog (`wsl --cd /mnt/c/repos/finami -e docker compose up -d --build`) e executar o roteiro de `specs/004-mcp-oauth-server/quickstart.md` com MCP Inspector e Claude Code → dotnet-senior-developer (executado por script de API — 33/33 verificações; telas no navegador, MCP Inspector e Claude Code não foram exercitados)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational (2)** → **US1 (3)** → demais stories.
- **US1** é pré-requisito de todas: traz OAuth, `McpBearer`, `McpToolBase` e o servidor MCP.
- **US2** e **US4** dependem só de US1 e podem correr em paralelo.
- **US3** depende de US1 (e usa `McpPaging` só se listar; não depende de US2).
- **US5** e **US6** dependem de US3 (usam `ExecuteWriteAsync`, idempotência e auditoria).
- **Polish** depois das stories desejadas; T059 depois de US6.

### Story Dependencies

```text
Setup → Foundational → US1 ─┬─ US2
                            ├─ US4
                            └─ US3 ─┬─ US5
                                    └─ US6 → Polish
```

### Within Each User Story

- Testes escritos antes e falhando; serviços de domínio antes de controllers/ferramentas;
  backend antes do frontend que o consome (contratos já definidos em `contracts/`).
- Frontend de US1 e US4 depende do mockup T004.

### Parallel Opportunities

- Setup: T002, T003, T004.
- Foundational: T005, T006, T009, T011, T012, T013 (T007 → T008 → T010 em sequência).
- US1: T014, T015, T016, T018, T025, T028 em paralelo; backend (T017→T019/T020/T021→T022→T023→T024) em paralelo com frontend (T026→T027→T029).
- US2: T031–T035 em paralelo (arquivos distintos).
- US3: T037–T040 em paralelo.
- US4 inteira em paralelo com US2/US3; T047 em paralelo com T045/T046.
- US5: T050–T052 em paralelo. US6: T054, T055 em paralelo.

---

## Parallel Example: User Story 2

```text
dotnet-senior-developer: T031 McpPaging.cs
dotnet-senior-developer: T032 BalanceTools.cs
dotnet-senior-developer: T033 WalletReadTools.cs
dotnet-senior-developer: T034 StatementTools.cs
dotnet-senior-developer: T035 GroupReadTools.cs + QuoteTools.cs
```

## Parallel Example: User Story 1 (backend × frontend)

```text
dotnet-senior-developer: T017 → T019 → T020 → T021 → T022 → T023 → T024
frontend-react-developer: T025 → T026 → T027 → T028 → T029
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Setup + Foundational.
2. US1: conectar e `obter_perfil` → validar com MCP Inspector.
3. US2: consultas → **MVP só leitura**, seguro para liberar primeiro.

### Incremental Delivery

1. + US3 (lançamentos) → núcleo P1 completo.
2. + US4 (gestão das conexões) → **requisito antes de produção**.
3. + US5, US6 → MCP completo (38 ferramentas).
4. Polish (prompts, rate limit, limpeza, Caddy, docs, homolog).

### Notes

- Commits no formato `fix(mcp): …` (CLAUDE.md), só quando o usuário pedir.
- Nenhuma ferramenta pode chamar repositório direto: sempre o serviço de domínio (FR-013).
- Tokens e segredos nunca em logs nem no frontend.
