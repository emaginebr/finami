# Implementation Plan: Finami como webapp instalável (PWA)

**Branch**: `005-pwa-webapp` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-pwa-webapp/spec.md`

## Summary

Transformar o frontend em PWA: **instalável** (manifest completo com ícones any/maskable, atalhos
e screenshots; opção "Instalar o Finami" na Conta e passo a passo no iOS), **abre sem internet**
(service worker com precache da "casca") mostrando os **últimos dados vistos** (cache de consultas
em IndexedDB por sessão, apagado no logout/401) com indicador "Sem internet", **bloqueia escritas
offline** (sem fila) e oferece **atualização controlada** ("Nova versão disponível · Atualizar").

Abordagem: `vite-plugin-pwa` (`generateSW`, `registerType: "prompt"`) para SW e manifest; cache de
dados na camada do app (`apiFetch` com `cache: "network-first"`), não no SW, para isolar por
usuário e nunca expor o token ao SW. Backend não muda. Decisões em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.8 / React 18.3 (frontend); backend sem mudanças
**Primary Dependencies**: existentes + **`vite-plugin-pwa`** (dev, compatível com Vite 6) e **`workbox-window`** 7.x (runtime, usado pelo registro do plugin); dev: **`fake-indexeddb`** (testes)
**Storage**: IndexedDB `finami-cache` (dados de consulta por sessão) e Cache Storage do Workbox (precache dos arquivos do build); `localStorage` só para a sessão (inalterada) e a data de dispensa do convite
**Testing**: Vitest + Testing Library + vitest-axe (+ `fake-indexeddb`); validação do manifest gerado; manual com DevTools, Lighthouse e instalação real (quickstart)
**Target Platform**: Chrome/Edge (Android, desktop), Safari iOS/iPadOS 16.4+, Firefox (sem instalação; offline funciona)
**Project Type**: web application (só frontend + nginx do frontend)
**Performance Goals**: 2ª abertura offline ≤ 3 s com dados (SC-003); estrutura ≤ 1,5 s em 3G (SC-004)
**Constraints**: nada de fila offline; token só em `finami:auth`; SW não intercepta `/api`, `/mcp`, `/oauth`, `/.well-known`; dados apagados no logout/401; dev sem SW
**Scale/Scope**: 1 plugin, ~4 contexts/módulos, ~7 componentes, alteração do `apiFetch` e de ~10 services, ícones/screenshots novos, nginx

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* — Constituição v2.0.0

| # | Princípio | Atendimento | Status |
|---|---|---|---|
| I | Skills | `react-architecture` para os novos Contexts/hooks (Connectivity, Install, Update), `react-modal` (folha iOS), `react-alert` (toasts) | ✅ |
| II | Stack | Vite continua o bundler (o plugin é do ecossistema Vite); Context API; Fetch; Tailwind. Sem Redux/Axios. Dependências novas pequenas e específicas | ✅ |
| III | Casing | `Contexts/`, `Services/`, `hooks/`, `types/` | ✅ |
| IV | Código | `interface`, arrow functions, `const`, constantes UPPER_CASE (`OFFLINE_CACHE_SCHEMA_VERSION`) | ✅ |
| V | Banco | Não se aplica (sem mudança no PostgreSQL) | ✅ |
| VI | Segurança | Token permanece só em `localStorage` `finami:auth`; SW não vê `/api`; cache de dados isolado por usuário e apagado no logout/401; nada sensível novo | ✅ |
| VII | Erros | Backend inalterado; frontend usa `ApiError`/`handleError` existentes | ✅ |
| VIII | Agentes | `ux-designer` (ícones, screenshots, mockups) → `frontend-react-developer`; sem tarefa de backend | ✅ |
| IX | Acessibilidade | Banner `role=status`/`aria-live`, ações `aria-disabled` focáveis, folha iOS Radix, alvos 44 px, movimento reduzido nas transições, testes axe | ✅ |

**Pós-design**: aprovado; nenhuma violação.

## Project Structure

### Documentation (this feature)

```text
specs/005-pwa-webapp/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (offline-cache.md, ui.md)
├── checklists/requirements.md
└── tasks.md            # /speckit.tasks
```

### Source Code

```text
frontend/                                              # frontend-react-developer
├── vite.config.ts*                                    # VitePWA({...}) + manifest + workbox
├── package.json*                                      # vite-plugin-pwa, workbox-window, fake-indexeddb
├── index.html*                                        # apple-touch-startup-image, sem <link manifest> manual
├── nginx.conf*                                        # no-cache em sw.js / workbox-*.js
├── public/ (icon-any-192/512.png, icon-maskable-192/512.png, shortcut-*.png,
│            splash/*.png, screenshots/*.png)          # gerados (ux-designer + script)
├── public/manifest.webmanifest                        # REMOVIDO (gerado pelo plugin)
├── scripts/generate-icons.mjs*                        # any/maskable/atalhos/splash
└── src/
    ├── utils/offlineCache.ts (+ .test.ts)
    ├── Services/apiHelpers.ts* (+ testes)             # cache network-first, timeout, offline
    ├── Services/*.ts*                                 # ~10 GETs com cache: "network-first"
    ├── Contexts/ (ConnectivityContext.tsx, InstallContext.tsx, AuthContext.tsx*)
    ├── hooks/ (useConnectivity.ts, useInstall.ts, useAppUpdate.ts)
    ├── components/pwa/ (OfflineBanner, UpdatePrompt, InstallAppItem, InstallIosSheet,
    │                    InstallInvite, OfflineContent) (+ .test.tsx)
    ├── pages/OfflinePage.tsx · pages/HomePage.tsx* (convite + ?acao=novo-lancamento)
    ├── pages/AccountPage.tsx* · components/layout/* (banner, FAB desabilitado)
    ├── main.tsx* · vite-env.d.ts* (tipos virtual:pwa-register) · i18n/pt-BR.json*
    └── test/ (setup com fake-indexeddb, mock de virtual:pwa-register/react)

docs/design/ (mockups/pwa-states.html, components.md §9, screenshots fonte)   # ux-designer
```
`*` = arquivo existente alterado.

**Structure Decision**: mudança só no frontend web (mesma estrutura das features 002–004). Nenhuma
alteração em `backend/`, Caddy ou compose.

## Complexity Tracking

Nenhuma violação da constituição.
