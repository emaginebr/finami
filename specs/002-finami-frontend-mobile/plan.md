# Implementation Plan: Frontend do Finami (mobile-first)

**Branch**: `002-finami-frontend-mobile` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-finami-frontend-mobile/spec.md`

## Summary

Criar o frontend web do Finami em `frontend/`, mobile-first e só em tema escuro, com a paleta da
logo. No celular, navegação por barra inferior estilo iOS (Home, Carteiras, Conta); a partir de
768 px, barra lateral. Um botão flutuante abre a folha de lançamento (Entrada, Saída,
Transferência com prévia de compra/venda de bitcoin). A Home destaca o saldo total em reais e
lista as carteiras por família e depois as avulsas; carteira abre o extrato; família abre o saldo
por membro; membro abre as carteiras dele em todas as famílias visíveis.

Abordagem: SPA React + Vite + Tailwind 4 consumindo a API da feature 001; um Context por entidade
(skill `react-architecture`); ícone de app iOS gerado a partir da logo. O backend recebe duas
rotas de leitura (saldo por membro) e passa a aceitar valores numéricos em string. Trabalho
dividido entre `ux-designer`, `frontend-react-developer` e `dotnet-senior-developer`
(Princípio VIII). Detalhes em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.3, Node 22 (build); backend C# 12 / .NET 8 (ajustes)
**Primary Dependencies**: Vite 6, Tailwind CSS 4 (`@tailwindcss/vite`), React Router 6, i18next 25 + react-i18next 15, sonner, @radix-ui/react-dialog, lucide-react; dev: ESLint (template do Vite), sharp (ícones), Vitest 3, @testing-library/react 16, @testing-library/user-event, jsdom, vitest-axe
**Storage**: `localStorage` apenas para a sessão (`finami:auth`); dados vêm da API (PostgreSQL no backend)
**Testing**: Vitest + Testing Library + vitest-axe (frontend); xUnit + Moq + FluentAssertions (rotas novas do backend)
**Target Platform**: navegadores móveis (Safari iOS 16+, Chrome Android) e desktop (Chrome, Edge, Firefox, Safari); instalável na tela inicial (manifest, sem service worker)
**Project Type**: web application (frontend SPA + extensão do backend existente)
**Performance Goals**: saldo total visível em < 3 s em 4G (SC-001); JS inicial ≤ 200 KB gzip; interações a 60 fps
**Constraints**: só tema escuro; WCAG 2.1 AA (Princípio IX); 320–1920 px sem rolagem horizontal; alvos ≥ 44 px; sem cookies; sem segredos no frontend; sem `docker` local
**Scale/Scope**: 9 rotas, ~25 componentes, 8 Contexts; famílias de até dezenas de pessoas e carteiras

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* — Constituição v2.0.0

| # | Princípio | Como o plano atende | Status |
|---|---|---|---|
| I | Skills de arquitetura | `react-architecture` para Types/Service/Context/Hook de cada entidade; `react-modal` e `react-alert` para diálogos e toasts; `dotnet-architecture` para as rotas novas | ✅ (adaptação do formato de resposta em Complexity Tracking) |
| II | Stack fixa | React 18, TS 5, React Router 6, Vite 6, Tailwind 4, i18next 25, Fetch API; Context API para estado; sem Axios, Redux, MUI/Bootstrap; nenhum comando docker | ✅ |
| III | Casing de diretórios | `src/Contexts/`, `src/Services/`, `src/hooks/`, `src/types/`; imports com o casing exato | ✅ |
| IV | Convenções de código | `interface` em vez de `type`, arrow functions, `const`, componentes PascalCase, constantes UPPER_CASE (`AUTH_STORAGE_KEY`); DTOs novos do backend com `[JsonPropertyName]` | ✅ |
| V | Banco de dados | Nenhuma tabela nova; rotas novas só leem | ✅ N/A |
| VI | Autenticação e segurança | JWT Bearer; sessão em `localStorage["finami:auth"]`; nada em cookie; 401/expiração → `/entrar`; só `VITE_*` públicas; rotas novas com `[Authorize]` | ✅ |
| VII | Erros no backend | Novas actions usam `FinamiControllerBase.Execute` (exceções mapeadas; 500 com `ex.Message`) | ✅ |
| VIII | Agentes especializados | `ux-designer`: tokens, mockups, specs, ícones · `frontend-react-developer`: todo `frontend/` · `dotnet-senior-developer`: rotas de saldo e `AllowReadingFromString`; design antes do frontend; contrato da API definido neste plano antes da implementação | ✅ |
| IX | Acessibilidade | Tokens validados para 4,5:1; alvos 44 px; Radix Dialog (foco preso, `Esc`); `aria-label` nos botões de ícone; `aria-live` nos toasts; `lang="pt-BR"`; zoom não bloqueado; `prefers-reduced-motion`; sinal "−" além da cor; testes com `vitest-axe` | ✅ |

**Resultado pré-pesquisa**: aprovado. **Reavaliação pós-design (Fase 1)**: aprovado — o
data-model e os contratos não introduziram novas violações; as rotas novas seguem `[Authorize]`
e o envelope de erro, e o único desvio continua sendo o da tabela abaixo.

## Project Structure

### Documentation (this feature)

```text
specs/002-finami-frontend-mobile/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões R-01..R-18
├── data-model.md        # Fase 1 — tipos, estado, máquina de estados da folha de transação
├── quickstart.md        # Fase 1 — como rodar e validar
├── contracts/
│   ├── api-additions.md # Rotas novas do backend (saldo por membro) e números em string
│   └── ui-routes.md     # Rotas da SPA, chamadas à API e mapeamento de erros
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit.tasks — não criado aqui)
```

### Source Code (repository root)

```text
frontend/                                  # frontend-react-developer (exceto onde indicado)
├── index.html                             # lang="pt-BR", viewport-fit=cover, manifest, apple-touch-icon
├── package.json · vite.config.ts · tsconfig*.json · .env.example · README.md
├── scripts/
│   └── generate-icons.mjs                 # ux-designer — recorte da casa da logo → ícones (sharp)
├── public/                                # ux-designer — ícones gerados + manifest.webmanifest
│   ├── apple-touch-icon.png · icon-192.png · icon-512.png · favicon-32.png
│   └── manifest.webmanifest
└── src/
    ├── main.tsx                           # providers (ordem em data-model §10) + RouterProvider
    ├── App.tsx                            # rotas (contracts/ui-routes.md), lazy loading
    ├── index.css                          # Tailwind 4 + @theme com os tokens do ux-designer
    ├── i18n/ (index.ts, pt-BR.json)
    ├── assets/ (logo.webp, app-icon.png)  # ux-designer
    ├── types/ (api, auth, user, group, wallet, transaction, quote, statement, balance).ts
    ├── Services/ (apiHelpers, authService, userService, groupService, walletService,
    │              transactionService, quoteService, statementService, balanceService).ts
    ├── Contexts/ (Auth, User, Group, Wallet, Quote, Transaction, Statement, Balance)Context.tsx
    ├── hooks/ (useAuth, useUser, useGroup, useWallet, useQuote, useTransaction, useStatement,
    │           useBalance, useGoogleSignIn, useMediaQuery).ts
    ├── utils/ (money, dates, totals, walletGrouping).ts  (+ *.test.ts)
    ├── components/
    │   ├── layout/ (AppShell, TabBar, Sidebar, LargeTitleHeader, Fab, RequireAuth).tsx
    │   ├── ui/ (Modal, Sheet, ConfirmModal, Button, TextField, MoneyInput, SegmentedControl,
    │   │        Skeleton, EmptyState, ErrorState).tsx
    │   ├── brand/ (Logo, AppIcon).tsx
    │   ├── wallet/ (BalanceHero, WalletCard, WalletSection, WalletForm).tsx
    │   ├── group/ (MemberRow, GroupForm, MemberManager, VisibilityPicker).tsx
    │   ├── statement/ (PeriodPicker, StatementTotals, StatementEntryRow).tsx
    │   └── transaction/ (TransactionSheet, TypeStep, FormStep, PreviewStep).tsx
    ├── pages/ (LoginPage, RegisterPage, HomePage, WalletsPage, WalletStatementPage,
    │           GroupPage, MemberPage, AccountPage, NotFoundPage).tsx  (+ *.test.tsx)
    └── test/setup.ts                      # Testing Library + vitest-axe

docs/design/                               # ux-designer — direção visual, tokens, mockups HTML, specs
├── DESIGN_DIRECTION.md · tokens.css · components.md
└── mockups/*.html

backend/                                   # dotnet-senior-developer
├── Finami.DTO/Balances/BalanceDtos.cs     # GroupBalancesResult, MemberBalanceInfo, WalletBalanceInfo,
│                                          # UserGroupBalancesResult, UserGroupBalanceInfo
├── Finami.Domain/Interfaces/IBalanceService.cs
├── Finami.Domain/Services/BalanceService.cs
├── Finami.Application/Startup.cs          # registra IBalanceService
├── Finami.API/Program.cs                  # NumberHandling = AllowReadingFromString
├── Finami.API/Controllers/GroupsController.cs  # GET {id}/balances
├── Finami.API/Controllers/UsersController.cs   # GET {id}/group-balances
└── Finami.Tests/Domain/BalanceServiceTests.cs
```

**Structure Decision**: aplicação web com `backend/` (existente) e `frontend/` (novo) na raiz,
como já previsto no `CLAUDE.md`. Testes do frontend ficam junto do código (`*.test.ts[x]`),
padrão do Vitest. Os artefatos de design ficam em `docs/design/`, fora do código, porque o
`ux-designer` não escreve `.tsx`.

## Ordem de execução e responsáveis (Princípio VIII)

1. **Contrato** (este plano): `contracts/api-additions.md` e `contracts/ui-routes.md`.
2. Em paralelo:
   - **dotnet-senior-developer** — `BalanceService`, rotas novas, `AllowReadingFromString`, testes.
   - **ux-designer** — direção visual, tokens validados (contraste), mockups das 9 telas e da
     folha de transação, specs de componentes, ícones (`generate-icons.mjs`).
3. **frontend-react-developer** — scaffold Vite/Tailwind/i18n, tokens no `@theme`, Types →
   Services → Contexts → Hooks por entidade, layout, páginas por história (US1 → US6), testes.

## Riscos

| Risco | Mitigação |
|---|---|
| Backend sem PostgreSQL disponível localmente para teste ponta a ponta | Testes de componente com `fetch` simulado; quickstart roda contra o backend quando houver banco |
| Login Google exige origem autorizada no console do Google | `VITE_GOOGLE_CLIENT_ID` opcional; documentar `http://localhost:5173` como origem autorizada |
| Cotação indisponível derruba conversões | Prévia trata 503 e bloqueia confirmação; Home exclui BTC do total com aviso |
| Recorte do ícone a partir de PNG com fundo | Script parametrizado (coordenadas do recorte) validado pelo `ux-designer` |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Princípio I / skill `react-architecture`: Services devolvem o DTO direto e Contexts não checam `result.sucesso` em respostas 2xx | O backend (feature 001) só usa o envelope `{sucesso, mensagem, erros}` em erros; sucesso devolve o DTO puro | Envelopar todas as respostas de sucesso no backend mudaria 28 rotas e seus testes; simular `sucesso: true` no cliente seria código morto. O restante da skill (handleResponse com 401, loading/error, handleError, clearError, useCallback, export padrão) é mantido |
| Skill `react-architecture`: variável `VITE_GOBLIN_API_URL` e pastas minúsculas `contexts/`/`services/` | A constituição define `VITE_API_URL` e `Contexts/`/`Services/` | Em conflito, prevalece a constituição (Governance); a skill deve ser corrigida depois |
