---
description: "Lista de tarefas do frontend do Finami (mobile-first)"
---

# Tasks: Frontend do Finami (mobile-first)

**Input**: Documentos de design em `/specs/002-finami-frontend-mobile/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-additions.md, contracts/ui-routes.md, quickstart.md

**Tests**: incluídos. O plano (research R-15) e a constituição (Princípio IX) exigem testes de
utilitários, de componentes com `vitest-axe` e testes xUnit para as rotas novas do backend.

**Organization**: tarefas agrupadas por história de usuário; cada história é testável sozinha.

## Format: `[ID] [P?] [Story] Descrição → agente`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: história de usuário (US1…US6)
- Cada tarefa termina com o agente responsável (constituição, Princípio VIII):
  `→ ux-designer`, `→ frontend-react-developer` ou `→ dotnet-senior-developer`
- Caminhos relativos à raiz do repositório (`frontend/`, `backend/`, `docs/design/`)
- Skills obrigatórias: `react-architecture` para cada entidade (Types → Service → Context → Hook →
  provider em `main.tsx`), `react-modal` para diálogos, `react-alert` para toasts,
  `dotnet-architecture` no backend. Pastas: `src/Contexts/`, `src/Services/`, `src/hooks/`,
  `src/types/` (casing exato). Services devolvem o DTO direto e lançam `ApiError` em não-2xx
  (research R-02). Variável de API: `VITE_API_URL`.

---

## Phase 1: Setup (infraestrutura compartilhada)

**Purpose**: criar o projeto `frontend/`, a direção visual e os ícones.

- [X] T001 Criar o projeto Vite React + TypeScript em `frontend/` (`npm create vite@6 frontend -- --template react-ts`), fixar React 18.3 em `frontend/package.json` e remover os arquivos de exemplo (`src/App.css`, `src/assets/react.svg`, `public/vite.svg`) → frontend-react-developer
- [X] T002 Instalar dependências em `frontend/package.json`: `react-router-dom@6`, `i18next@25`, `react-i18next@15`, `sonner`, `@radix-ui/react-dialog`, `lucide-react`, `tailwindcss@4`, `@tailwindcss/vite`; dev: `vitest@3`, `@testing-library/react@16`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `vitest-axe`, `sharp`; scripts `dev`, `build`, `preview`, `lint`, `test`, `icons` → frontend-react-developer
- [X] T003 Configurar `frontend/vite.config.ts` com os plugins React e `@tailwindcss/vite`, `server.port = 5173` e o bloco `test` do Vitest (`environment: "jsdom"`, `setupFiles: "./src/test/setup.ts"`, `globals: true`) → frontend-react-developer
- [X] T004 [P] Configurar `frontend/tsconfig.app.json` em modo `strict` com `noUncheckedIndexedAccess` e `types: ["vitest/globals", "@testing-library/jest-dom"]`; ESLint do template em `frontend/eslint.config.js` com regra `@typescript-eslint/no-explicit-any: "error"` → frontend-react-developer
- [X] T005 [P] Criar `frontend/.env.example` (`VITE_API_URL=http://localhost:5145`, `VITE_SITE_BASENAME=`, `VITE_GOOGLE_CLIENT_ID=`), `frontend/src/vite-env.d.ts` tipando `ImportMetaEnv` com as três variáveis e `frontend/.gitignore` (`node_modules/`, `dist/`, `coverage/`, `.env`, `.env.local`, `.env.*.local`, `*.log`) → frontend-react-developer
- [X] T006 [P] Criar `frontend/src/test/setup.ts` importando `@testing-library/jest-dom/vitest`, estendendo `expect` com os matchers do `vitest-axe` e limpando `localStorage` e mocks de `fetch` após cada teste → frontend-react-developer
- [X] T007 [P] Escrever a direção visual em `docs/design/DESIGN_DIRECTION.md`: tema escuro estilo iOS, cores-semente da logo (`#380159`, `#6AE005`/`#59DE14`, `#F9F7F9`, `#02A7F4`, `#FD809B`, `#FFD007` — research R-06), pilha de fontes do sistema com números tabulares, raios, sombras, movimento com `prefers-reduced-motion` → ux-designer
- [X] T008 Gerar os tokens em `docs/design/tokens.css` como bloco `@theme` do Tailwind 4: superfícies (`--color-bg`, `--color-surface`, `--color-surface-2`, `--color-separator`), texto (`--color-text`, `--color-text-muted`), marca (`--color-brand`, `--color-accent`), semânticas (`--color-positive`, `--color-negative`, `--color-warning`, `--color-info`), cores de família (azul, rosa, amarelo), raios, espaçamentos, tamanhos de fonte (incluindo `--text-hero` para o saldo); documentar em comentário a razão de contraste de cada par texto/fundo (mínimo 4,5:1, Princípio IX) → ux-designer
- [X] T009 Especificar os componentes compartilhados em `docs/design/components.md` (TabBar, Sidebar, LargeTitleHeader, Fab, Sheet, Modal, ConfirmModal, Button, TextField, MoneyInput, SegmentedControl, Skeleton, EmptyState, ErrorState, AppIcon, Logo): anatomia, variantes, estados (hover, pressed, foco visível, disabled, loading), medidas (TabBar 49 px + safe area, Fab 56 px, alvos ≥ 44 px), comportamento abaixo e acima de 768 px e requisitos de acessibilidade de cada um → ux-designer
- [X] T010 Criar `frontend/scripts/generate-icons.mjs` (Node + `sharp`) que recorta a casa com a família de `docs/logos/logo.png` (sem o texto "Finami"; coordenadas do recorte em constantes no topo do arquivo), centraliza num quadrado com fundo `#380159` e margem de segurança iOS e grava `frontend/public/apple-touch-icon.png` (180, opaco), `frontend/public/icon-192.png` e `frontend/public/icon-512.png` (maskable), `frontend/public/favicon-32.png`, `frontend/src/assets/app-icon.png` (512) e `frontend/src/assets/logo.webp` (logo completa, largura 640); rodar `npm run icons` e conferir visualmente o recorte (research R-08) → ux-designer
- [X] T011 [P] Criar `frontend/public/manifest.webmanifest` (`name: "Finami"`, `short_name: "Finami"`, `lang: "pt-BR"`, `display: "standalone"`, `start_url: "/"`, `background_color`/`theme_color` = `--color-bg`, ícones 192/512 maskable) → ux-designer
- [X] T012 Ajustar `frontend/index.html`: `<html lang="pt-BR">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` (sem bloquear zoom), `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style="black-translucent"`, `<link rel="apple-touch-icon">`, favicon, manifest e `<title>Finami</title>` → frontend-react-developer

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**Purpose**: base comum a todas as histórias: estilos, i18n, cliente HTTP, sessão, layout,
componentes de UI e rotas.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase terminar.

- [X] T013 Criar `frontend/src/index.css` com `@import "tailwindcss";`, o bloco `@theme` copiado de `docs/design/tokens.css`, estilos base (`body` com `--color-bg`, `color-scheme: dark`, fonte do sistema, `-webkit-tap-highlight-color: transparent`), utilitários de safe area (`pb-safe`, `pt-safe` com `env(safe-area-inset-*)`), foco visível global e redução de movimento em `@media (prefers-reduced-motion: reduce)` → frontend-react-developer
- [X] T014 [P] Configurar i18n em `frontend/src/i18n/index.ts` (i18next + react-i18next, só `pt-BR`, `fallbackLng: "pt-BR"`) e criar `frontend/src/i18n/pt-BR.json` com as chaves comuns (navegação, botões, erros genéricos, rótulos de visibilidade e de tipos de transação) → frontend-react-developer
- [X] T015 [P] Criar `frontend/src/types/api.ts` com `ErrorResult`, a classe `ApiError` (`status`, `mensagem`, `erros`) e o enum `Currency` (`BRL`, `BTC`) conforme data-model §1 → frontend-react-developer
- [X] T016 Criar `frontend/src/Services/apiHelpers.ts`: `API_URL` de `import.meta.env.VITE_API_URL`, `AUTH_STORAGE_KEY = "finami:auth"`, `getHeaders(authenticated)` lendo o token da sessão, `setUnauthorizedHandler(fn)` e `handleResponse<T>(response)` que devolve o JSON (ou `undefined` em 204), chama o handler em 401 e lança `ApiError` a partir do envelope em não-2xx, com mensagem genérica quando o corpo não for JSON (research R-02/R-04) → frontend-react-developer
- [X] T017 [P] Teste de `handleResponse` em `frontend/src/Services/apiHelpers.test.ts`: 200 com JSON, 204, 400 com envelope (erros preservados), 401 chama o handler, 500 com texto puro, erro de rede → frontend-react-developer
- [X] T018 [P] Criar `frontend/src/utils/money.ts`: `formatBrl(value)`, `formatBtc(value)` (`₿` + 8 casas), `formatSigned(value, currency)` com sinal "−" explícito, `parseAmountInput(text, currency)` aceitando vírgula ou ponto e devolvendo `{ value: string \| null; error: string \| null }` (valor > 0; ≤ 2 casas BRL, ≤ 8 casas BTC) e `toCents(value)` (research R-09) → frontend-react-developer
- [X] T019 [P] Teste de `frontend/src/utils/money.test.ts`: formatação pt-BR, valores grandes, negativos com "−", parse de `"1.234,56"`, `"0,00000001"`, rejeição de `"0,001"` em BRL, de `"0"` e de texto inválido, `toCents` sem erro de ponto flutuante → frontend-react-developer
- [X] T020 [P] Criar `frontend/src/utils/dates.ts`: `todayInSaoPaulo()`, `presetPeriod(preset)` (`thisMonth`, `lastMonth`, `last30`), `validatePeriod(start, end)` (início ≤ fim, até 366 dias), `formatDate`/`formatDateTime` em `dd/MM/yyyy HH:mm` com `timeZone: "America/Sao_Paulo"` (research R-12) → frontend-react-developer
- [X] T021 [P] Teste de `frontend/src/utils/dates.test.ts` com relógio fixo (`vi.setSystemTime`): virada de mês e de ano, fuso de São Paulo perto da meia-noite UTC, limite de 366 dias → frontend-react-developer
- [X] T022 Entidade Auth (skill `react-architecture`): `frontend/src/types/auth.ts` (`AuthSession`, `AuthResult`, `LoginInfo`, `RegisterInfo`, `GoogleLoginInfo`) e `frontend/src/types/user.ts` (`UserInfo`) conforme data-model §2–3; `frontend/src/Services/authService.ts` (`login`, `register`, `loginWithGoogle`, `me` em `/api/auth/*`) → frontend-react-developer
- [X] T023 Criar `frontend/src/Contexts/AuthContext.tsx` e `frontend/src/hooks/useAuth.ts`: estado `session`, `status` (`checking` \| `anonymous` \| `authenticated`), `loading`, `error`; lê e valida `localStorage["finami:auth"]` no início (descarta expirada ou corrompida); `login`, `register`, `loginWithGoogle`, `logout`, `refreshMe`, `clearError` com `useCallback`; registra `setUnauthorizedHandler` que faz logout e marca o motivo "Sua sessão expirou" → frontend-react-developer
- [X] T024 [P] Teste de `frontend/src/Contexts/AuthContext.test.tsx`: restaura sessão válida, descarta expirada e JSON inválido, `login` grava a chave `finami:auth`, `logout` remove, 401 leva a `anonymous` com o motivo → frontend-react-developer
- [X] T025 [P] Criar os componentes base em `frontend/src/components/ui/`: `Button.tsx` (variantes primary/secondary/ghost/destructive, estado `loading` que desabilita e mostra spinner, altura ≥ 44 px), `TextField.tsx` (`<label>` associado, `aria-describedby` para erro e ajuda), `SegmentedControl.tsx` (`role="radiogroup"`, setas do teclado), `Skeleton.tsx`, `EmptyState.tsx`, `ErrorState.tsx` (mensagem + "Tentar novamente") conforme `docs/design/components.md` → frontend-react-developer
- [X] T026 [P] Criar `frontend/src/components/ui/Modal.tsx`, `Sheet.tsx` e `ConfirmModal.tsx` com `@radix-ui/react-dialog` (skill `react-modal`): `Sheet` abre de baixo com alça abaixo de 768 px e vira modal central acima; foco preso, `Esc` fecha, título obrigatório (`Dialog.Title`), animação desligada com `prefers-reduced-motion` → frontend-react-developer
- [X] T027 [P] Configurar toasts (skill `react-alert`): `<Toaster theme="dark" position="top-center" richColors />` em `frontend/src/main.tsx` e helper `frontend/src/utils/notify.ts` (`notifySuccess`, `notifyError(err)` que extrai `ApiError.mensagem` ou mensagem de rede genérica) → frontend-react-developer
- [X] T028 [P] Criar `frontend/src/components/brand/Logo.tsx` (`logo.webp` com `alt="Finami"`) e `frontend/src/components/brand/AppIcon.tsx` (`app-icon.png` com cantos de squircle `border-radius: 22.37%`, tamanhos sm/md/lg, `alt` configurável) → frontend-react-developer
- [X] T029 Criar o layout em `frontend/src/components/layout/`: `TabBar.tsx` (fixa embaixo abaixo de 768 px, fundo translúcido com `backdrop-blur`, três `NavLink` Home `/`, Carteiras `/carteiras`, Conta `/conta` com ícone + rótulo, `aria-current="page"`, safe area), `Sidebar.tsx` (≥ 768 px, 240 px, Logo + mesmas entradas), `LargeTitleHeader.tsx` (título grande, botão voltar opcional com `aria-label`, ação à direita), `Fab.tsx` (56 px, `aria-label="Novo lançamento"`, acima da TabBar no celular) e `AppShell.tsx` (TabBar/Sidebar + `<main>` com largura máxima de 720 px + `<Outlet />`; Fab via prop) → frontend-react-developer
- [X] T030 Criar `frontend/src/components/layout/RequireAuth.tsx` (status `checking` → tela de carregamento; `anonymous` → `<Navigate to="/entrar" state={{ from, reason }} />`) e `frontend/src/App.tsx` com `createBrowserRouter` (`basename` de `VITE_SITE_BASENAME`) e as rotas de `contracts/ui-routes.md`, páginas carregadas com `React.lazy` (exceto Home e Login) e `frontend/src/pages/NotFoundPage.tsx` → frontend-react-developer
- [X] T031 Montar `frontend/src/main.tsx` com `import "./i18n"`, `index.css`, `AuthProvider` envolvendo o `RouterProvider` e o `Toaster`; os demais providers entram nas histórias na ordem de data-model §10 → frontend-react-developer

**Checkpoint**: `npm run dev` abre, rotas protegidas redirecionam para `/entrar`, `npm test` passa.

---

## Phase 3: User Story 1 - Entrar e ver o saldo total (Priority: P1) 🎯 MVP

**Goal**: entrar (email/senha ou Google), criar conta e ver na Home o saldo total em reais em
destaque e as carteiras por família e depois avulsas.

**Independent Test**: com um usuário que tenha carteiras BRL e BTC (uma ligada a família), entrar
e conferir que o total = soma das carteiras BRL de que é titular + valor estimado das BTC, e que
a lista mostra a seção da família antes de "Avulsas" (quickstart 1–3 e 5).

### Design for User Story 1

- [X] T032 [US1] Criar os mockups HTML `docs/design/mockups/login.html`, `docs/design/mockups/register.html` e `docs/design/mockups/home.html` (390 px e 1440 px): logo + AppIcon no login, botão Google, BalanceHero com o total em destaque, aviso sem cotação, selo "desatualizada", WalletSection por família e "Avulsas", WalletCard (nome, moeda, saldo, selo "virtual", titular quando outro, BRL estimado nas BTC), estados vazio, carregando (skeleton) e erro → ux-designer

### Tests for User Story 1

- [X] T033 [P] [US1] Teste de `frontend/src/utils/totals.test.ts` e `frontend/src/utils/walletGrouping.test.ts`: exemplo do spec (R$ 1.000 + R$ 500 + 0,01 BTC a R$ 500.000 = R$ 6.500,00), carteira de outro titular fora do total, BTC com `estimatedBrl` nulo → `btcExcluded`, inativa ignorada, famílias em ordem alfabética pt-BR ("Praia" antes de "Silva"), "Avulsas" por último, família sem carteira não gera seção → frontend-react-developer
- [X] T034 [P] [US1] Teste de `frontend/src/pages/HomePage.test.tsx` com `fetch` simulado: total exibido, ordem das seções, aviso quando a cotação devolve 503, estado vazio com convite para criar carteira, sem violações do `axe` → frontend-react-developer
- [X] T035 [P] [US1] Teste de `frontend/src/pages/LoginPage.test.tsx`: login com sucesso navega para `state.from`, credenciais erradas mostram a mensagem e preservam o email, mensagem "Sua sessão expirou" quando `reason` vier no state, botão Google oculto sem `VITE_GOOGLE_CLIENT_ID`, sem violações do `axe` → frontend-react-developer

### Implementation for User Story 1

- [X] T036 [P] [US1] Entidade Wallet (skill `react-architecture`): `frontend/src/types/wallet.ts` (`WalletInfo`, `WalletInsertInfo`, `WalletUpdateInfo`, `WalletGroupInfo`, `WalletPublicInfo` — data-model §5) e `frontend/src/Services/walletService.ts` com todas as rotas de `/api/wallets` (`list(filters)`, `get`, `create`, `update`, `setGroup`, `deactivate`, `delete`, `getPublic`) → frontend-react-developer
- [X] T037 [P] [US1] Entidade Group (skill `react-architecture`): `frontend/src/types/group.ts` (data-model §4) e `frontend/src/Services/groupService.ts` (`list`, `get`, `create`, `update`, `addMember`, `removeMember` em `/api/groups`) → frontend-react-developer
- [X] T038 [P] [US1] Entidade Quote (skill `react-architecture`): `frontend/src/types/quote.ts` (`BtcQuoteInfo`), `frontend/src/Services/quoteService.ts` (`getBtc`), `frontend/src/Contexts/QuoteContext.tsx` (`quote`, `status` `loading`/`available`/`stale`/`unavailable`; 503 → `unavailable`; recarrega a cada 60 s só com a aba visível) e `frontend/src/hooks/useQuote.ts` → frontend-react-developer
- [X] T039 [US1] Criar `frontend/src/Contexts/WalletContext.tsx` + `frontend/src/hooks/useWallet.ts` (`wallets`, `loading`, `error`, `loadWallets`, `refreshWallets` e os métodos de data-model §10) e `frontend/src/Contexts/GroupContext.tsx` + `frontend/src/hooks/useGroup.ts` (`groups`, `loadGroups`, `getGroup`, `createGroup`, `updateGroup`, `addMember`, `removeMember`); registrar `QuoteProvider` → `GroupProvider` → `WalletProvider` em `frontend/src/main.tsx` dentro do `AuthProvider` → frontend-react-developer
- [X] T040 [P] [US1] Implementar `frontend/src/utils/totals.ts` (`computeHomeTotal(wallets, userId, quoteAvailable)` → `{ totalCents, btcExcluded }` somando em centavos só carteiras ativas do titular) e `frontend/src/utils/walletGrouping.ts` (`groupWallets(wallets, groups)` → `HomeSection[]`, famílias por `localeCompare("pt-BR")`, carteiras por nome, "Avulsas" por último) → frontend-react-developer
- [X] T041 [P] [US1] Criar `frontend/src/components/wallet/BalanceHero.tsx` (rótulo "Saldo total", valor com `--text-hero` e números tabulares, aviso de BTC fora do total com `role="status"`, cotação e horário com selo "desatualizada"), `WalletCard.tsx` (link para `/carteiras/:walletId`, alvo ≥ 44 px, `aria-label` com nome e saldo) e `WalletSection.tsx` (título da família como link para `/familias/:groupId`, "Avulsas" sem link) → frontend-react-developer
- [X] T042 [US1] Implementar `frontend/src/pages/HomePage.tsx`: carrega carteiras, famílias e cotação em paralelo, monta `BalanceHero` + seções, skeletons ao carregar, `ErrorState` com "Tentar novamente", estado vazio com botão para `/carteiras`; Fab presente (abre a folha de transação a partir da US2) → frontend-react-developer
- [X] T043 [P] [US1] Criar `frontend/src/hooks/useGoogleSignIn.ts`: carrega `https://accounts.google.com/gsi/client` sob demanda, `google.accounts.id.initialize({ client_id, callback })` e `renderButton` (tema `filled_black`, `locale: "pt-BR"`, largura do container); não faz nada sem `VITE_GOOGLE_CLIENT_ID` (research R-05) → frontend-react-developer
- [X] T044 [US1] Implementar `frontend/src/pages/LoginPage.tsx` (Logo + AppIcon, email, senha com mostrar/ocultar, "Entrar", botão Google, link para `/cadastro`, mensagem de `state.reason`, volta para `state.from` após entrar) e `frontend/src/pages/RegisterPage.tsx` (nome, sobrenome, email, senha ≥ 8 com validação de campo e erros do servidor ligados aos campos) → frontend-react-developer
- [X] T045 [US1] Adicionar ao `frontend/src/i18n/pt-BR.json` os textos de login, cadastro e Home → frontend-react-developer

**Checkpoint**: US1 funciona sozinha: entrar, continuar logado ao reabrir e ver total e carteiras.

---

## Phase 4: User Story 2 - Registrar transações pelo botão flutuante (Priority: P1)

**Goal**: botão "+" abre a folha com Entrada, Saída e Transferência (prévia de compra/venda de
bitcoin e confirmação de destino de terceiro) e os saldos se atualizam sem recarregar.

**Independent Test**: tocar no "+", lançar uma entrada de R$ 100,00 e ver o saldo da carteira e o
total da Home subirem R$ 100,00 (quickstart 6–10).

### Backend for User Story 2

- [X] T046 [US2] Em `backend/Finami.API/Program.cs`, adicionar `options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString` em `AddJsonOptions` (contracts/api-additions.md §1) → dotnet-senior-developer
- [X] T047 [P] [US2] Teste em `backend/Finami.Tests/API/JsonNumberHandlingTests.cs`: desserializar `IncomeExpenseInfo` e `TransferInfo` com `"amount": "0.00000001"` e `"amount": 1000.5` usando as mesmas `JsonSerializerOptions` da API (extrair a configuração para um método estático reutilizável em `backend/Finami.API/Extensions/JsonOptionsExtensions.cs`) → dotnet-senior-developer

### Design for User Story 2

- [X] T048 [US2] Criar o mockup `docs/design/mockups/transaction-sheet.html` com os passos da máquina de estados (data-model §6): escolha do tipo, formulário (seletor de carteira, MoneyInput com prefixo da moeda, descrição), destino "Outra carteira (código)" com cartão de confirmação do titular, prévia de compra/venda com cotação, estado bloqueado sem cotação, erro do servidor, enviando → ux-designer

### Tests for User Story 2

- [X] T049 [P] [US2] Teste de `frontend/src/components/transaction/TransactionSheet.test.tsx`: Entrada válida chama `POST /api/transactions/income` com `amount` em string e fecha com toast; `0,001` em BRL bloqueia o envio; origem = destino bloqueia; BRL→BTC chama a prévia e mostra BTC e cotação antes de confirmar; prévia 503 desabilita "Confirmar"; destino por código mostra titular e exige confirmação; 422 mantém os dados e mostra a mensagem; duplo clique envia uma vez; foco preso e `Esc` fecha; sem violações do `axe` → frontend-react-developer

### Implementation for User Story 2

- [X] T050 [P] [US2] Entidade Transaction (skill `react-architecture`): `frontend/src/types/transaction.ts` (data-model §6, `amount` como string) e `frontend/src/Services/transactionService.ts` (`income`, `expense`, `transfer`, `previewTransfer`, `reverse`, `get`) → frontend-react-developer
- [X] T051 [US2] Criar `frontend/src/Contexts/TransactionContext.tsx` + `frontend/src/hooks/useTransaction.ts` (`ledgerVersion`, `loading`, `error`; após `createIncome`/`createExpense`/`createTransfer`/`reverse` com sucesso chama `refreshWallets()` e incrementa `ledgerVersion`) e registrar `TransactionProvider` dentro do `WalletProvider` em `frontend/src/main.tsx` → frontend-react-developer
- [X] T052 [P] [US2] Criar `frontend/src/components/ui/MoneyInput.tsx`: `inputMode="decimal"`, prefixo `R$` ou `₿`, usa `parseAmountInput`, erro ligado por `aria-describedby`, fonte grande com números tabulares → frontend-react-developer
- [X] T053 [US2] Criar `frontend/src/components/transaction/TypeStep.tsx`, `FormStep.tsx` (seletor de carteiras ativas que a pessoa controla, com saldo; na Transferência, opção "Outra carteira (código)" que consulta `getPublicWallet` e mostra nome, moeda e titular; validações de data-model §6) e `PreviewStep.tsx` (valores de origem e destino, tipo Compra/Venda/Transferência, cotação e horário, titular do destino; bloqueio com aviso em 503) → frontend-react-developer
- [X] T054 [US2] Criar `frontend/src/components/transaction/TransactionSheet.tsx` implementando a máquina de estados de data-model §6 sobre o `Sheet` (prévia obrigatória quando as moedas diferem ou o destino é de terceiro; botão bloqueado durante o envio; erro do servidor no topo do passo; toast de sucesso com o valor efetivado) e a prop `defaultWalletId` → frontend-react-developer
- [X] T055 [US2] Ligar o `Fab` à `TransactionSheet` em `frontend/src/components/layout/AppShell.tsx` (estado de abertura num contexto de UI leve ou prop de rota) para as rotas `/`, `/carteiras` e `/carteiras/:walletId`, passando a carteira aberta como `defaultWalletId` no extrato → frontend-react-developer
- [X] T056 [US2] Adicionar ao `frontend/src/i18n/pt-BR.json` os textos da folha de transação e as mensagens de validação de valor → frontend-react-developer

**Checkpoint**: US1 + US2 entregam o MVP: ver saldo e lançar entradas, saídas e transferências.

---

## Phase 5: User Story 3 - Ver o extrato de uma carteira (Priority: P2)

**Goal**: tocar numa carteira abre o extrato do mês com totais e lançamentos, permite trocar o
período e estornar lançamentos.

**Independent Test**: abrir uma carteira com lançamentos e conferir que final = inicial + entradas
− saídas e a ordem do mais recente ao mais antigo (quickstart 11–13).

### Design for User Story 3

- [X] T057 [US3] Criar o mockup `docs/design/mockups/wallet-statement.html`: cabeçalho com nome, saldo e ações (editar, mais), PeriodPicker (atalhos + personalizado), StatementTotals (inicial, entradas, saídas, final), StatementEntryRow (data/hora, descrição, tipo, contraparte, valor com sinal e cor, cotação, selo "estornado"), detalhe do lançamento com "Estornar", estado vazio → ux-designer

### Tests for User Story 3

- [X] T058 [P] [US3] Teste de `frontend/src/pages/WalletStatementPage.test.tsx`: carrega o mês corrente (relógio fixo), totais e ordem dos lançamentos, troca para "Mês passado" refaz a chamada com as datas certas, período > 366 dias bloqueado, estorno confirma via `ConfirmModal` e recarrega quando `ledgerVersion` muda, 403/404 mostram estado próprio, sem violações do `axe` → frontend-react-developer

### Implementation for User Story 3

- [X] T059 [P] [US3] Entidade Statement (skill `react-architecture`): `frontend/src/types/statement.ts` (data-model §8), `frontend/src/Services/statementService.ts` (`getWallet`, `getUser`, `getGroup` com `start`/`end`), `frontend/src/Contexts/StatementContext.tsx`, `frontend/src/hooks/useStatement.ts`; registrar `StatementProvider` em `frontend/src/main.tsx` → frontend-react-developer
- [X] T060 [P] [US3] Criar `frontend/src/components/statement/PeriodPicker.tsx` (SegmentedControl com "Este mês", "Mês passado", "Últimos 30 dias", "Personalizado"; dois `input type="date"` com rótulo; erro de `validatePeriod`) → frontend-react-developer
- [X] T061 [P] [US3] Criar `frontend/src/components/statement/StatementTotals.tsx` e `frontend/src/components/statement/StatementEntryRow.tsx` (valor com `formatSigned`, cor e sinal; selo "interna" quando `internal`; cotação quando `quotePriceBrl`) → frontend-react-developer
- [X] T062 [US3] Implementar `frontend/src/pages/WalletStatementPage.tsx` (rota `/carteiras/:walletId`): `LargeTitleHeader` com voltar, saldo atual, PeriodPicker, totais, lista; ao tocar num lançamento abre `Sheet` de detalhe que busca `GET /api/transactions/{id}` e mostra "Estornar" quando a pessoa controla a carteira e o lançamento não foi estornado nem é estorno; recarrega quando `ledgerVersion` muda → frontend-react-developer
- [X] T063 [US3] Adicionar ao `frontend/src/i18n/pt-BR.json` os textos do extrato e os rótulos dos tipos de transação → frontend-react-developer

**Checkpoint**: US3 funciona com carteiras existentes, sem depender das telas de gestão.

---

## Phase 6: User Story 4 - Gerenciar carteiras e famílias (Priority: P2)

**Goal**: aba Carteiras com famílias e carteiras; criar carteira e família; gerenciar membros,
visibilidade e carteiras.

**Independent Test**: criar a família "Silva", cadastrar "Pedro" sem login, incluí-lo, criar a
carteira "Mesada" para ele e vê-la na seção "Silva" (quickstart 4–5).

### Design for User Story 4

- [X] T064 [US4] Criar os mockups `docs/design/mockups/wallets.html` (lista de famílias com selo "Responsável", carteiras por seção, inativas recolhidas, botões "Nova carteira" e "Nova família") e `docs/design/mockups/group-manage.html` (formulários de carteira e família, gestão de membros com busca por email e cadastro sem login, VisibilityPicker com as três opções e explicação, aviso ao retirar membro, editar/desativar/excluir carteira) → ux-designer

### Tests for User Story 4

- [X] T065 [P] [US4] Teste de `frontend/src/pages/WalletsPage.test.tsx`: lista famílias e carteiras, seção de inativas recolhida, criar carteira e família atualiza a lista, sem violações do `axe` → frontend-react-developer
- [X] T066 [P] [US4] Teste de `frontend/src/components/group/MemberManager.test.tsx`: ações ocultas para quem não é responsável; busca por email inclui membro; cadastro sem login + inclusão; retirar membro mostra o aviso das carteiras no `ConfirmModal`; 409 mostra "já é membro" → frontend-react-developer

### Implementation for User Story 4

- [X] T067 [P] [US4] Entidade User (skill `react-architecture`): completar `frontend/src/types/user.ts` (`UserInsertInfo`, `UserUpdateInfo`, `PasswordChangeInfo`, `UserSearchInfo`), criar `frontend/src/Services/userService.ts` (`create`, `get`, `update`, `changePassword`, `createdByMe`, `searchByEmail`), `frontend/src/Contexts/UserContext.tsx`, `frontend/src/hooks/useUser.ts`; registrar `UserProvider` em `frontend/src/main.tsx` → frontend-react-developer
- [X] T068 [P] [US4] Criar `frontend/src/components/wallet/WalletForm.tsx` (nome, descrição, moeda com SegmentedControl só na criação, virtual com switch acessível, família opcional entre as da pessoa, titular entre os membros quando a pessoa é responsável da família escolhida; validações de data-model §5) → frontend-react-developer
- [X] T069 [P] [US4] Criar `frontend/src/components/group/GroupForm.tsx` (nome) e `frontend/src/components/group/VisibilityPicker.tsx` (três opções com descrição, `role="radiogroup"`) → frontend-react-developer
- [X] T070 [US4] Criar `frontend/src/components/group/MemberManager.tsx`: lista de membros; para o responsável, incluir por email (`searchByEmail` exato) ou "Cadastrar pessoa sem login" (`createUser` + `addMember`), retirar com `ConfirmModal` avisando que as carteiras dele saem da família; nada disso renderizado para quem não é responsável (FR-028) → frontend-react-developer
- [X] T071 [US4] Implementar `frontend/src/pages/WalletsPage.tsx` (rota `/carteiras`): famílias (link para `/familias/:groupId`, selo "Responsável"), carteiras por seção como na Home, inativas recolhidas (`includeInactive=true`), botões "Nova carteira" e "Nova família" abrindo `Sheet` com `WalletForm`/`GroupForm`, convite para criar a primeira família quando não houver → frontend-react-developer
- [X] T072 [US4] Adicionar ações de carteira em `frontend/src/pages/WalletStatementPage.tsx` (menu do cabeçalho, só com `canControl`): editar (`WalletForm` sem moeda), vincular/desvincular família conforme FR-026, desativar e excluir com `ConfirmModal`; 422 na exclusão explica e oferece desativar → frontend-react-developer
- [X] T073 [US4] Criar a seção de gestão em `frontend/src/pages/GroupPage.tsx` (rota `/familias/:groupId`, versão inicial): cabeçalho com nome, renomear e `VisibilityPicker` (só responsável), `MemberManager`, botão "Nova carteira nesta família" → frontend-react-developer
- [X] T074 [US4] Adicionar ao `frontend/src/i18n/pt-BR.json` os textos de carteiras, famílias, membros e visibilidade → frontend-react-developer

**Checkpoint**: US4 funciona sozinha: famílias e carteiras podem ser criadas e mantidas.

---

## Phase 7: User Story 5 - Saldo por membro da família (Priority: P3)

**Goal**: tocar numa família mostra o total e o saldo de cada membro; tocar num membro mostra as
carteiras dele em todas as famílias visíveis, sempre respeitando a visibilidade.

**Independent Test**: família "Silva" com Ana R$ 300,00 e Pedro R$ 100,00 mostra os dois e o total
R$ 400,00; tocar em Pedro mostra as carteiras dele (quickstart 14–17).

### Backend for User Story 5

- [X] T075 [P] [US5] Criar os DTOs em `backend/Finami.DTO/Balances/BalanceDtos.cs` (`GroupBalancesResult`, `MemberBalanceInfo`, `WalletBalanceInfo`, `UserGroupBalancesResult`, `UserGroupBalanceInfo`, `BalanceQuoteInfo`, enum `DetailLevel` `Full`/`Summary`/`Hidden`) com `[JsonPropertyName]` camelCase em todas as propriedades (contracts/api-additions.md §2–3) → dotnet-senior-developer
- [X] T076 [US5] Escrever `backend/Finami.Tests/Domain/BalanceServiceTests.cs` (antes da implementação) com os cenários de "Testes esperados" de contracts/api-additions.md: responsável `Full` nas três visibilidades; membro `AllMembers` → `Full`, `MembersSummary` → `Summary` sem carteiras, `ResponsibleOnly` → `Hidden` com valores nulos; não membro → `NotFoundException`; usuário sem grupo visível → `NotFoundException`; o próprio sem grupos → lista vazia; inativas e de outro grupo fora das somas; sem cotação → `btcExcluded` e totais só BRL; membro sem carteira com zero → dotnet-senior-developer
- [X] T077 [US5] Criar `backend/Finami.Domain/Interfaces/IBalanceService.cs` e `backend/Finami.Domain/Services/BalanceService.cs` (skill `dotnet-architecture`): `GetGroupBalancesAsync(userId, groupId)` e `GetUserGroupBalancesAsync(viewerId, userId)` usando os repositórios de grupo, conta e lançamentos e o `IQuoteService` (aceita cotação desatualizada, sinaliza `isStale`); `estimatedBrl` truncado em 2 casas como em `WalletInfo`; regras de `detailLevel` e ordenação do contrato; registrar em `backend/Finami.Application/Startup.cs` → dotnet-senior-developer
- [X] T078 [US5] Adicionar `GET api/groups/{groupId:long}/balances` em `backend/Finami.API/Controllers/GroupsController.cs` e `GET api/users/{userId:long}/group-balances` em `backend/Finami.API/Controllers/UsersController.cs`, ambos via `Execute(...)` do `FinamiControllerBase` com `[Authorize]` herdado e comentários XML; rodar `dotnet build` e `dotnet test` em `backend/` → dotnet-senior-developer
- [X] T079 [US5] Documentar as duas rotas em `specs/001-finami-backend-core/contracts/api.md` (seção Groups/Users, apontando para contracts/api-additions.md) e adicionar chamadas de exemplo em `backend/Finami.API/Finami.API.http` → dotnet-senior-developer

### Design for User Story 5

- [X] T080 [US5] Criar os mockups `docs/design/mockups/group.html` (total da família, MemberRow com avatar de iniciais na cor de apoio, nome, selo "Responsável", total em BRL e detalhe BRL/BTC; variantes `Full`, `Summary` e `Hidden` com a explicação) e `docs/design/mockups/member.html` (total do membro e carteiras agrupadas por família; família `Summary` sem carteiras) → ux-designer

### Tests for User Story 5

- [X] T081 [P] [US5] Teste de `frontend/src/pages/GroupPage.test.tsx` e `frontend/src/pages/MemberPage.test.tsx`: para `Full`, `Summary` e `Hidden` exibe exatamente o que o servidor mandou (sem valores em `Hidden`, sem carteiras em `Summary`), carteira com `canViewStatement=false` não vira link, 404 no membro mostra "Não encontrado", sem violações do `axe` → frontend-react-developer

### Implementation for User Story 5

- [X] T082 [P] [US5] Entidade Balance (skill `react-architecture`): `frontend/src/types/balance.ts` (data-model §9), `frontend/src/Services/balanceService.ts` (`getGroupBalances`, `getUserGroupBalances`), `frontend/src/Contexts/BalanceContext.tsx`, `frontend/src/hooks/useBalance.ts`; registrar `BalanceProvider` por último em `frontend/src/main.tsx` → frontend-react-developer
- [X] T083 [P] [US5] Criar `frontend/src/components/group/MemberRow.tsx` (link para `/pessoas/:userId`, iniciais com cor de apoio por posição, nome, selo "Responsável", total ou "—" quando `null`, `aria-label` completo) → frontend-react-developer
- [X] T084 [US5] Completar `frontend/src/pages/GroupPage.tsx`: total da família e lista de `MemberRow` a partir de `GET /api/groups/{id}/balances`; em `Full`, carteiras de cada membro expansíveis com link para o extrato quando `canViewStatement`; em `Hidden`, explicação "O responsável restringiu a visualização" (FR-031); aviso de BTC fora do total; recarrega quando `ledgerVersion` muda; seção de gestão da US4 mantida → frontend-react-developer
- [X] T085 [US5] Implementar `frontend/src/pages/MemberPage.tsx` (rota `/pessoas/:userId`): total do membro e grupos com suas carteiras (`WalletCard` com link só quando `canViewStatement`), famílias `Summary` só com totais, 404 → "Não encontrado"; tornar o nome da pessoa logada na aba Conta um link para a própria `/pessoas/:userId` → frontend-react-developer
- [X] T086 [US5] Adicionar ao `frontend/src/i18n/pt-BR.json` os textos de saldo por membro e das explicações de visibilidade → frontend-react-developer

**Checkpoint**: US5 respeita as três visibilidades (SC-006) com dados vindos só do servidor.

---

## Phase 8: User Story 6 - Configurações da conta (Priority: P3)

**Goal**: aba Conta com dados, senha, Google vinculado, pessoas cadastradas e sair.

**Independent Test**: alterar o sobrenome, sair, entrar de novo e ver o novo sobrenome
(quickstart 18).

### Design for User Story 6

- [X] T087 [US6] Criar o mockup `docs/design/mockups/account.html` (lista agrupada estilo Ajustes do iOS: dados pessoais, segurança com "Definir/Trocar senha", Google vinculado, "Pessoas que cadastrei", "Sair" em destrutivo) → ux-designer

### Tests for User Story 6

- [X] T088 [P] [US6] Teste de `frontend/src/pages/AccountPage.test.tsx`: editar nome atualiza a sessão; trocar senha exige a atual quando `hasPassword`; definir senha sem a atual quando só Google; sair com confirmação remove `finami:auth` e vai para `/entrar`; sem violações do `axe` → frontend-react-developer

### Implementation for User Story 6

- [X] T089 [US6] Implementar `frontend/src/pages/AccountPage.tsx` (rota `/conta`): cartão com nome e email (link para `/pessoas/:userId`), editar dados em `Sheet` (`updateUser` + `refreshMe`), senha em `Sheet` (`changePassword`, campo da senha atual só se `hasPassword`), indicação de Google vinculado, lista de `createdByMe`, "Sair" com `ConfirmModal` → frontend-react-developer
- [X] T090 [US6] Adicionar ao `frontend/src/i18n/pt-BR.json` os textos da aba Conta → frontend-react-developer

**Checkpoint**: todas as histórias funcionam de forma independente.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T091 [P] Revisão de design: comparar cada tela implementada com `docs/design/mockups/*.html` em 320, 390, 768 e 1440 px e registrar ajustes em `docs/design/REVIEW.md` (espaçamentos, estados, contraste, safe area no iPhone) → ux-designer
- [X] T092 Aplicar os ajustes de `docs/design/REVIEW.md` nos componentes em `frontend/src/components/` e `frontend/src/pages/` → frontend-react-developer
- [X] T093 [P] Passada de acessibilidade em `frontend/src/`: navegação só por teclado em todas as rotas, ordem de foco, `aria-live` nos toasts, textos alternativos, zoom 200% sem cortes, sinal "−" nos negativos (Princípio IX); corrigir o que faltar → frontend-react-developer
- [X] T094 [P] Desempenho: conferir no `npm run build` em `frontend/` que o JS inicial fica ≤ 200 KB gzip, que só Home e Login estão no bundle inicial e que a Home faz as três chamadas em paralelo (SC-001) → frontend-react-developer
- [X] T095 [P] Escrever `frontend/README.md` (stack, variáveis de ambiente, scripts, estrutura de pastas, como gerar ícones, como apontar para o backend, origem autorizada do Google) → frontend-react-developer
- [X] T096 Atualizar `backend/README.md` com as rotas de saldo por membro e a aceitação de valores em string → dotnet-senior-developer
- [X] T097 Rodar `npm run lint`, `npm test` e `npm run build` em `frontend/` e `dotnet test` em `backend/`; corrigir falhas → frontend-react-developer
- [ ] T098 Executar o roteiro de `specs/002-finami-frontend-mobile/quickstart.md` (passos 1–23) contra o backend com PostgreSQL acessível e registrar o resultado → frontend-react-developer

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências. T007 → T008 → T009 (design); T010/T011 dependem de T001.
- **Foundational (Phase 2)**: depende do Setup; T013 depende de T008. **Bloqueia todas as histórias.**
- **US1 (P1)**: depende só da Fase 2.
- **US2 (P1)**: depende da Fase 2 e das entidades Wallet/Quote da US1 (T036, T038, T039) — o seletor de carteiras usa o `WalletContext`.
- **US3 (P2)**: depende da Fase 2 e do `WalletContext` (T039); o estorno usa o `TransactionContext` (T050/T051).
- **US4 (P2)**: depende da Fase 2 e das entidades Wallet/Group (T036, T037, T039).
- **US5 (P3)**: backend (T075–T079) pode começar logo após a Fase 1; frontend depende da Fase 2, de T037/T039 e do backend pronto. T084 completa a página criada em T073.
- **US6 (P3)**: depende da Fase 2 e da entidade User (T067).
- **Polish (Phase 9)**: depois das histórias desejadas.

### Dentro de cada história

- Design (`ux-designer`) → testes (falham primeiro) → Types/Service → Context/Hook → componentes → página → i18n.
- Backend: DTOs → testes → service → controller → documentação.

### Grafo das histórias

```text
Setup ─▶ Foundational ─▶ US1 ─┬─▶ US2 ─▶ US3
                              ├─▶ US4 ─▶ US5 (+ backend T075–T079)
                              └─▶ US6 (após T067 da US4)
```

## Parallel Opportunities

- Fase 1: T004, T005, T006 em paralelo; T007–T011 (ux-designer) em paralelo com T001–T006.
- Fase 2: T014, T015, T018–T021, T025–T028 em paralelo depois de T013/T016.
- Backend da US2 (T046–T047) e da US5 (T075–T079) podem ser feitos pelo `dotnet-senior-developer` enquanto o frontend faz Fase 2 e US1.
- Mockups de cada história (T032, T048, T057, T064, T080, T087) podem ser feitos pelo `ux-designer` de uma vez, logo após T009.

### Exemplo — US1

```text
# Em paralelo (arquivos diferentes):
T033 testes de totals/walletGrouping
T034 teste da HomePage
T035 teste da LoginPage
T036 entidade Wallet
T037 entidade Group
T038 entidade Quote
# Depois:
T039 Contexts Wallet/Group → T040/T041 → T042 HomePage → T043/T044 Login
```

### Exemplo — US5

```text
# dotnet-senior-developer: T075 → T076 → T077 → T078 → T079
# ux-designer (em paralelo): T080
# frontend-react-developer (depois do backend): T081, T082, T083 em paralelo → T084 → T085 → T086
```

## Implementation Strategy

### MVP First (US1 + US2)

1. Fase 1 e Fase 2.
2. US1 → validar: entrar e ver total e carteiras.
3. US2 → validar: lançar entrada/saída/transferência e ver saldos mudarem.
4. **PARAR e validar** com o quickstart (passos 1–10). Esse é o MVP utilizável.

### Entrega incremental

1. MVP (US1 + US2).
2. US3 (extrato) → US4 (gestão de carteiras e famílias).
3. US5 (saldo por membro, com as rotas novas do backend) → US6 (conta).
4. Polish e quickstart completo.

### Equipe de agentes

- `ux-designer`: T007–T011 e todos os mockups logo no início; revisão final (T091).
- `dotnet-senior-developer`: T046–T047 e T075–T079 em paralelo com o frontend; T096.
- `frontend-react-developer`: Fase 2 e histórias em ordem de prioridade.

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- Testes de cada história devem falhar antes da implementação.
- Nunca usar `any`, `alert()` ou `window.confirm()`; confirmações via `ConfirmModal`.
- Nunca executar `docker`/`docker compose` (constituição, Princípio II).
- Commit ao fim de cada tarefa ou grupo lógico, no formato do GitVersion (`feat(frontend): …`), somente quando o usuário pedir.
