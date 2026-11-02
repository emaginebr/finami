# Tasks: Finami como webapp instalável (PWA)

**Input**: Design documents from `/specs/005-pwa-webapp/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/offline-cache.md, contracts/ui.md, quickstart.md

**Tests**: incluídos — pedidos em research.md R-12 e nas seções "Testes esperados" dos contratos
(Vitest + Testing Library + vitest-axe + fake-indexeddb). Escrever cada teste antes da implementação
correspondente e vê-lo falhar.

**Organization**: tarefas agrupadas por história de usuário (US1 instalar · US2 offline · US3
atualização · US4 abertura rápida/aparência). Backend não muda (nenhuma tarefa para
`dotnet-senior-developer`).

**Agentes (Princípio VIII)**: tarefas marcadas 🎨 são do `ux-designer`; as demais do
`frontend-react-developer`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: história de usuário (US1..US4)
- Caminhos relativos à raiz do repositório; casing exato (`Contexts/`, `Services/`, `hooks/`, `types/`)

---

## Phase 1: Setup (Infraestrutura compartilhada)

**Purpose**: dependências, plugin PWA e tipagem

- [X] T001 Adicionar dependências em `frontend/package.json` (e `package-lock.json` via `npm install`): `vite-plugin-pwa` (devDependency, última estável compatível com Vite 6, versão fixada), `workbox-window` 7.x (dependency) e `fake-indexeddb` 6.x (devDependency)
- [X] T002 Configurar `VitePWA` em `frontend/vite.config.ts`: `registerType: "prompt"`, `injectRegister: false`, `strategies: "generateSW"`, `devOptions.enabled: false`, `workbox.globPatterns` (js, css, html, svg, png, woff2, json de i18n se houver), `workbox.navigateFallback: "/index.html"`, `workbox.navigateFallbackDenylist: [/^\/api\//, /^\/mcp/, /^\/oauth\//, /^\/\.well-known\//, /^\/health/, /^\/healthz/]`, `cleanupOutdatedCaches: true`, **sem** `runtimeCaching` para `/api`; manifest com os campos de `contracts/ui.md` §Manifest (`id: "/"`, `start_url: "/?source=pwa"`, `scope: "/"`, `display: "standalone"`, `display_override: ["standalone"]`, `lang: "pt-BR"`, `theme_color`/`background_color` `#12021C`, `categories: ["finance"]`, ícones `any` 192/512 + `maskable` 192/512, `shortcuts` "Novo lançamento" → `/?acao=novo-lancamento` e "Carteiras" → `/carteiras` com ícones 96 px, `screenshots` 2 `narrow` 1080×1920 + 1 `wide` 1920×1080 com `label` pt-BR); no `test` do Vitest, aliasar `virtual:pwa-register/react` para o mock de T005
- [X] T003 [P] Remover `frontend/public/manifest.webmanifest` e o `<link rel="manifest">` manual de `frontend/index.html` (o plugin injeta o link); manter `theme-color` `#12021C` e as metas `apple-mobile-web-app-*`
- [X] T004 [P] Declarar tipos do plugin em `frontend/src/vite-env.d.ts` (`/// <reference types="vite-plugin-pwa/react" />` e `vite-plugin-pwa/info`)
- [X] T005 [P] Criar mock de `virtual:pwa-register/react` em `frontend/src/test/pwaRegisterMock.ts` (exporta `useRegisterSW` controlável: `needRefresh`, `offlineReady`, `updateServiceWorker` como `vi.fn`) e importar `fake-indexeddb/auto` em `frontend/src/test/setup.ts`
- [X] T006 [P] Adicionar namespace/chaves `pwa` em `frontend/src/i18n/pt-BR.json` com todos os textos de `contracts/ui.md` (banner offline, "Conexão restabelecida.", aviso de versão, Atualizar/Agora não/Atualizando…, item e folha de instalação iOS, convite, "Finami instalado.", conteúdo indisponível, OfflinePage, toasts "Sem internet. Conecte-se para fazer lançamentos." / "…para fazer alterações.", "Não foi possível confirmar o lançamento. Verifique o extrato quando a conexão voltar.")

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**Purpose**: mockups/ícones do designer, cache offline, conectividade e `apiFetch` — usados por US1..US4

**⚠️ CRITICAL**: nenhuma história começa antes desta fase

- [X] T007 [P] 🎨 Criar mockup `docs/design/mockups/pwa-states.html` (reusando `mockup.css`/`tokens-root.css`) com: faixa "Sem internet · dados de …", toast "Conexão restabelecida.", faixa "Nova versão disponível" (celular e desktop), item "Instalar o Finami" na Conta, folha "Instalar no iPhone" com 3 passos ilustrados, cartão `InstallInvite` na Home, `OfflineContent`, `OfflinePage`, FAB desabilitado; e a seção §9 "PWA" em `docs/design/components.md` (cores de aviso com contraste ≥ 4,5:1, alvos 44 px, área segura, movimento reduzido)
- [X] T008 [P] 🎨 Atualizar `frontend/scripts/generate-icons.mjs` para gerar em `frontend/public/`: `icon-any-192.png`, `icon-any-512.png` (sem fundo de margem), `icon-maskable-192.png`, `icon-maskable-512.png` (zona segura 80%, fundo `#12021C`), `shortcut-new-transaction-96.png`, `shortcut-wallets-96.png`, `splash/*.png` (telas de abertura iOS para os tamanhos atuais de iPhone/iPad) e manter `apple-touch-icon.png`/`favicon-32.png`; rodar o script e versionar os PNGs; remover `icon-192.png`/`icon-512.png` antigos se não forem mais referenciados
- [X] T009 [P] Teste de `frontend/src/utils/offlineCache.test.ts` (fake-indexeddb): set/get por `{userId}:{path}`; isolamento entre usuários; `clearAll` apaga tudo; registro com `schemaVersion` diferente é ignorado e apagado; limite de 300 por usuário remove os de `fetchedAt` mais antigo; IndexedDB indisponível (`indexedDB.open` lançando) → `get` resolve `undefined` e `set`/`clearAll` resolvem sem erro
- [X] T010 Implementar `frontend/src/utils/offlineCache.ts` conforme `data-model.md` (banco `finami-cache` v1, store `responses` keyPath `key`, índice `byUser`; `OFFLINE_CACHE_SCHEMA_VERSION = 1`; `MAX_ENTRIES_PER_USER = 300`; API `get(userId, path)`, `set(userId, path, data)`, `clearAll()`; interface `CachedEntry`; falhas viram no-op; ao gravar para um `userId` diferente do último gravado, `clearAll` antes)
- [X] T011 [P] Teste de `frontend/src/utils/connectivity.test.ts`: store de conectividade fora do React — `reportOnline()`/`reportOffline()`, `subscribe`, `getStatus()`, `reportFreshness({stale, fetchedAt})` guarda o `fetchedAt` stale mais antigo da navegação atual e `resetFreshness()` limpa
- [X] T012 Implementar `frontend/src/utils/connectivity.ts` (store module-level usado pelo `apiFetch`, que não é React): estado `online | offline` inicializado com `navigator.onLine`, listeners `online`/`offline` do `window`, `reportOnline`, `reportOffline`, `reportFreshness`, `resetFreshness`, `getOldestStaleFetchedAt`, `subscribe`
- [X] T013 Testes de `apiFetch` em `frontend/src/Services/apiHelpers.test.ts` cobrindo cada linha da tabela de `contracts/offline-cache.md`: GET network-first 2xx grava e chama `onFreshness({stale:false})`; não-2xx lança e não grava; falha de rede com registro devolve stale e `reportOffline`; sem registro lança `ApiError(0, "Este conteúdo não está disponível sem internet.")` com `offline: true`; método ≠ GET com conectividade offline lança sem chamar `fetch`; rede cai durante escrita → `NETWORK_ERROR_MESSAGE` sem reenvio; `cache: "none"` com timeout de 10 s (timers falsos) e reporte de conectividade; 401 chama o handler e `offlineCache.clearAll()`; sem sessão (sem `userId`) não grava
- [X] T014 Alterar `frontend/src/Services/apiHelpers.ts`: `ApiFetchOptions.cache?: "network-first" | "none"` e `onFreshness?`; `REQUEST_TIMEOUT_MS = 10_000` combinando `AbortSignal.timeout` com o `signal` do chamador (abort do chamador continua sendo abort, não offline); qualquer resposta HTTP → `reportOnline()`; falha de rede/timeout → `reportOffline()`; network-first usa `userId` da sessão armazenada e `path` sem a URL base (com query); `ApiError` ganha `offline?: boolean`; escrita offline bloqueada antes do `fetch`; 401 → `offlineCache.clearAll()` além do handler atual
- [X] T015 [P] Teste de `frontend/src/Contexts/ConnectivityContext.test.tsx`: `showBanner` só após 2 s offline (timers falsos); oscilação < 2 s não mostra; volta online → `showBanner` false, evento `reconnected` disparado e toast "Conexão restabelecida."; evento `online` do navegador dispara um ping (`GET /api/auth/me` com `cache: "none"`) antes de declarar online
- [X] T016 Implementar `frontend/src/Contexts/ConnectivityContext.tsx` (assina o store de T012; expõe `status`, `showBanner`, `staleSince` (= `getOldestStaleFetchedAt`), `onReconnected(callback)` que devolve unsubscribe; `resetFreshness` na troca de rota) e `frontend/src/hooks/useConnectivity.ts`; registrar o provider em `frontend/src/main.tsx` acima dos providers de dados
- [X] T017 Alterar `frontend/src/Contexts/AuthContext.tsx`: `logout` e o término de sessão por 401/expiração chamam `offlineCache.clearAll()`; login de outra pessoa também limpa (via userId diferente); teste em `frontend/src/Contexts/AuthContext.test.tsx` (logout limpa IndexedDB)

**Checkpoint**: cache, conectividade e `apiFetch` prontos e testados — histórias podem começar

---

## Phase 3: User Story 1 - Instalar o Finami na tela inicial (Priority: P1) 🎯 MVP

**Goal**: app instalável (manifest + SW) com opção na Conta, folha iOS, convite na Home e atalhos

**Independent Test**: build/homolog em Chrome/Edge (desktop e Android): DevTools → Manifest sem erros; Conta → "Instalar o Finami" abre o diálogo nativo; app abre em janela própria; atalho "Novo lançamento" abre a folha (quickstart passos 1–5, 15)

### Tests for User Story 1

- [X] T018 [P] [US1] Teste de `frontend/src/Contexts/InstallContext.test.tsx`: captura `beforeinstallprompt` (com `preventDefault`) → `canPromptNative` true; `promptInstall()` chama `prompt()` e, aceito, toast "Finami instalado."; `appinstalled` → `isInstalled`; `display-mode: standalone` → `isInstalled`; iOS por user agent + `maxTouchPoints` → `isIos`; `dismissInvite()` grava `finami:install-dismissed-at` e convite fica oculto por 30 dias
- [X] T019 [P] [US1] Teste de `frontend/src/components/pwa/InstallAppItem.test.tsx` (com axe): nativo dispara `promptInstall`; iOS abre a folha "Instalar no iPhone" com 3 passos e botão "Entendi"; instalado → não renderiza; sem suporte e fora do iOS → não renderiza
- [X] T020 [P] [US1] Teste de `frontend/src/components/pwa/InstallInvite.test.tsx` (com axe): aparece uma vez quando instalável e não dispensado; botão fechar com `aria-label` "Dispensar convite de instalação" grava a data; dispensado há < 30 dias não aparece; há > 30 dias aparece
- [X] T021 [P] [US1] Teste em `frontend/src/pages/HomePage.test.tsx`: `/?acao=novo-lancamento` abre a folha de lançamento e remove o parâmetro (replace)
- [X] T022 [P] [US1] Teste de build `frontend/scripts/check-pwa-build.mjs` (rodado após `npm run build`): `dist/manifest.webmanifest` tem os campos de `contracts/ui.md`, todo ícone/screenshot/atalho referenciado existe em `dist/`, `dist/sw.js` existe e contém o denylist de `/api/`, `/mcp`, `/oauth/`, `/.well-known/`; adicionar script `"check:pwa"` em `frontend/package.json`

### Implementation for User Story 1

- [X] T023 [US1] Implementar `frontend/src/Contexts/InstallContext.tsx` e `frontend/src/hooks/useInstall.ts` (estado `canPromptNative`, `isInstalled`, `isIos`, `dismissedAt`; ações `promptInstall()`, `dismissInvite()`; constante `INSTALL_DISMISS_DAYS = 30`; leitura/escrita de `localStorage` com try/catch) e registrar o provider em `frontend/src/main.tsx`
- [X] T024 [P] [US1] Criar `frontend/src/components/pwa/InstallIosSheet.tsx` com o `Modal` Radix existente (skill `react-modal`): título "Instalar no iPhone", 3 passos com ícones (`Share`, `SquarePlus`, check) e "Entendi"
- [X] T025 [US1] Criar `frontend/src/components/pwa/InstallAppItem.tsx` (ícone `Download`, título "Instalar o Finami", descrição "Use o Finami como um app, direto da tela inicial.", alvo ≥ 44 px) e incluí-lo numa seção "App" em `frontend/src/pages/AccountPage.tsx`
- [X] T026 [US1] Criar `frontend/src/components/pwa/InstallInvite.tsx` (cartão discreto com "Instalar" e fechar) e exibi-lo em `frontend/src/pages/HomePage.tsx` abaixo do saldo total, só após os dados carregarem
- [X] T027 [US1] Em `frontend/src/pages/HomePage.tsx` (ou `components/layout/AppShell.tsx`, onde vive `openTransactionSheet`) tratar `?acao=novo-lancamento`: abrir a folha de lançamento e limpar o parâmetro com `replace`; garantir que o parâmetro sobrevive ao redirecionamento de login (`frontend/src/utils/redirect.ts`)
- [X] T028 [US1] Criar `frontend/src/components/pwa/UpdatePrompt.tsx` mínimo com `useRegisterSW` só para **registrar** o SW em produção (o aviso visual chega em US3) e montá-lo em `frontend/src/App.tsx`; conferir que `npm run dev` não registra SW
- [X] T029 [US1] Rodar `npm run build` e `npm run check:pwa` em `frontend/`; corrigir manifest/ícones até passar

**Checkpoint**: Finami instalável e com atalhos; testes de US1 verdes

---

## Phase 4: User Story 2 - Usar sem internet com os últimos dados vistos (Priority: P1)

**Goal**: shell offline + últimos dados vistos com indicador, escritas bloqueadas, recarga ao reconectar, dados apagados ao sair

**Independent Test**: com o build, navegar Home → Carteiras → um extrato; DevTools Offline; recarregar — mesmas telas com "Sem internet · dados de …"; "+" mostra toast sem requisição; voltar online atualiza; logout esvazia `finami-cache` (quickstart passos 6–11)

### Tests for User Story 2

- [X] T030 [P] [US2] Teste de `frontend/src/components/pwa/OfflineBanner.test.tsx` (axe): oculto online; visível com `showBanner`; texto "Sem internet · dados de 01/11 às 18:42" com `staleSince` e "Sem internet" sem data; `role="status"` + `aria-live="polite"`; não focável
- [X] T031 [P] [US2] Teste de `frontend/src/components/pwa/OfflineContent.test.tsx` e `frontend/src/pages/OfflinePage.test.tsx` (axe): textos de `contracts/ui.md`; "Tentar de novo" chama o retry/recarrega
- [X] T032 [P] [US2] Teste em `frontend/src/components/layout/Fab.test.tsx`: offline → `aria-disabled="true"`, continua focável, clique mostra toast "Sem internet. Conecte-se para fazer lançamentos." e não abre a folha
- [X] T033 [P] [US2] Teste em `frontend/src/pages/WalletStatementPage.test.tsx`: falha `offline` sem registro mostra `OfflineContent`; com registro stale mostra os dados guardados; evento `reconnected` recarrega o extrato

### Implementation for User Story 2

- [X] T034 [P] [US2] Passar `cache: "network-first"` em `frontend/src/Services/authService.ts` (`me`), `walletService.ts` (lista, detalhe), `balanceService.ts` (saldos da família e da pessoa), `groupService.ts` (lista, detalhe), `statementService.ts` (carteira, pessoa, família), `notificationService.ts` (lista — só a primeira página, sem cursor — e contador), `quoteService.ts`, `userService.ts` (detalhe, criados por mim), `transactionService.ts` (detalhe) e `invitationService.ts` (convites pendentes da família); **não** alterar login, cadastro, Google, `getPublic`, busca por email, `member-lookup`, `transfer/preview`, `oauthRequestService`, `oauthConnectionService`
- [X] T035 [US2] Fazer `frontend/src/Contexts/AuthContext.tsx` tolerar `me` offline: com sessão em `finami:auth` e `me` stale, manter a pessoa logada com os dados guardados; offline sem sessão verificável e sem dado guardado → renderizar `OfflinePage`
- [X] T036 [P] [US2] Criar `frontend/src/components/pwa/OfflineBanner.tsx` (ícone `WifiOff`, cor de aviso de `components.md` §9, área segura, abaixo do cabeçalho no celular/topo do conteúdo no desktop) e montá-lo em `frontend/src/components/layout/AppShell.tsx`
- [X] T037 [P] [US2] Criar `frontend/src/components/pwa/OfflineContent.tsx` (ícone, "Este conteúdo não está disponível sem internet.", "Tentar de novo" com callback) e `frontend/src/pages/OfflinePage.tsx` (logo, "Sem internet", "Conecte-se para usar o Finami pela primeira vez neste aparelho.", "Tentar de novo")
- [X] T038 [US2] Nos contexts de consulta `frontend/src/Contexts/BalanceContext.tsx`, `WalletContext.tsx`, `StatementContext.tsx`, `GroupContext.tsx`, `NotificationContext.tsx`, `QuoteContext.tsx`, `InvitationContext.tsx` e `UserContext.tsx`: expor o erro `offline` para a tela mostrar `OfflineContent` e assinar `onReconnected` para recarregar o que a tela atual usa
- [X] T039 [US2] Usar `OfflineContent` nas páginas quando o erro for `offline` sem dados: `frontend/src/pages/HomePage.tsx`, `WalletsPage.tsx`, `WalletStatementPage.tsx`, `GroupPage.tsx`, `MemberPage.tsx`, `NotificationsPage.tsx`
- [X] T040 [US2] Desabilitar ações de escrita offline com `aria-disabled="true"` + toast: `frontend/src/components/layout/Fab.tsx` (mensagem de lançamentos) e os botões de criar/editar/excluir/convidar/aceitar/recusar/estornar em `frontend/src/components/wallet/*`, `components/group/*`, `components/transaction/*`, `components/notification/*`, `components/account/*` (mensagem "…para fazer alterações."); criar helper `frontend/src/hooks/useOnlineAction.ts` que envolve o handler e mostra o toast quando offline
- [X] T041 [US2] Nas folhas de lançamento (`frontend/src/components/transaction/*`): se a rede cair durante o envio (`ApiError` status 0 sem `offline`), mostrar "Não foi possível confirmar o lançamento. Verifique o extrato quando a conexão voltar." e não reenviar
- [X] T042 [US2] Cotação BTC guardada: em `frontend/src/components/wallet/*` (onde o valor em reais de carteiras BTC é mostrado) exibir a data da cotação usada quando o dado for stale
- [X] T043 [US2] Garantir que login, cadastro, Google e `/autorizar` offline mostram a mensagem de erro de rede atual (sem cache) — conferir `frontend/src/pages/LoginPage.tsx`, `RegisterPage.tsx`, `AuthorizePage.tsx`

**Checkpoint**: US1 e US2 funcionam e são testáveis de forma independente — MVP completo

---

## Phase 5: User Story 3 - Receber a versão nova sem perder o que estava fazendo (Priority: P2)

**Goal**: aviso "Nova versão disponível" sem recarregar sozinho; atualizar mantém tela e sessão

**Independent Test**: com o app aberto, rebuild do homolog; voltar à aba → aviso; "Atualizar" recarrega na mesma rota com sessão; folha de lançamento com dados não recarrega sem ação (quickstart passos 12–13)

### Tests for User Story 3

- [X] T044 [P] [US3] Teste de `frontend/src/components/pwa/UpdatePrompt.test.tsx` (mock de T005, axe): `needRefresh` false → nada; true → "Nova versão disponível" com Atualizar e Agora não, `role="status"`, sem roubar foco; Atualizar → "Atualizando…" e `updateServiceWorker(true)`; Agora não → oculta; `onRegisteredSW` agenda `registration.update()` a cada 60 min e no `visibilitychange` visível (timers falsos)

### Implementation for User Story 3

- [X] T045 [US3] Criar `frontend/src/hooks/useAppUpdate.ts` sobre `useRegisterSW` (`needRefresh`, `offlineReady`, `update()`, `dismiss()`; `UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000`; `registration.update()` no intervalo e em `visibilitychange`; limpa intervalo/listener no unmount)
- [X] T046 [US3] Completar `frontend/src/components/pwa/UpdatePrompt.tsx`: faixa acima da TabBar no celular / canto inferior no desktop, botões ≥ 44 px, "Atualizando…" durante a ação, não modal; respeita `prefers-reduced-motion`

**Checkpoint**: US3 funcional e testada

---

## Phase 6: User Story 4 - Abertura rápida e aparência de app nativo (Priority: P2)

**Goal**: shell precacheado, telas de abertura iOS, áreas seguras e ícone adaptável corretos

**Independent Test**: app instalado, Slow 3G, segunda abertura → estrutura em ≤ 1,5 s; ícone maskable sem corte; iPhone sem conteúdo sob o entalhe (quickstart passos 14–15, 17)

- [X] T047 [P] [US4] Adicionar em `frontend/index.html` as tags `apple-touch-startup-image` (com `media` por tamanho de aparelho) apontando para `public/splash/*.png` de T008
- [X] T048 [P] [US4] Conferir/ajustar `env(safe-area-inset-*)` no modo standalone em `frontend/src/components/layout/TabBar.tsx`, `LargeTitleHeader.tsx`, `AppShell.tsx` e `frontend/src/index.css` (incluindo `viewport-fit=cover` no `index.html`), também para `OfflineBanner` e `UpdatePrompt`
- [X] T049 [P] [US4] Confirmar no `vite.config.ts` que o precache inclui fontes, ícones e traduções e exclui `screenshots/` e `splash/` (só usados na instalação), mantendo o precache enxuto
- [X] T050 [P] [US4] 🎨 Gerar os screenshots `frontend/public/screenshots/home-narrow.png`, `wallets-narrow.png` (1080×1920) e `home-wide.png` (1920×1080) a partir dos mockups em Chrome headless, com dados fictícios

**Checkpoint**: todas as histórias funcionais

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T051 [P] Adicionar em `frontend/nginx.conf` `location = /sw.js`, `location = /registerSW.js` e `location ~ ^/workbox-.*\.js$` com `Cache-Control: no-cache` e os mesmos cabeçalhos de segurança dos demais blocos; manter `/manifest.webmanifest` no-cache
- [X] T052 [P] Atualizar `frontend/README.md` (ou `README.md` da raiz) com a seção PWA: SW só no build, como testar (`npm run build && npm run preview`), `check:pwa`, limpeza do cache no logout
- [X] T053 🎨 Revisão de UX `docs/design/REVIEW-005.md` comparando a implementação com `pwa-states.html` (contraste, foco, leitores de tela, alvos, movimento reduzido)
- [X] T054 Rodar em `frontend/`: `npm run lint`, `npm test`, `npm run build`, `npm run check:pwa`; corrigir falhas
- [X] T055 Subir o homolog (`wsl --cd /mnt/c/repos/finami -e docker compose up -d --build`) e executar o roteiro de `specs/005-pwa-webapp/quickstart.md` nos passos verificáveis nesta máquina (1, 2, 6–12, 14, 16, 17); registrar o que ficou para validação em aparelho real (3–5, 13, 15)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende do Setup; bloqueia todas as histórias
- **US1 (Phase 3)** e **US2 (Phase 4)**: dependem só da Phase 2; podem andar em paralelo
- **US3 (Phase 5)**: depende de T028 (registro do SW em US1)
- **US4 (Phase 6)**: depende de T008 (ícones/splash); T048 toca componentes de US2/US3 se já existirem
- **Polish (Phase 7)**: depois das histórias desejadas

### Dentro de cada fase

- Testes antes da implementação (falhar primeiro)
- T010 → T014 (apiFetch usa o cache); T012 → T014 e T016
- T014 → T034 (services usam a opção nova)
- T023 → T025, T026; T037 → T035, T039; T036 depende de T016
- `AuthContext.tsx` é tocado por T017 e T035 (sequenciais); `HomePage.tsx` por T026, T027 e T039 (sequenciais); `AppShell.tsx` por T036 e T048 (sequenciais)

### Parallel Opportunities

- Phase 1: T003, T004, T005, T006 juntas após T001/T002
- Phase 2: T007 e T008 (designer) em paralelo com T009/T011 (testes) do desenvolvedor
- US1: T018–T022 juntas; T024 em paralelo com T023
- US2: T030–T033 juntas; T034, T036, T037 juntas
- US4: T047–T050 juntas

---

## Parallel Example: User Story 2

```text
# Testes juntos:
T030 OfflineBanner.test.tsx · T031 OfflineContent/OfflinePage · T032 Fab.test.tsx · T033 WalletStatementPage.test.tsx

# Implementação em arquivos diferentes:
T034 Services/*.ts (network-first) · T036 OfflineBanner.tsx · T037 OfflineContent.tsx + OfflinePage.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2, ambas P1)

1. Phase 1 (Setup) → Phase 2 (Foundational)
2. Phase 3 (US1): instalável → **validar** (DevTools Manifest, instalação)
3. Phase 4 (US2): offline com últimos dados → **validar** (modo offline, logout limpa)
4. Entregar/demonstrar

### Incremental Delivery

1. US1 → app instalável
2. US2 → offline (MVP completo)
3. US3 → atualização controlada
4. US4 → abertura rápida e aparência
5. Polish → nginx, docs, revisão de UX, homolog

---

## Notes

- [P] = arquivos diferentes, sem dependências pendentes
- 🎨 = `ux-designer` (HTML/CSS/PNG/specs, nunca `.tsx`)
- Token continua só em `finami:auth`; o SW nunca intercepta `/api` (FR-016)
- Nenhuma fila offline (FR-011)
- Marcar cada tarefa com [X] ao concluir
- Commits só quando o usuário pedir, sempre com tipo `fix:`
