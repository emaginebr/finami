# finami Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-11-03

## Active Technologies
- TypeScript 5.x, React 18.3, Node 22 (build); backend C# 12 / .NET 8 (ajustes) + Vite 6, Tailwind CSS 4 (`@tailwindcss/vite`), React Router 6, i18next 25 + react-i18next 15, sonner, @radix-ui/react-dialog, lucide-react; dev: ESLint (template do Vite), sharp (ícones), Vitest 3, @testing-library/react 16, @testing-library/user-event, jsdom, vitest-axe (002-finami-frontend-mobile)
- `localStorage` apenas para a sessão (`finami:auth`); dados vêm da API (PostgreSQL no backend) (002-finami-frontend-mobile)
- C# 12 / .NET 8 (backend) · TypeScript 5.8 / React 18.3 (frontend) + existentes — EF Core 9 + Npgsql, FluentValidation, ASP.NET Core JwtBearer; Vite 6, Tailwind 4, React Router 6, i18next, sonner, Radix Dialog, lucide-react. Nenhuma dependência nova. (003-family-member-invites)
- PostgreSQL — tabelas novas `group_invitations` e `notifications` (003-family-member-invites)
- C# 12 / .NET 8 (backend) · TypeScript 5.8 / React 18.3 (frontend) + existentes + **`ModelContextProtocol.AspNetCore`** (SDK oficial do MCP para C#, versão estável mais recente compatível com `net8.0`); `Microsoft.AspNetCore.RateLimiting` (nativo do .NET 8). Frontend sem dependências novas. (004-mcp-oauth-server)
- PostgreSQL — tabelas novas `oauth_clients`, `oauth_grants`, `oauth_authorization_requests`, `oauth_tokens`, `mcp_idempotency_keys`, `mcp_audit_logs` (migration `AddOAuthAndMcp`) (004-mcp-oauth-server)
- TypeScript 5.8 / React 18.3 (frontend); backend sem mudanças + existentes + **`vite-plugin-pwa`** (dev, compatível com Vite 6) e **`workbox-window`** 7.x (runtime, usado pelo registro do plugin); dev: **`fake-indexeddb`** (testes) (005-pwa-webapp)
- IndexedDB `finami-cache` (dados de consulta por sessão) e Cache Storage do Workbox (precache dos arquivos do build); `localStorage` só para a sessão (inalterada) e a data de dispensa do convite (005-pwa-webapp)
- C# 12 / .NET 8 (backend) · TypeScript 5.8 / React 18.3 (frontend) + as já existentes, sem dependências novas. (006-family-debts-transfers)
- PostgreSQL — sem tabelas novas; migration `AddTransactionAccountIndexes` (índices em `transactions.source_account_id`/`destination_account_id`) (006-family-debts-transfers)
- PostgreSQL. Sem tabelas novas; a migration `AddTransferKindAndDebt` traz 3 colunas (007-loan-transfer-types)

- C# 12 / .NET 8 (`net8.0`; build com SDK 9.0.309 instalado) + ASP.NET Core 8 Web API, EF Core 9.x + Npgsql.EntityFrameworkCore.PostgreSQL 9.x, Swashbuckle 8.x, Microsoft.AspNetCore.Authentication.JwtBearer 8.x, Google.Apis.Auth, Microsoft.Extensions.Identity.Core (PasswordHasher), FluentValidation (001-finami-backend-core)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

# Add commands for C# 12 / .NET 8 (`net8.0`; build com SDK 9.0.309 instalado)

## Code Style

C# 12 / .NET 8 (`net8.0`; build com SDK 9.0.309 instalado): Follow standard conventions

## Recent Changes
- 007-loan-transfer-types: Added C# 12 / .NET 8 (backend) · TypeScript 5.8 / React 18.3 (frontend) + as já existentes, sem dependências novas.
- 006-family-debts-transfers: Added C# 12 / .NET 8 (backend) · TypeScript 5.8 / React 18.3 (frontend) + as já existentes, sem dependências novas.
- 005-pwa-webapp: Added TypeScript 5.8 / React 18.3 (frontend); backend sem mudanças + existentes + **`vite-plugin-pwa`** (dev, compatível com Vite 6) e **`workbox-window`** 7.x (runtime, usado pelo registro do plugin); dev: **`fake-indexeddb`** (testes)


<!-- MANUAL ADDITIONS START -->
## Commits

- Todo commit usa o tipo `fix:` na primeira linha (com escopo opcional), ex.:
  `fix(groups): adiciona convites para família` — mesmo para funcionalidades novas.
- Não usar `feat:`, `feat(x)!:`, `major:` ou `breaking:` (no GitVersion eles sobem minor/major);
  `fix:` sobe só o patch da versão.
- Commit e push só quando o usuário pedir.
<!-- MANUAL ADDITIONS END -->
