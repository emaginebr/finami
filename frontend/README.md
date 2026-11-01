# Finami — Frontend

SPA mobile-first do Finami: saldo total da família, carteiras por família e avulsas, extratos,
saldo por membro e lançamentos (entrada, saída, transferência e compra/venda de bitcoin).
Tema escuro estilo iOS. No celular a navegação fica numa barra inferior; a partir de 768 px, numa
barra lateral. Pode ser instalada na tela inicial do iPhone (manifest + ícone).

Feature: [`specs/002-finami-frontend-mobile/`](../specs/002-finami-frontend-mobile/) — spec,
plano, pesquisa (decisões R-01…R-18), modelo de dados, contratos e tarefas.

## Stack

| Tecnologia | Versão | Uso |
|---|---|---|
| React | 18.3 | UI |
| TypeScript | 5.8 | Tipagem (`strict`, `noUncheckedIndexedAccess`) |
| Vite | 6 | Build e servidor de desenvolvimento |
| Tailwind CSS | 4 (`@tailwindcss/vite`) | Estilos; tokens no bloco `@theme` de `src/index.css` |
| React Router | 6 (`createBrowserRouter`) | Rotas em português (`/carteiras`, `/familias/:id`…) |
| i18next / react-i18next | 25 / 15 | Textos (só `pt-BR`, em `src/i18n/pt-BR.json`) |
| sonner | 2 | Toasts (`aria-live`) |
| @radix-ui/react-dialog | 1 | Modal, Sheet e ConfirmModal (foco preso, `Esc`) |
| lucide-react | 1 | Ícones |
| Fetch API | nativa | HTTP (sem Axios) |
| Vitest + Testing Library + vitest-axe | 3 / 16 / 0.1 | Testes unitários, de componentes e de acessibilidade (jsdom) |
| sharp | 0.35 | Geração dos ícones (`npm run icons`) |

Estado global só com Context API: um Context por entidade (Auth, Quote, User, Group, Wallet,
Transaction, Statement, Balance) e um `UiContext` para abrir a folha de lançamento.

## Como rodar

Pré-requisitos: Node 22+ e o backend do Finami rodando (veja [`backend/README.md`](../backend/README.md)).

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173 (usa .env.development)
```

### Apontar para o backend

1. Suba a API seguindo [`backend/README.md`](../backend/README.md)
   (`dotnet run --project Finami.API`; Swagger em `http://localhost:5145/swagger`).
2. O `.env.development` versionado já aponta para `http://localhost:5145`. Para outro endereço,
   crie `.env.development.local` (ignorado pelo git) com `VITE_API_URL=…`, sem barra no final.
3. Em Development a API aceita qualquer origem (CORS). Em outros ambientes, inclua a origem do
   frontend em `Cors__AllowedOrigins__0`… no backend. Em prod não é preciso, porque o front e a
   API ficam na mesma origem.

## Ambientes

| Ambiente | Como sobe | Origem das variáveis | `VITE_API_URL` |
|---|---|---|---|
| **dev** | `npm run dev` (Vite, porta 5173) | `.env.development` (versionado) + `.env.development.local` (opcional, ignorado) | `http://localhost:5145` |
| **homolog** | `docker compose` local (arquivos da raiz do repositório) | `--build-arg` da imagem | URL da API do compose (ex.: `http://localhost:5145`) ou vazio se houver proxy na mesma origem |
| **prod** | `docker compose` no servidor, atrás do Caddy com TLS | `--build-arg` da imagem | **vazio** = mesma origem: o Caddy encaminha `/api/*` para a API e o resto para este container |

### Imagem Docker (homolog e prod)

`Dockerfile` multi-stage: `node:22-alpine` roda `npm ci` e `npm run build` (sem testes), e
`nginx:1.27-alpine` serve o `dist/` com [`nginx.conf`](./nginx.conf) na porta 80.

As variáveis `VITE_*` são **embutidas no JavaScript durante o build** (não são lidas em tempo de
execução): mudar qualquer valor exige reconstruir a imagem. Elas entram como build args, e o
`.dockerignore` exclui todos os `.env*` do contexto.

```bash
# prod: mesma origem (VITE_API_URL vazio)
docker build -t finami-frontend \
  --build-arg VITE_API_URL= \
  --build-arg VITE_GOOGLE_CLIENT_ID=<client-id> \
  frontend

# homolog: API em outra porta
docker build -t finami-frontend:homolog \
  --build-arg VITE_API_URL=http://localhost:5145 \
  frontend
```

O `nginx.conf` faz:
- fallback da SPA (`try_files $uri $uri/ /index.html`);
- `Cache-Control: no-cache` em `index.html` e `manifest.webmanifest`;
- cache de 1 ano (`immutable`) em `/assets/`, cujos nomes levam hash;
- gzip para js/css/json/svg;
- cabeçalhos `X-Content-Type-Options`, `Referrer-Policy` e `X-Frame-Options`;
- `GET /healthz` → `200 ok`, usado pelo `HEALTHCHECK` da imagem e pelo compose.

**`VITE_SITE_BASENAME` com Docker:** o nginx e o Vite assumem a raiz (`/`). Para servir em
um subcaminho (ex.: `/finami`), é preciso:
- definir `base: "/finami/"` no `vite.config.ts`;
- ajustar o `nginx.conf`: `location /finami/` com `alias`, fallback para `/finami/index.html` e
  o mesmo cache para `/finami/assets/`;
- conferir os caminhos absolutos do `index.html` e do `manifest.webmanifest` (`/favicon-32.png`,
  `start_url`, ícones).

Com o Caddy na mesma origem, o mais simples é manter o app na raiz.

## Variáveis de ambiente

Arquivos versionados (sem segredos): [`.env.example`](./.env.example) e
[`.env.development`](./.env.development). `.env`, `.env.local` e `.env.*.local` ficam fora do
git. Só variáveis com prefixo `VITE_`, lidas com `import.meta.env.VITE_*` (tipadas em
`src/vite-env.d.ts`). Nada aqui é segredo: tudo vai para o navegador.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_URL` | Em dev | URL base da API (ex.: `http://localhost:5145`). Vazio = mesma origem (chamadas relativas a `/api/...`), como em prod |
| `VITE_SITE_BASENAME` | Não | Base path do React Router quando o app não fica na raiz (ex.: `/finami`) |
| `VITE_GOOGLE_CLIENT_ID` | Para login Google | OAuth Client ID público (o mesmo `Google__ClientId` do backend). Sem ele o botão do Google não aparece |

### Login com Google

O botão oficial do Google Identity Services é carregado sob demanda. Ele só funciona em origens
autorizadas: no [Google Cloud Console](https://console.cloud.google.com/apis/credentials), no
Client ID do tipo "Aplicativo da Web", adicione **`http://localhost:5173`** em "Origens
JavaScript autorizadas", junto com a origem de homolog e a de produção (o domínio do Caddy, em `https://`). O frontend envia o ID token para
`POST /api/auth/google`, e o backend valida com o mesmo Client ID.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento Vite (porta 5173) |
| `npm run build` | `tsc -b` + build de produção em `dist/` |
| `npm run preview` | Serve o build de `dist/` localmente |
| `npm run lint` | ESLint (`@typescript-eslint/no-explicit-any` como erro) |
| `npm test` | Vitest uma vez (`vitest run`) |
| `npm run test:watch` | Vitest em modo observação |
| `npm run icons` | Gera os ícones a partir de `docs/logos/logo.png` (ver abaixo) |

### Ícones

`scripts/generate-icons.mjs` (Node + sharp) recorta a casa da logo e grava:
- em `public/`: `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` (maskable) e `favicon-32.png`;
- em `src/assets/`: `app-icon.png` (512) e `logo.webp` (largura 640).

Rode o script só quando a logo mudar e confira o recorte. As imagens geradas são versionadas.

## Estrutura de pastas

O casing das pastas é obrigatório (constituição, Princípio III): `Contexts/` e `Services/` com
maiúscula, `hooks/` e `types/` com minúscula.

```text
frontend/
├── index.html              # lang="pt-BR", viewport-fit=cover, manifest, apple-touch-icon
├── public/                 # manifest.webmanifest + ícones gerados
├── scripts/                # generate-icons.mjs
└── src/
    ├── main.tsx            # providers (data-model §10) + Toaster
    ├── App.tsx             # createBrowserRouter (basename de VITE_SITE_BASENAME)
    ├── routes.tsx          # rotas; páginas lazy, exceto Home e Login
    ├── index.css           # Tailwind 4 + @theme (tokens de docs/design/tokens.css)
    ├── assets/             # app-icon.png, logo.webp
    ├── i18n/               # index.ts + pt-BR.json
    ├── types/              # DTOs da API (interfaces e enums): api, auth, user, group, wallet, …
    ├── Services/           # apiHelpers (fetch, sessão, ApiError) + um service por entidade
    ├── Contexts/           # um Context por entidade + UiContext
    ├── hooks/              # useAuth, useWallet, … , useGoogleSignIn, useOnUserChange
    ├── components/
    │   ├── ui/             # Button, TextField, MoneyInput, SegmentedControl, Sheet, Modal,
    │   │                   # ConfirmModal, Badge, Banner, Skeleton, EmptyState, ErrorState, …
    │   ├── layout/         # AppShell, TabBar, Sidebar, LargeTitleHeader, Fab, RequireAuth
    │   ├── brand/          # Logo, AppIcon
    │   ├── wallet/         # BalanceHero, WalletCard, WalletSection, WalletForm, …
    │   ├── group/          # MemberRow, MemberManager, GroupForm, VisibilityPicker
    │   ├── statement/      # PeriodPicker, StatementTotals, StatementEntryRow, detalhe
    │   └── transaction/    # TransactionSheet (TypeStep, FormStep, PreviewStep)
    ├── pages/              # Login, Register, Home, Wallets, WalletStatement, Group, Member,
    │                       # Account, NotFound (+ *.test.tsx)
    ├── utils/              # money, dates, totals, walletGrouping, notify, validation, …
    └── test/               # setup.ts, utils.tsx (render com providers, fetch simulado), fixtures
```

Os testes ficam ao lado do código (`*.test.ts[x]`).

## Convenções

- **Arquitetura por entidade** (skill `react-architecture`): Types → Service → Context → Hook →
  provider em `main.tsx`. Use `interface` em vez de `type`, arrow functions, `useCallback` em
  todos os métodos de Context, estado `loading`/`error` e nada de `any`.
- **Services devolvem o DTO direto** em respostas 2xx e lançam `ApiError` (`status`, `mensagem`,
  `erros`) em não-2xx, a partir do envelope `{ sucesso, mensagem, erros }` do backend. Falha de
  rede vira `ApiError` com status 0 e mensagem genérica (research R-02).
- **Sessão** em `localStorage["finami:auth"]` (`{ token, expiresAt, user }`), nunca em cookie.
  Sessão vencida ou corrompida é descartada. Um 401 em requisição autenticada encerra a sessão e
  leva a `/entrar` com "Sua sessão expirou" (R-04).
- **Valores monetários** vão para a API como **string decimal com ponto** (`"amount": "0.00000001"`)
  e são validados antes do envio: > 0; até 2 casas em BRL e 8 em BTC. A exibição usa `pt-BR`
  (`R$ 1.234,56`, `₿ 0,12345678`), com "−" (U+2212) nos negativos. O total da Home é somado em
  centavos inteiros (R-09).
- **Datas** no fuso `America/Sao_Paulo`; períodos do extrato em `yyyy-MM-dd`, com no máximo 366
  dias (R-12).
- **Feedback**: toasts com `sonner` (`utils/notify.ts`) e confirmações com `ConfirmModal`. Nunca
  `alert()` nem `window.confirm()`.
- **Textos** sempre em `src/i18n/pt-BR.json`.
- **Acessibilidade (WCAG 2.1 AA, Princípio IX)**:
  - alvos de toque ≥ 44 px;
  - `<label>` em todo campo, erros ligados por `aria-describedby`;
  - botões só com ícone têm `aria-label`;
  - foco visível; folhas e modais prendem o foco e fecham com `Esc`;
  - animações respeitam `prefers-reduced-motion`;
  - zoom não é bloqueado;
  - informação nunca depende só da cor.

  Os testes de tela rodam `axe` (`vitest-axe`).

## Design

Direção visual "Noite Roxa", tokens, especificação de componentes e mockups em
[`docs/design/`](../docs/design/):
- [`docs/design/README.md`](../docs/design/README.md): índice;
- [`tokens.css`](../docs/design/tokens.css): bloco `@theme` copiado para `src/index.css`, com a tabela de contraste;
- [`components.md`](../docs/design/components.md): anatomia, estados e acessibilidade de cada componente;
- [`mockups/`](../docs/design/mockups/): telas em 390 px e 1440 px.
