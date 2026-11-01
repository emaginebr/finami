# Design do Finami — índice de entrega

Feature `002-finami-frontend-mobile`. Ponto único de consumo para o `frontend-react-developer`.
Direção visual: **Noite Roxa** (iOS Dark Grouped tingido com a marca). Apenas tema escuro.

| Artefato | Propósito | Tarefa |
|---|---|---|
| [`DESIGN_DIRECTION.md`](./DESIGN_DIRECTION.md) | Direção visual, regras de cor, tipografia, layout, ícones, movimento, acessibilidade | T007 |
| [`tokens.css`](./tokens.css) | Bloco `@theme` do Tailwind 4 com tabela de contraste — copiar para `frontend/src/index.css` | T008 |
| [`components.md`](./components.md) | Anatomia, variantes, estados, medidas e a11y de cada componente (nomes de `contracts/ui-routes.md`) | T009 |
| [`../../frontend/scripts/generate-icons.mjs`](../../frontend/scripts/generate-icons.mjs) | Gera ícones a partir de `docs/logos/logo.png` (`npm run icons`) | T010 |
| `frontend/public/apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `favicon-32.png` | Ícones iOS / maskable / favicon | T010 |
| `frontend/src/assets/app-icon.png`, `logo.webp` | AppIcon (512) e Logo (largura 640) usados no app | T010 |
| `frontend/src/assets/app-icon.webp` | AppIcon leve (288 px, 6,4 KB) — substitui o PNG no import do `AppIcon` | T091 |
| [`../../frontend/public/manifest.webmanifest`](../../frontend/public/manifest.webmanifest) | Manifest PWA (`standalone`, `#12021C`, ícones maskable) | T011 |
| [`mockups/login.html`](./mockups/login.html), [`register.html`](./mockups/register.html), [`home.html`](./mockups/home.html) | Entrada, cadastro e Home (normal, sem cotação, desatualizada, vazio, carregando, erro, 320 px) | T032 |
| [`mockups/transaction-sheet.html`](./mockups/transaction-sheet.html) | Folha de lançamento — todos os estados de data-model §6 | T048 |
| [`mockups/wallet-statement.html`](./mockups/wallet-statement.html) | Extrato, período, detalhe, estorno, vazio | T057 |
| [`mockups/wallets.html`](./mockups/wallets.html), [`group-manage.html`](./mockups/group-manage.html) | Aba Carteiras e formulários de carteira/família/membros | T064 |
| [`mockups/group.html`](./mockups/group.html), [`member.html`](./mockups/member.html) | Saldo por membro (Full/Summary/Hidden) e tela do membro | T080 |
| [`mockups/account.html`](./mockups/account.html) | Aba Conta estilo Ajustes | T087 |
| [`REVIEW.md`](./REVIEW.md) | Revisão das telas implementadas × mockups (320/390/768/1440 px), ajustes por severidade para o T092 | T091 |

## Como ver os mockups

Abrir qualquer `mockups/*.html` no navegador (arquivo local). Cada página mostra a tela em 390 px
(vários estados) e em 1440 px (escala 62 %). A mesma marcação alimenta os dois tamanhos via
container queries (`@container app (min-width: 768px)`), reproduzindo o breakpoint `md` do app.

Arquivos de apoio (não são parte do app):
- `mockups/tokens-root.css` — cópia `:root` do `@theme` de `tokens.css` (gerada; não editar à mão).
- `mockups/mockup.css` — estilos dos componentes nos mockups (referência visual das classes Tailwind).
- `mockups/mockup.js` — monta a casca (Sidebar/TabBar/FAB) e injeta os ícones lucide.

## Observações para a implementação

- No app, `--text-hero` usa `vw`; nos mockups, `cqw` (largura do aparelho simulado).
- A regra global de `prefers-reduced-motion` está no fim de `tokens.css` (fora do `@theme`).
- `index.html`: `lang="pt-BR"`, `viewport-fit=cover`, `<meta name="theme-color" content="#12021C">`,
  `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
  `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">`.
