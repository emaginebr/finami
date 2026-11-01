# Research: Frontend do Finami (mobile-first)

**Feature**: `002-finami-frontend-mobile` · **Data**: 2026-11-01

Cada item segue o formato **Decisão / Racional / Alternativas consideradas**. Não restam itens
"NEEDS CLARIFICATION".

---

## R-01 — Stack e versões

**Decisão**: React 18.3 + TypeScript 5.x + Vite 6 + Tailwind CSS 4 (plugin `@tailwindcss/vite`)
+ React Router 6 (`createBrowserRouter`) + i18next 25 / react-i18next 15 (só `pt-BR`) + Fetch
API. Bibliotecas de apoio: `sonner` (toasts, skill `react-alert`), `@radix-ui/react-dialog`
(modais e folhas, skill `react-modal`), `lucide-react` (ícones). Testes com Vitest 3,
@testing-library/react 16, @testing-library/user-event, jsdom e `vitest-axe`.

**Racional**: é exatamente a stack fixa da constituição (Princípio II). Radix Dialog entrega
foco preso, `Esc` e `aria-*` prontos (Princípio IX) sem trazer um framework de componentes.
`lucide-react` tem ícones com traço fino, próximos do SF Symbols do iOS.

**Alternativas**: shadcn/ui completo (o `ux-designer` o usa como referência visual, mas trazer o
CLI e dezenas de componentes não se paga em 8 telas — usamos só os primitivos Radix necessários);
Headless UI (duplicaria a função do Radix já exigido pela skill `react-modal`); MUI/Bootstrap
(proibidos pela constituição).

## R-02 — Formato de resposta da API x skill `react-architecture`

**Decisão**: os Services devolvem o DTO do backend diretamente em respostas 2xx. Em respostas
não-2xx, `handleResponse` lê o envelope `{ sucesso, mensagem, erros }` (`ErrorResult`) e lança
`ApiError` (com `status`, `mensagem` e `erros`); 401 chama `onUnauthorized`. Os Contexts mantêm o
resto do padrão da skill: estado `loading`/`error`, `handleError` que registra e relança,
`clearError` e `useCallback` em todos os métodos.

**Racional**: o backend (feature 001) devolve `WalletInfo`, `GroupInfo` etc. sem envelope em caso
de sucesso e só usa o envelope em erros (README do backend, "Respostas de erro"). Envolver cada
resposta de sucesso em `{ sucesso: true, ... }` exigiria mudar 28 rotas já testadas.

**Alternativas**: mudar o backend para sempre envelopar (quebra contrato e testes da 001);
fingir o envelope no Service (código morto, `sucesso` sempre `true`).

## R-03 — Casing de diretórios

**Decisão**: `src/Contexts/`, `src/Services/`, `src/hooks/`, `src/types/` (constituição,
Princípio III). Os exemplos da skill usam `src/contexts`/`src/services`; prevalece a constituição.

**Racional**: a governança diz que, em conflito, vale a constituição.

## R-04 — Sessão e armazenamento do token

**Decisão**: `AuthContext` guarda `{ token, expiresAt, user }` no `localStorage` na chave
`finami:auth` (Princípio VI). Ao iniciar o app e antes de cada requisição, a sessão vencida
(`expiresAt` ≤ agora) é descartada. Qualquer 401 chama o handler registrado pelo `AuthProvider`
(`setUnauthorizedHandler` em `Services/apiHelpers.ts`), que limpa a sessão e navega para
`/entrar` com `state.from` (rota atual) e a mensagem "Sua sessão expirou". Após entrar, a pessoa
volta para `from`.

**Racional**: cumpre FR-002/FR-003 e o edge case de sessão expirada sem cookies (FR-035).

**Alternativas**: refresh token (o backend não emite); `sessionStorage` (perderia o login ao
fechar a aba, contra FR-002).

## R-05 — Login com Google

**Decisão**: carregar sob demanda o script do Google Identity Services
(`https://accounts.google.com/gsi/client`) num hook `useGoogleSignIn`, renderizar o botão oficial
(`google.accounts.id.renderButton`, tema `filled_black`, `locale: "pt-BR"`) e enviar o
`credential` (ID token) para `POST /api/auth/google`. O Client ID vem de `VITE_GOOGLE_CLIENT_ID`;
sem ele o botão não é exibido.

**Racional**: o backend já valida ID token (`GoogleJsonWebSignature`); o botão oficial atende às
regras de marca do Google e é acessível. Nenhuma dependência extra.

**Alternativas**: `@react-oauth/google` (mesma coisa com uma dependência a mais); fluxo de
redirect OAuth com code (exigiria endpoint de callback e segredo no backend).

## R-06 — Paleta e direção visual

**Decisão**: cores-semente amostradas da `docs/logos/logo.png`:

| Papel | Cor da logo | Hex |
|---|---|---|
| Fundo da marca | roxo | `#380159` |
| Destaque / positivo / ação principal | verde "mi" | `#6AE005` (barras `#59DE14`) |
| Texto principal | branco | `#F9F7F9` |
| Apoio (famílias/membros) | azul | `#02A7F4` |
| Apoio / negativo | rosa | `#FD809B` |
| Apoio / avisos | amarelo | `#FFD007` |

O `ux-designer` deriva daí a escala de superfícies escuras (fundo do app mais escuro que o roxo da
logo, cartões um pouco mais claros), estados (hover, pressed, disabled, foco) e valida cada par
texto/fundo contra 4,5:1 (Princípio IX). Tipografia: pilha de fontes do sistema
(`-apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif`) com números
tabulares (`font-variant-numeric: tabular-nums`) nos valores.

**Racional**: fonte do sistema dá a aparência nativa de iOS no iPhone e não custa download
(SC-001). Valores negativos usam rosa **e** sinal "−" (informação não depende só da cor).

**Alternativas**: fonte web (Inter/Nunito) — custo de download e visual menos "iOS".

## R-07 — Layout responsivo e navegação

**Decisão**:
- `< 768 px` (celular): barra inferior fixa estilo iOS com três abas (ícone + rótulo), fundo
  translúcido com `backdrop-blur`, altura 49 px + `env(safe-area-inset-bottom)`; cabeçalho grande
  no topo de cada tela (título estilo "Large Title" do iOS).
- `≥ 768 px`: barra lateral fixa de 240 px com logo e as mesmas três entradas; conteúdo
  centralizado com largura máxima de 720 px.
- Botão flutuante "+" de 56 px no canto inferior direito, acima da barra inferior no celular;
  presente em Home, Carteiras e extrato (FR-009).
- `index.html` com `viewport-fit=cover`, sem `maximum-scale`/`user-scalable=no` (zoom liberado,
  Princípio IX); `lang="pt-BR"`.
- Folhas (sheets): Radix Dialog que no celular abre de baixo, com alça e cantos superiores
  arredondados; no desktop vira modal central.

**Racional**: replica a navegação do iPhone pedida e mantém uso confortável no desktop (FR-004,
FR-005, SC-004).

**Alternativas**: barra inferior também no desktop (estranho em telas largas); menu hambúrguer
(esconde as três seções principais).

## R-08 — Ícone de app (logotipo com a casa, padrão iOS)

**Decisão**: script `frontend/scripts/generate-icons.mjs` (Node + `sharp`, devDependency) recorta
a casa com a família da `docs/logos/logo.png` (sem o texto "Finami"), centraliza num quadrado
roxo com a margem de segurança do iOS e gera:

| Arquivo | Tamanho | Uso |
|---|---|---|
| `public/apple-touch-icon.png` | 180×180, opaco | Ícone na tela inicial do iPhone (o iOS arredonda) |
| `public/icon-192.png`, `public/icon-512.png` | maskable | Manifest / Android |
| `public/favicon-32.png` | 32×32 | Favicon |
| `src/assets/app-icon.png` | 512×512 | Ícone exibido no app (login e barra lateral) com cantos de "squircle" via CSS (`border-radius: 22.37%`) |
| `src/assets/logo.webp` | largura 640 | Logo completa com o texto |

`public/manifest.webmanifest` com `display: "standalone"`, `background_color` e `theme_color`
do fundo escuro. O `ux-designer` define o recorte, a margem e valida o resultado; as imagens
geradas são versionadas (o script só roda quando a logo mudar).

**Racional**: atende FR-007/FR-008 a partir da logo oficial, sem redesenhar a marca.

**Alternativas**: redesenhar a casa em SVG (risco de divergir da marca); usar a logo inteira
como ícone (ilegível em 180 px).

## R-09 — Valores monetários: entrada, envio e exibição

**Decisão**:
- **Entrada**: campo `inputMode="decimal"` aceitando vírgula ou ponto; normalizado para string
  decimal com ponto (`"1234.56"`). Validação: > 0 e no máximo 2 casas (BRL) ou 8 casas (BTC),
  antes do envio (FR-019).
- **Envio**: o valor vai no JSON como **string decimal** (`"amount": "0.00000001"`). O backend
  passa a aceitar números em string (`JsonNumberHandling.AllowReadingFromString`).
- **Exibição**: `Intl.NumberFormat("pt-BR")` — BRL `R$ 1.234,56`; BTC `₿ 0,12345678`
  (8 casas fixas).
- **Soma do total da Home**: feita em centavos inteiros
  (`Σ round(valor × 100)`), somando o `balance` das carteiras BRL e o `estimatedBrl` das BTC.

**Racional**: `JSON.stringify(0.00000001)` produz `1e-8`, e números JS não representam todo
decimal com exatidão; string evita perda e notação exponencial. Somar em centavos garante o
SC-003 ("centavo a centavo").

**Alternativas**: enviar número e torcer para o parser do .NET aceitar expoente; biblioteca de
decimal (big.js) — desnecessária para soma de centavos e formatação.

## R-10 — Dados da Home e agrupamento

**Decisão**: a Home busca em paralelo `GET /api/wallets` (carteiras ativas que a pessoa
controla), `GET /api/groups` e `GET /api/quotes/btc`. Seções: uma por família (ordem alfabética
`localeCompare("pt-BR")`, carteiras por nome), depois "Avulsas" (`groupId === null`). O **total**
considera só carteiras com `ownerUserId === usuário logado`. Se a cotação estiver indisponível
(503) ou alguma carteira BTC vier com `estimatedBrl === null`, as carteiras BTC ficam fora do
total e aparece o aviso (FR-012). Cotação desatualizada (`isStale`) é exibida com o horário e um
selo "desatualizada".

**Racional**: reaproveita rotas existentes; o cálculo fica num utilitário puro e testável
(`utils/totals.ts`, `utils/walletGrouping.ts`).

## R-11 — Saldo por membro (US5) — extensão do backend

**Decisão**: duas rotas novas de leitura no backend (contrato em
`contracts/api-additions.md`):
- `GET /api/groups/{groupId}/balances` — saldo de cada membro nas carteiras ligadas à família.
- `GET /api/users/{userId}/group-balances` — carteiras do membro em todas as famílias que quem
  pergunta pode ver.

Ambas devolvem `detailLevel` (`Full`, `Summary` ou `Hidden`) calculado pela visibilidade do grupo,
de modo que o frontend só apresenta o que recebe (SC-006 garantido no servidor).

**Racional**: as rotas atuais não somam por membro e, com visibilidade `MembersSummary`, o membro
não pode listar carteiras de outros; calcular no cliente exigiria vazar dados.

**Alternativas**: usar `GET /api/statements/groups/{id}` (soma por moeda, não por membro);
várias chamadas por carteira (N+1 e bloqueadas pela permissão).

## R-12 — Período do extrato e fuso

**Decisão**: período padrão = mês corrente no fuso `America/Sao_Paulo` (calculado com
`Intl.DateTimeFormat` e `timeZone`). Atalhos: "Este mês", "Mês passado", "Últimos 30 dias",
"Personalizado" (dois `input type="date"`). Bloqueio no cliente para início > fim e > 366 dias,
espelhando o servidor. Datas enviadas como `yyyy-MM-dd`; horários dos lançamentos exibidos em
`dd/MM/yyyy HH:mm` no fuso de Brasília (FR-033).

## R-13 — Estado e atualização após lançamentos

**Decisão**: um Context por entidade (Auth, User, Group, Wallet, Quote, Transaction, Statement,
Balance), criados com a skill `react-architecture`. O `TransactionContext`, após gravar ou
estornar, chama `refreshWallets()` e incrementa `ledgerVersion`; telas de extrato e de saldos
recarregam quando `ledgerVersion` muda (FR-020).

**Racional**: Context API é o padrão obrigatório; o contador evita acoplar telas entre si.

**Alternativas**: React Query/SWR (cache automático, mas fora da stack e duplicaria os Contexts).

## R-14 — Destino de transferência de outra pessoa

**Decisão**: na Transferência, o destino é escolhido entre as carteiras que a pessoa controla ou
por "Outra carteira (código)": a pessoa digita o código, o app chama
`GET /api/wallets/{id}/public` e mostra nome da carteira, moeda e titular, exigindo confirmação.
A prévia (`POST /api/transactions/transfer/preview`) é chamada sempre que as moedas diferem
(FR-017/FR-018). O botão "Confirmar" fica desabilitado se a prévia falhar com 503.

## R-15 — Testes

**Decisão**:
- Unitários (Vitest): `utils/money`, `utils/totals`, `utils/walletGrouping`, `utils/dates`,
  `Services/apiHelpers` (`handleResponse` com 2xx, envelope de erro e 401).
- Componentes (Testing Library + `vitest-axe`): Home (total, seções, aviso sem cotação),
  folha de transação (validação de casas decimais, prévia, confirmação de terceiro), extrato,
  tela da família (três níveis de detalhe), login. `fetch` simulado com `vi.fn`.
- Acessibilidade: `axe` sem violações nas telas testadas; Lighthouse Acessibilidade ≥ 95 no
  quickstart.
- Backend: testes xUnit do novo `BalanceService` (visibilidade × níveis de detalhe, totais,
  cotação ausente).

**Alternativas**: MSW (mais realista, mas mais uma dependência para poucos cenários); Playwright
E2E (fica para quando houver ambiente com banco).

## R-16 — Desempenho (SC-001)

**Decisão**: rotas carregadas com `React.lazy` (Home e login no bundle inicial); chamadas da Home
em paralelo; meta de JS inicial ≤ 200 KB gzip, verificada no `npm run build`. Esqueletos
(skeletons) nos cartões enquanto carrega.

## R-17 — Variáveis de ambiente

**Decisão**: `VITE_API_URL` (obrigatória, ex. `http://localhost:5145`), `VITE_SITE_BASENAME`
(opcional) e `VITE_GOOGLE_CLIENT_ID` (opcional; sem ela o login Google some). Arquivo
`frontend/.env.example` versionado; `.env*` reais no `.gitignore`.

## R-18 — Distribuição do trabalho entre agentes (Princípio VIII)

**Decisão**:
- `ux-designer`: direção visual, tokens (`@theme` do Tailwind 4 em CSS), mockups HTML das telas
  (Home, Carteiras, extrato, família, membro, conta, login, folha de transação), especificação
  dos componentes e geração dos ícones (R-08).
- `frontend-react-developer`: todo o código em `frontend/` a partir dos tokens e mockups, usando
  as skills `react-architecture`, `react-modal` e `react-alert`.
- `dotnet-senior-developer`: rotas de saldo por membro (R-11) e `AllowReadingFromString` (R-09),
  com testes, usando a skill `dotnet-architecture`.

Ordem: contrato da API (este plano) → backend e design em paralelo → frontend.
