# Design do Finami — índice de entrega

Feature `002-finami-frontend-mobile`. Ponto único de consumo para o `frontend-react-developer`.
Direção visual: **Noite Roxa** (iOS Dark Grouped tingido com a marca). Apenas tema escuro.

| Artefato | Propósito | Tarefa |
|---|---|---|
| [`DESIGN_DIRECTION.md`](./DESIGN_DIRECTION.md) | Direção visual, regras de cor, tipografia, layout, ícones, movimento, acessibilidade | T007 |
| [`tokens.css`](./tokens.css) | Bloco `@theme` do Tailwind 4 com tabela de contraste — copiar para `frontend/src/index.css` | T008 |
| [`components.md`](./components.md) | Anatomia, variantes, estados, medidas e a11y de cada componente (nomes de `contracts/ui-routes.md`) | T009 |
| [`../../frontend/scripts/generate-icons.mjs`](../../frontend/scripts/generate-icons.mjs) | Gera ícones a partir de `docs/logos/logo.png` (`npm run icons`) | T010 |
| `frontend/public/apple-touch-icon.png`, `favicon-32.png` | Ícones iOS / favicon (os antigos `icon-192.png`/`icon-512.png` foram substituídos pelos `icon-any-*`/`icon-maskable-*` da feature 005) | T010 |
| `frontend/src/assets/app-icon.png`, `logo.webp` | AppIcon (512) e Logo (largura 640) usados no app | T010 |
| `frontend/src/assets/app-icon.webp` | AppIcon leve (288 px, 6,4 KB) — substitui o PNG no import do `AppIcon` | T091 |
| [`../../frontend/public/manifest.webmanifest`](../../frontend/public/manifest.webmanifest) | Manifest PWA (`standalone`, `#12021C`, ícones maskable) | T011 |
| [`mockups/login.html`](./mockups/login.html), [`register.html`](./mockups/register.html), [`home.html`](./mockups/home.html) | Entrada, cadastro e Home (normal, sem cotação, desatualizada, vazio, carregando, erro, 320 px) | T032 |
| [`mockups/transaction-sheet.html`](./mockups/transaction-sheet.html) | Folha de lançamento — todos os estados de data-model §6 | T048 |
| [`mockups/wallet-statement.html`](./mockups/wallet-statement.html) | Extrato, período, detalhe, estorno, vazio | T057 |
| [`mockups/wallets.html`](./mockups/wallets.html), [`group-manage.html`](./mockups/group-manage.html) | Aba Carteiras e formulários de carteira/família/membros | T064 |
| [`mockups/group.html`](./mockups/group.html), [`member.html`](./mockups/member.html) | Saldo por membro (Full/Summary/Hidden) e tela do membro | T080 |
| [`mockups/account.html`](./mockups/account.html) | Aba Conta estilo Ajustes | T087 |
| [`REVIEW-004.md`](./REVIEW-004.md) | Revisão da feature 004 (consentimento OAuth, Conta → Assistentes conectados, página de erro da API) × mockups e WCAG 2.1 AA — 0 altos, 3 médios, 8 baixos | T062 |
| [`REVIEW-003.md`](./REVIEW-003.md) | Revisão das telas da feature 003 no homolog (320/390/1440 px) — 0 altos, 2 médios, 6 baixos | T040 |
| [`REVIEW.md`](./REVIEW.md) | Revisão das telas implementadas × mockups (320/390/768/1440 px), ajustes por severidade para o T092 | T091 |

## Feature `003-family-member-invites` — convites e notificações

| Artefato | Propósito | Tarefa |
|---|---|---|
| [`mockups/add-member-sheet.html`](./mockups/add-member-sheet.html) | Folha "Adicionar membro": email, inválido, verificando, Available → nova pessoa, sem email, Registered → convidar, AlreadyMember, PendingInvite (+ cancelar), enviando, erro do servidor, resultados (390 e 1440 px) | T001 |
| [`mockups/notifications.html`](./mockups/notifications.html) | Tela `/notificacoes`: convite pendente com Aceitar/Recusar, aceitando, aceito, indisponível (409), estados finais, aceito/recusado para o responsável, "Carregar mais", vazio, carregando, erro (390 e 1440 px) | T002 |
| [`components.md` §7](./components.md#7-convites-e-notificações-feature-003) | `NotificationBell` (posição, selo 1–9/"9+", foco, `aria-label`), `NotificationItem`, `AddMemberSheet`, `SectionHeaderAction`, `PendingInvitesSection`, variantes novas de Badge/Avatar; ajustes em Sidebar, LargeTitleHeader (`titleAccessory`) e MemberManager | T002 |
| [`mockups/group.html`](./mockups/group.html) | "Adicionar membro" no cabeçalho de Membros, "Convites pendentes", ConfirmModal de cancelamento, foco | T003 |
| [`mockups/home.html`](./mockups/home.html), [`wallets.html`](./mockups/wallets.html), [`account.html`](./mockups/account.html) | Sino no título das abas (celular) e no topo da Sidebar (desktop), com 0, 1, 2 e "9+" | T003 |
| [`mockups/group-manage.html`](./mockups/group-manage.html) | "Gerenciar família" sem a inclusão de membros (research R-08) | T003 |

Nenhum token novo: todas as combinações usam cores já validadas na tabela de contraste de
`tokens.css`.

## Feature `004-mcp-oauth-server` — assistentes de IA (OAuth)

| Artefato | Propósito | Tarefa |
|---|---|---|
| [`mockups/oauth-consent.html`](./mockups/oauth-consent.html) | Tela `/autorizar`: pronto (leitura+escrita), só leitura pedida, 320 px, enviando, voltando, erro de rede ao enviar e ao carregar, carregando, vencido (410), inexistente (404), desktop | T004 |
| [`mockups/account-connections.html`](./mockups/account-connections.html) | Conta → "Assistentes conectados": lista, confirmação, depois de desconectar, desconectar todos, vazio com copiar, copiado, carregando, erro (390 e 1440 px) | T004 |
| [`mockups/oauth-error.html`](./mockups/oauth-error.html) | Página de erro do `GET /oauth/authorize`: HTML **final** e autocontido para embutir na API (trocar só `{{REASON}}`) | T004 |
| [`components.md` §8](./components.md#8-assistentes-de-ia--oauth-e-conexões-feature-004) | `OAuthConsentPage`, `AccountCard`, `ScopeChoice`, `ConnectedAssistantsSection`, `ConnectionItem`, `ScopeBadge`, `McpAddressCard`, `OAuthErrorPage` | T004 |

Nenhum token novo. Ícones lucide novos: `Bot`, `Unplug`, `ExternalLink`.

## Feature `005-pwa-webapp` — app instalável (PWA)

| Artefato | Propósito | Tarefa |
|---|---|---|
| [`mockups/pwa-states.html`](./mockups/pwa-states.html) | OfflineBanner, toast de reconexão, FAB desabilitado + toast, OfflineContent, OfflinePage, UpdatePrompt (e "Atualizando…"), InstallInvite, item "Instalar o Finami" na Conta, folha "Instalar no iPhone" (390, 320 e 1440 px) | T007 |
| [`components.md` §9](./components.md#9-pwa-feature-005) | Especificação de `OfflineBanner`, `UpdatePrompt`, `InstallInvite`, `InstallAppItem`, `InstallIosSheet`, `OfflineContent`, `OfflinePage`, `Fab` offline, área segura | T007 |
| [`../../frontend/scripts/generate-icons.mjs`](../../frontend/scripts/generate-icons.mjs) | Passa a gerar ícones `any`/`maskable` separados, ícones de atalho e telas de abertura do iOS | T008 |
| `frontend/public/icon-any-192.png`, `icon-any-512.png` | Manifest `purpose: "any"` — cartão roxo arredondado, cantos transparentes | T008 |
| `frontend/public/icon-maskable-192.png`, `icon-maskable-512.png` | Manifest `purpose: "maskable"` — fundo `#12021C`, casa na zona segura de 80 % | T008 |
| `frontend/public/shortcut-new-transaction-96.png`, `shortcut-wallets-96.png` | Ícones dos atalhos "Novo lançamento" e "Carteiras" | T008 |
| `frontend/public/splash/apple-splash-*.png` + [`splash-links.txt`](../../frontend/public/splash/splash-links.txt) | 18 telas de abertura do iOS (retrato, iPhone e iPad) e as tags `<link rel="apple-touch-startup-image">` para o `index.html` | T008 |
| `frontend/public/screenshots/home-narrow.png`, `wallets-narrow.png` (1080×1920), `home-wide.png` (1920×1080) | Screenshots da janela de instalação (`form_factor` `narrow`/`wide`) | T050 |

Nenhum token novo (a faixa de aviso usa `warning-soft`/`warning`/`text`). Ícones lucide novos:
`Download`, `Share`, `SquarePlus`, `RefreshCw`, `Wifi`.

## Como ver os mockups

Abrir qualquer `mockups/*.html` no navegador (arquivo local). Cada página mostra a tela em 390 px
(vários estados) e em 1440 px (escala 62 %). A mesma marcação alimenta os dois tamanhos via
container queries (`@container app (min-width: 768px)`), reproduzindo o breakpoint `md` do app.

Arquivos de apoio (não são parte do app):
- `mockups/tokens-root.css` — cópia `:root` do `@theme` de `tokens.css` (gerada; não editar à mão).
- `mockups/mockup.css` — estilos dos componentes nos mockups (referência visual das classes Tailwind).
- `mockups/mockup.js` — monta a casca (Sidebar/TabBar/FAB), injeta os ícones lucide e o sino
  (`data-bell="N"` = não lidas, `data-bell-active` = rota `/notificacoes`, `data-user="BL|Bruno Lima"`).

## Observações para a implementação

- No app, `--text-hero` usa `vw`; nos mockups, `cqw` (largura do aparelho simulado).
- A regra global de `prefers-reduced-motion` está no fim de `tokens.css` (fora do `@theme`).
- `index.html`: `lang="pt-BR"`, `viewport-fit=cover`, `<meta name="theme-color" content="#12021C">`,
  `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
  `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">`.
