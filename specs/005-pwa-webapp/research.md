# Research: Finami como webapp instalável (PWA)

**Feature**: `005-pwa-webapp` · **Data**: 2026-11-01

Formato: **Decisão / Racional / Alternativas**. Nenhum item "NEEDS CLARIFICATION" restante.

---

## R-01 — Service worker e build

**Decisão**: `vite-plugin-pwa` 1.x/2.x (compatível com Vite 6; versão estável mais recente,
fixada) em modo **`generateSW`** (Workbox 7) com `registerType: "prompt"` e
`injectRegister: false`; registro feito pelo app via `virtual:pwa-register/react`
(`useRegisterSW`, que usa `workbox-window`). O plugin também gera o `manifest.webmanifest`
(o arquivo estático atual em `public/` sai). `devOptions.enabled: false` (FR-023).

**Racional**: padrão de mercado para Vite; precache com hash por arquivo (a "casca" offline de
FR-007), atualização sob controle do app (FR-018/019) e tipagem TS. `generateSW` basta: o SW só
precisa de precache + fallback de navegação; nada de lógica própria.

**Alternativas**: SW escrito à mão (reimplementar precache/versionamento — sujeito a erro);
`injectManifest` (só necessário com lógica customizada no SW, que não teremos); Workbox CLI fora do
Vite (duplica o pipeline de build).

## R-02 — Onde guardar os dados de consulta (offline)

**Decisão**: **cache na camada do app**, não no service worker. O `apiFetch` ganha a opção
`cache: "network-first" | "none"` (padrão `none`). Nos GETs de consulta (lista em
`contracts/offline-cache.md`) o serviço passa `network-first`: com rede, busca, devolve e grava a
resposta em **IndexedDB** (`finami-cache`, store `responses`) com chave
`{userId}:{path}` e metadados `fetchedAt`, `schemaVersion`; sem rede (falha de rede ou 10 s sem
resposta), devolve o valor guardado marcando-o como antigo (`stale`) e informando `fetchedAt`.
Respostas não 2xx nunca são gravadas.

**Racional**:
- Isola por sessão (`userId` na chave) e é apagado no logout/401 pelo próprio app (FR-015) sem
  precisar conversar com o SW.
- O token nunca chega ao SW nem a outro armazenamento (FR-016): o SW não intercepta `/api/*`.
- Dá ao app a data/hora dos dados para o indicador (FR-010) — o cache HTTP do SW não expõe isso.
- Funciona igual com API na mesma origem (prod) ou em outra origem (homolog `:5145`).
- Escritas (POST/PUT/DELETE) nunca passam pelo cache (FR-011/FR-017).

**Alternativas**: `runtimeCaching` NetworkFirst do Workbox em `/api/*` (cache por URL, sem
separar usuários, difícil de apagar com segurança no logout, vê o cabeçalho `Authorization`, não
informa data); `localStorage` (limite ~5 MB, síncrono, mistura com a sessão).

## R-03 — Wrapper do IndexedDB

**Decisão**: módulo próprio `utils/offlineCache.ts` (~80 linhas, API `get/set/clearAll/
clearUser`) sobre IndexedDB nativo, com `schemaVersion` = constante do código; registros com outra
versão são ignorados e apagados (FR-020). Falha ao abrir o banco (navegação privada, cota) →
o módulo vira no-op silencioso (edge case "armazenamento negado"). Testes com `fake-indexeddb`
(devDependency).

**Alternativas**: `idb`/`idb-keyval` (dependência de runtime para pouca coisa; o wrapper é
pequeno); `localforage` (pesado).

## R-04 — Detecção de conexão

**Decisão**: `ConnectivityContext` com estado `online | offline`, combinando:
- eventos `online`/`offline` e `navigator.onLine`;
- resultado do `apiFetch`: falha de rede ou **timeout de 10 s** (`AbortSignal.timeout` combinado
  com o `signal` do chamador) → reporta `offline`; qualquer resposta HTTP → reporta `online`.
- O indicador só aparece após **2 s** offline contínuos (anti-pisca) e some na primeira resposta
  bem-sucedida; ao voltar `online`, o contexto emite um evento `reconnected` que as telas usam para
  recarregar (FR-012).

**Racional**: `navigator.onLine` sozinho dá falso positivo (Wi-Fi sem internet); o resultado real
das chamadas é a fonte mais confiável.

## R-05 — Ações de escrita sem internet

**Decisão**: `apiFetch` com método ≠ GET e estado `offline` lança `ApiError(0, "Sem internet.
Conecte-se para fazer lançamentos.")` **sem** chamar `fetch`. Na interface: FAB "+" e botões de
ação principais leem `useConnectivity()` e ficam com `aria-disabled` + dica; tocar mostra o toast
acima. Se a conexão cai **durante** uma escrita, a mensagem é "Não foi possível confirmar o
lançamento. Verifique o extrato quando a conexão voltar." (para escritas de lançamento) e não há
reenvio.

## R-06 — Atualização da versão

**Decisão**: `UpdatePrompt` usa `useRegisterSW({ onRegisteredSW })`; no registro agenda
`registration.update()` a cada 60 min e no `visibilitychange → visible`. Quando `needRefresh`,
mostra uma faixa fixa acima da barra de abas (não modal, não rouba foco) "Nova versão disponível ·
Atualizar · Agora não". "Atualizar" → `updateServiceWorker(true)` (skipWaiting + reload na mesma
URL; sessão está no `localStorage`, então continua). "Agora não" esconde até a próxima detecção;
sem ação, o SW novo assume na próxima abertura do zero (comportamento padrão do `prompt`).
O `schemaVersion` do cache é independente da versão do app.

## R-07 — Fallback de navegação e rotas que não podem ser servidas pelo SW

**Decisão**: `navigateFallback: "/index.html"` com `navigateFallbackDenylist` para
`/api/`, `/mcp`, `/oauth/`, `/.well-known/`, `/health`, `/healthz` — em produção essas rotas são
da **mesma origem** (Caddy) e o `/oauth/authorize` é uma navegação de página que precisa chegar à
API (feature 004). Primeira visita sem rede e sem precache → o navegador mostra a página do
navegador (inevitável); da segunda em diante o shell abre e, sem dados, mostra a tela
`OfflinePage` própria (FR-013). `/autorizar` é rota da SPA servida pelo shell, mas suas chamadas
usam `cache: "none"` e exigem rede (FR-014).

## R-08 — Instalação

**Decisão**: `InstallContext` captura `beforeinstallprompt` (guardado, `preventDefault`) e
`appinstalled`; detecta modo instalado por `matchMedia("(display-mode: standalone)")` ou
`navigator.standalone` (iOS); detecta iOS/iPadOS por user agent + `maxTouchPoints`. Tela Conta:
item "Instalar o Finami" → `prompt()` nativo, ou folha com o passo a passo do iOS (Compartilhar →
Adicionar à Tela de Início). Convite único (FR-004): pequeno cartão dispensável na Home, exibido
uma vez após o primeiro carregamento com dados, com `finami:install-dismissed-at` no
`localStorage` (30 dias). Nada disso aparece em navegador sem suporte (FR-022).

## R-09 — Manifest, ícones e telas de abertura

**Decisão**: manifest gerado pelo plugin com `id: "/"`, `name`, `short_name`, `description`,
`lang: "pt-BR"`, `start_url: "/?source=pwa"`, `scope: "/"`, `display: "standalone"`,
`display_override: ["standalone"]`, `background_color`/`theme_color` `#12021C`, `categories: ["finance"]`, ícones **separados**
`purpose: "any"` (192, 512) e `purpose: "maskable"` (192, 512), `shortcuts` (Novo lançamento →
`/?acao=novo-lancamento`, Carteiras → `/carteiras`, com ícones 96 px) e `screenshots` (2 estreitos
1080×1920 e 1 largo 1920×1080, para a janela de instalação rica do Chrome).
Nota: **sem** `orientation` fixa — desktop e tablet giram livremente.
`scripts/generate-icons.mjs` passa a gerar ícones "any" (com cantos/transparência adequados),
"maskable" (zona segura de 80%), ícones de atalho e as telas de abertura do iOS
(`apple-touch-startup-image` para os tamanhos atuais de iPhone/iPad). Screenshots: gerados pelo
`ux-designer` a partir dos mockups em Chrome headless e versionados em `public/screenshots/`.

## R-10 — Atalho "Novo lançamento"

**Decisão**: a Home lê `?acao=novo-lancamento`, abre a folha de lançamento (mesma do FAB) e limpa
o parâmetro (`replace`). Sem sessão, o parâmetro sobrevive ao login (mesmo mecanismo de retorno da
feature 004).

## R-11 — Servidor (nginx)

**Decisão**: `frontend/nginx.conf` ganha `location = /sw.js`, `= /registerSW.js` (se existir) e
`~ ^/workbox-.*\.js$` com `Cache-Control: no-cache` e os mesmos cabeçalhos de segurança;
`/manifest.webmanifest` já é `no-cache`. Caddy não muda (só encaminha para o nginx).

## R-12 — Testes

**Decisão**:
- Unidade (Vitest): `offlineCache` (gravar/ler, isolamento por usuário, `clearAll`, versão
  incompatível, banco indisponível → no-op) com `fake-indexeddb`; `apiFetch` com
  `network-first` (rede ok grava; falha devolve stale com `fetchedAt`; não-2xx não grava; escrita
  offline não chama `fetch`; timeout de 10 s com timers falsos); `ConnectivityContext`
  (anti-pisca 2 s, `reconnected`); logout/401 limpam o cache.
- Componentes (Vitest + axe): `OfflineBanner`, `UpdatePrompt`, `InstallAppItem`
  (nativo/iOS/instalado/sem suporte), `InstallInvite` (dispensa 30 dias), `OfflinePage`, FAB
  desabilitado offline.
- Build: teste/script que valida o `dist/manifest.webmanifest` (campos e ícones existentes) e a
  presença do `sw.js` com o denylist.
- Manual (quickstart): Chrome DevTools (Application → Manifest/Service Workers, Network offline),
  instalação real em Android/desktop/iOS, Lighthouse (instalabilidade + desempenho).

## R-13 — Distribuição entre agentes (Princípio VIII)

- `ux-designer`: ícones any/maskable/atalhos, telas de abertura iOS, screenshots, mockups
  `pwa-states.html` (indicador offline, aviso de versão, convite e item de instalação, folha iOS,
  tela sem internet, conteúdo indisponível, FAB desabilitado), especificação em `components.md`.
- `frontend-react-developer`: plugin/manifest, `offlineCache`, `apiFetch`, contexts, componentes,
  páginas, nginx do frontend, testes.
- `dotnet-senior-developer`: nenhuma tarefa (backend não muda).
