# Implementation Plan: Servidor MCP do Finami com conexão via OAuth

**Branch**: `004-mcp-oauth-server` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-mcp-oauth-server/spec.md`

## Summary

Publicar um servidor **MCP** em `/mcp` para que assistentes de IA (Claude e outros) acessem a
conta do Finami em nome da pessoa, com **38 ferramentas** (18 de consulta, 20 de alteração),
4 recursos e 3 prompts, cobrindo carteiras, lançamentos, extratos, família, convites,
notificações e perfil. A conexão usa **OAuth 2.1** com o próprio Finami como servidor de
autorização: descoberta (RFC 9728/8414), registro dinâmico (RFC 7591), código + PKCE S256,
tokens opacos com rotação da renovação e revogação imediata.

Abordagem: o MCP roda **dentro do `Finami.API`** com o SDK oficial C#
(`ModelContextProtocol.AspNetCore`), em Streamable HTTP stateless; cada ferramenta chama os
**mesmos serviços de domínio** dos controllers, garantindo as mesmas regras e mensagens. O
consentimento reaproveita o login do app numa página nova `/autorizar`; a tela Conta ganha
"Assistentes conectados". Decisões em [research.md](./research.md).

## Technical Context

**Language/Version**: C# 12 / .NET 8 (backend) · TypeScript 5.8 / React 18.3 (frontend)
**Primary Dependencies**: existentes + **`ModelContextProtocol.AspNetCore`** (SDK oficial do MCP para C#, versão estável mais recente compatível com `net8.0`); `Microsoft.AspNetCore.RateLimiting` (nativo do .NET 8). Frontend sem dependências novas.
**Storage**: PostgreSQL — tabelas novas `oauth_clients`, `oauth_grants`, `oauth_authorization_requests`, `oauth_tokens`, `mcp_idempotency_keys`, `mcp_audit_logs` (migration `AddOAuthAndMcp`)
**Testing**: xUnit + Moq + FluentAssertions (unidade e integração com `WebApplicationFactory` + cliente MCP do SDK) · Vitest + Testing Library + vitest-axe · manual com MCP Inspector e Claude Code em homolog
**Target Platform**: API em container Linux atrás do Caddy (prod, HTTPS) e Docker local (homolog); clientes MCP: claude.ai, Claude Desktop, Claude Code, MCP Inspector
**Project Type**: web application (backend + frontend existentes)
**Performance Goals**: 95% das chamadas de consulta < 2 s (SC-005); validação de token = 1 consulta indexada; revogação efetiva em < 5 s (SC-004, na prática imediata)
**Constraints**: PKCE obrigatório; tokens só como hash; token do MCP ≠ JWT do app (FR-009); 60 chamadas/min por conexão; HTTPS em prod; stateless (sem sessão em memória)
**Scale/Scope**: 6 tabelas, 6 endpoints OAuth + 2 de descoberta, 6 rotas do app, 38 ferramentas, 4 recursos, 3 prompts, 1 página nova, 1 seção nova

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* — Constituição v2.0.0

| # | Princípio | Atendimento | Status |
|---|---|---|---|
| I | Skills | `dotnet-architecture` (entidades OAuth/MCP, repositórios genéricos, serviços, DI, migration), `dotnet-fluent-validation` (registro de cliente, aprovação); `react-architecture` (OAuthRequest, OAuthConnection), `react-modal`, `react-alert` | ✅ |
| II | Stack | .NET 8, EF Core, PostgreSQL, Fetch, Context API, Tailwind mantidos. Nova lib de backend (SDK MCP) não conflita com nenhuma regra ("ORM único", "sem Redux" etc.) | ✅ |
| III | Casing | `Contexts/`, `Services/`, `hooks/`, `types/` | ✅ |
| IV | Código | DTOs do app com `[JsonPropertyName]` camelCase; DTOs do protocolo OAuth com `[JsonPropertyName]` snake_case (exigido pelos RFCs) | ✅ |
| V | Banco | snake_case plural, `{entidade}_id`, `*_pkey`, `fk_*` `ClientSetNull`, timestamps sem fuso, enums `integer` | ✅ |
| VI | Segurança | Rotas do app seguem com JWT Bearer + `[Authorize]`; consentimento exige o JWT do app; nada em cookie; segredos só como hash; nada sensível no frontend. **Desvios**: segundo esquema Bearer (token opaco do MCP) e CORS aberto sem credenciais em `/mcp`, `/oauth/*` e `/.well-known/*` fora de Development | ⚠️ justificado (Complexity Tracking) |
| VII | Erros | Controllers do app via `FinamiControllerBase.Execute`. **Desvio**: endpoints `/oauth/*` devolvem o formato de erro do OAuth e ferramentas MCP devolvem `isError`, ambos com fallback de erro interno | ⚠️ justificado |
| VIII | Agentes | `ux-designer` (consentimento, seção Conta, página de erro) → `dotnet-senior-developer` (OAuth, MCP, infra) e `frontend-react-developer` (UI), contratos definidos antes em `contracts/` | ✅ |
| IX | Acessibilidade | `/autorizar` com `radiogroup` rotulado, foco inicial no título, `aria-live` nos estados, botões ≥ 44 px; confirmação via `ConfirmModal` (Radix); página de erro da API com `lang="pt-BR"` e contraste AA; testes axe | ✅ |

**Pós-design**: aprovado; desvios restritos às superfícies exigidas pelos padrões MCP/OAuth.

## Project Structure

### Documentation (this feature)

```text
specs/004-mcp-oauth-server/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (oauth.md, mcp-tools.md, api.md, ui.md)
├── checklists/requirements.md
└── tasks.md            # /speckit.tasks
```

### Source Code

```text
backend/                                                    # dotnet-senior-developer
├── Finami.Domain/Enums/ (OAuthClientAuthMethod, OAuthGrantStatus, OAuthRevokeReason,
│                         OAuthRequestStatus, OAuthTokenType, IdempotencyStatus)
├── Finami.Domain/Models/ (OAuthClient, OAuthGrant, OAuthAuthorizationRequest, OAuthToken,
│                          McpIdempotencyKey, McpAuditLog)
├── Finami.Domain/Interfaces/ (IOAuthService, IOAuthConnectionService, IMcpIdempotencyService,
│                              IMcpAuditService)
├── Finami.Domain/Services/ (OAuthService, OAuthConnectionService, OAuthCrypto,
│                            McpIdempotencyService, McpAuditService)
├── Finami.Domain/Validators/OAuthValidators.cs
├── Finami.DTO/OAuth/ (OAuthProtocolDtos.cs, OAuthAppDtos.cs)
├── Finami.DTO/Settings/ (McpSettings.cs, AppSettings.cs)
├── Finami.Infra.Interfaces/Repository/ (IOAuthClientRepository, IOAuthGrantRepository,
│                                        IOAuthRequestRepository, IOAuthTokenRepository, ...)
├── Finami.Infra/Repository/ (implementações)
├── Finami.Infra/Context/FinamiContext.cs                   # tabelas novas
├── Finami.Infra/Migrations/*_AddOAuthAndMcp.cs
├── Finami.Application/Startup.cs                           # DI, esquema McpBearer, MCP, rate limit
├── Finami.API/Auth/ (McpBearerHandler.cs, McpScopes.cs)
├── Finami.API/Controllers/ (OAuthController.cs [/oauth/*, /.well-known/*],
│                            OAuthConsentController.cs [/api/oauth/*])
├── Finami.API/Mcp/ (McpServerSetup.cs, McpToolBase.cs [escopo, erros, idempotência, auditoria],
│                    McpPaging.cs, Tools/{Profile,Balance,Wallet,Transaction,Statement,Group,
│                    Invitation,Notification,Quote}Tools.cs, Resources/FinamiResources.cs,
│                    Prompts/FinamiPrompts.cs)
├── Finami.API/Hosted/OAuthCleanupService.cs
├── Finami.API/Program.cs                                   # MapMcp("/mcp"), CORS MCP, rate limit
├── Finami.Tests/Domain/ (OAuthServiceTests, OAuthConnectionServiceTests, McpIdempotencyTests)
├── Finami.Tests/Api/ (McpBearerHandlerTests, McpToolsTests, McpOAuthFlowTests [integração])
└── appsettings*.json                                       # seções Mcp e App

frontend/src/                                               # frontend-react-developer
├── types/ (oauthRequest.ts, oauthConnection.ts)
├── Services/ (oauthRequestService.ts, oauthConnectionService.ts)
├── Contexts/OAuthConnectionContext.tsx · hooks/useOAuthConnection.ts
├── pages/AuthorizePage.tsx (+ .test.tsx)                   # /autorizar
├── components/account/ConnectedAssistants.tsx (+ .test.tsx)
├── pages/AccountPage.tsx* · routes.tsx* · main.tsx* · i18n/pt-BR.json*
└── pages/LoginPage.tsx*                                    # retorno para /autorizar com query

docs/design/mockups/ (oauth-consent.html, account-connections.html, oauth-error.html)  # ux-designer
Caddyfile* · docker-compose.yml* · docker-compose-prod.yml* · .env.example* · .env.prod.example*
.github/workflows/deploy-prod.yml*                          # variáveis novas
```
`*` = arquivo existente alterado.

**Structure Decision**: mesma estrutura web das features 001–003. O MCP fica no `Finami.API`
(camada de apresentação, como os controllers) para chamar diretamente os serviços de domínio;
regras OAuth (validação, emissão, rotação, revogação) ficam no `Finami.Domain`, testáveis sem HTTP.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| VI — segundo esquema Bearer (token opaco `McpBearer`) além do JWT | A spec exige revogação imediata (SC-004) e que o token do MCP não valha no app (FR-009) | Reusar o JWT do app viola FR-009; JWT com audiência própria não revoga na hora sem consulta ao banco |
| VI — CORS aberto (sem credenciais) em `/mcp`, `/oauth/token`, `/oauth/register`, `/oauth/revoke`, `/.well-known/*` em homolog/prod | Clientes MCP que rodam no navegador (claude.ai, MCP Inspector) precisam chamar esses endpoints de origens desconhecidas; autenticação é só por token no cabeçalho, sem cookies, então não há risco de CSRF | Lista fixa de origens quebraria clientes legítimos e novos assistentes; `/api/*` continua com a política restrita |
| VII — formato de erro do OAuth em `/oauth/*` e `isError` do MCP em vez de `500` com mensagem | RFC 6749/7591 e o protocolo MCP definem o formato de erro que os clientes interpretam | O envelope `{ sucesso, mensagem }` ou um 500 cru faria os clientes falharem a conexão; o fallback de erro interno continua registrado em log |
