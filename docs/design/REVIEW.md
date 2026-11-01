# Revisão de design — telas implementadas × mockups (T091)

Feature `002-finami-frontend-mobile` · direção **Noite Roxa** · referência: [`mockups/`](./mockups/),
[`components.md`](./components.md), [`DESIGN_DIRECTION.md`](./DESIGN_DIRECTION.md), [`tokens.css`](./tokens.css).
Consumo: `frontend-react-developer` (T092 aplica os ajustes; T093 cobre a passada de acessibilidade).

## Como foi feita

- Frontend em `vite` (dev) com `VITE_API_URL` apontando para uma API simulada em Node (fora do repositório),
  com dados realistas e propositalmente difíceis: nomes de carteira e de família longos, saldo de
  R$ 1.234.567,89, saldo negativo, carteira virtual, carteira BTC, pessoa sem login com sobrenome longo.
- Capturas no Chrome headless via DevTools Protocol em **320, 390, 768 e 1440 px**, com
  `safe-area-inset-top: 47px` / `bottom: 34px` simulados abaixo de 768 px (iPhone com Dynamic Island).
- Modos da API simulada: normal, vazio, erro 500, sem cotação (503), cotação desatualizada e lento (skeleton).
- Contraste medido no DOM renderizado (cor do texto × fundo efetivo, com transparências compostas).
- Foco medido com `Tab` real e `getComputedStyle(document.activeElement)`.
- O botão do Google não foi avaliado: sem `VITE_GOOGLE_CLIENT_ID` ele não é exibido (comportamento correto).

Severidade: **alta** = quebra de layout, informação perdida ou falha de acessibilidade; **média** = divergência
visível do mockup ou da regra de design; **baixa** = acabamento.

---

## 1. Resumo transversal

### 1.1 Valores longos em 320 px — a principal falha

O padrão "valor `shrink-0` + nome flexível" funciona até ~360 px, mas em 320 px com valores de 7 dígitos o
nome fica com ~45 px e quebra **dentro da palavra** ("Reser / va …"), e em `MemberRow` o nome some por
completo atrás do selo "Responsável". Ajustes nos itens H-1, H-2, H-3 e H-4 abaixo.

### 1.2 Contraste real (medido)

Todos os textos medidos passam AA com folga. Menores valores encontrados:

| Texto | Cor / fundo | Razão |
|---|---|---|
| `≈ R$ 50.518,51` (text-subtle, 13 px) | `#A08DB3` / `#1E0631` | 6,18:1 |
| selo "virtual" (info, 12 px 600) | `#3DB8F5` / `#0E2442` | 6,94:1 |
| "Saldo total" (muted sobre hero) | `#BCACCC` / `#380159` | 7,53:1 |
| `−R$ 342,10` (negative) | `#FD809B` / `#1E0631` | 7,76:1 |
| rótulo da TabBar inativo (11 px 600) | `#BCACCC` / `#190428` | 9,12:1 |
| selo "desatualizada" | `#FFD007` / `#33290A` | 9,76:1 |
| item ativo da Sidebar | `#F9F7F9` / `#4A0F73` | 12,26:1 |

Única exceção: o "G" do vínculo Google na Conta (`#4285F4` sobre branco, 3,34:1) — é marca, não texto
informativo, mas hoje é um caractere de texto; ver item C-3.

### 1.3 Safe area

- Topo: `pt-safe` no conteúdo, cabeçalho de auth e 404 — correto (título começa abaixo da ilha).
- Base: TabBar com `pb-safe`, FAB em `tabbar + safe + 16px`, sheet com safe area — correto.
- Falta a **horizontal** (iPhone deitado): ver item G-4.

### 1.4 Barra lateral ≥ 768 px

Fiel ao mockup em 768 e 1440: Sidebar fixa de 240 px em `surface`, Logo no topo, item ativo em
`brand-tint` + ícone verde + peso 600 + `aria-current`, TabBar oculta, conteúdo centralizado em 720 px no
espaço restante, FAB em `right: max(24px, (100vw − 960px)/2 − 72px)` (168 px em 1440 = 16 px à direita da
coluna, como especificado). Diferenças: item G-3 (rodapé sem avatar).

### 1.5 Foco visível

Anel `2px solid #5CC8FF` presente em links, linhas de lista (offset −2 px), segmented e botões; ordem de
`Tab` coerente; "Pular para o conteúdo" funciona. Problema: o elemento focado pode ficar **atrás da FAB e da
TabBar** (item G-1).

### 1.6 Ícone do app (observação extra) — feito

`frontend/src/assets/app-icon.png` tinha **176 KB** e é usado em login, cadastro, 404 e carregamento
(no máximo a 96 px CSS). `frontend/scripts/generate-icons.mjs` agora também gera
**`frontend/src/assets/app-icon.webp` — 288 × 288 px (96 px × 3), 6,4 KB** (`npm run icons` já executado;
os demais arquivos saíram idênticos em tamanho). Ver item G-5 para a troca do import.

---

## 2. Ajustes gerais (casca e componentes compartilhados)

1. **G-1 · alta · foco escondido pela FAB/TabBar** — `frontend/src/index.css` (base de `html`).
   Ao navegar por `Tab`, a linha focada rola para a borda inferior e fica coberta pela FAB e pela TabBar
   (capturado: "Mesada do Theo" com o valor sob a FAB). Adicionar
   `html { scroll-padding-bottom: calc(var(--spacing-tabbar) + env(safe-area-inset-bottom) + 88px); }`
   e, em `md`, `scroll-padding-bottom: 96px`. (WCAG 2.4.11.)
2. **G-2 · alta · `SegmentedControl` estoura em 320 px** — `components/ui/SegmentedControl.tsx`.
   Com quatro opções (PeriodPicker) ou "Transferência" (folha), o grupo passa da largura: "Personalizado"
   e "Transferência" ficam cortados e a página ganha **12 px de rolagem horizontal** no extrato.
   Trocar `auto-cols-fr` por `grid-cols-[repeat(N,minmax(0,1fr))]` (N = número de opções), permitir quebra
   no rótulo (`whitespace-normal break-words hyphens-auto`, já há `leading-tight`) e reduzir para
   `text-footnote` abaixo de 360 px (`max-[359px]:text-footnote`). Alternativa para o PeriodPicker:
   rótulo curto "Período" no lugar de "Personalizado" abaixo de 360 px, mantendo `aria-label` completo.
3. **G-3 · baixa · rodapé da Sidebar sem avatar** — `components/layout/Sidebar.tsx`.
   Mockup: avatar de iniciais 32 px + nome (`gap-2.5`, `text-footnote text-text-muted`). Hoje só o nome.
   Usar `<Avatar size="sm" colorIndex={0}>` (mesma cor da aba Conta).
4. **G-4 · média · safe area lateral (paisagem)** — `components/layout/AppShell.tsx`, `TabBar.tsx`, `Fab.tsx`, `Sheet.tsx`.
   Só há `pt-safe`/`pb-safe`. Com o iPhone deitado, conteúdo, TabBar e FAB encostam no recorte da câmera.
   Criar utilitários `pl-safe`/`pr-safe` e usar `padding-inline: max(var(--spacing-gutter), env(safe-area-inset-left/right))`
   no conteúdo; TabBar com `px-[env(safe-area-inset-left)]`; FAB `right: calc(1rem + env(safe-area-inset-right))`.
5. **G-5 · média · trocar o import do AppIcon** — `components/brand/AppIcon.tsx`.
   `import appIconUrl from "../../assets/app-icon.png"` → `"../../assets/app-icon.webp"` (176 KB → 6,4 KB).
   Depois de trocar, `app-icon.png` em `src/assets/` deixa de ser usado pelo app; pode continuar sendo
   gerado (é a fonte do WebP) — se for removido do script, gerar o WebP direto do recorte.
6. **G-6 · média · erro 500 exibido como falta de conexão** — `components/ui/ErrorState.tsx` e chamadas nas páginas.
   Com a API respondendo 500, a Home mostra "Não foi possível conectar / Verifique sua internet". Usar o ícone
   `WifiOff` + esse texto só quando `ApiError.isNetworkError`; nos demais casos, `CircleAlert` +
   "Algo deu errado" + `mensagem` do servidor, com o mesmo botão "Tentar novamente".
7. **G-7 · baixa · anel de foco quadrado no botão "OK" da sheet** — `components/ui/Sheet.tsx`.
   O botão de ação do cabeçalho mostra o anel retangular sem raio. Adicionar `rounded-md` ao botão
   (o `outline` acompanha o `border-radius`).

---

## 3. Por tela

### 3.1 Entrar — `/entrar` (`pages/LoginPage.tsx`, `components/layout/AuthLayout.tsx`)

**Fiel:** AppIcon + Logo, título, campos com rótulo, botão verde de 48 px, link "Criar conta", largura
máxima 384 px centralizada no desktop, faixa de erro `role="alert"` com ícone + texto, erro no campo de senha
com borda rosa e mensagem, email preservado após erro. 320 px sem quebras.

1. **L-1 · baixa** — mockup tem 32 px entre o bloco da marca e o título; hoje ~24 px. `AuthLayout`/`LoginPage`:
   margem inferior do bloco da marca `mb-8`.
2. **L-2 · baixa (não verificável aqui)** — com `VITE_GOOGLE_CLIENT_ID` definido, conferir separador "ou"
   (`text-footnote text-text-subtle`, hairline `separator`) e botão `filled_black` em largura total, como no mockup.

### 3.2 Criar conta — `/cadastro` (`pages/RegisterPage.tsx`)

**Fiel:** voltar "Entrar" em verde, AppIcon 48 px ao lado do título, subtítulo, Nome/Sobrenome lado a lado
≥ 360 px e empilhados em 320 px, ajuda da senha, erros por campo com ícone.

1. **R-1 · baixa** — com erro na senha aparecem ajuda **e** erro ("Mínimo de 8 caracteres." + "A senha precisa
   ter pelo menos 8 caracteres."). Mockup: o erro substitui a ajuda. Em `PasswordField`/`TextField`, esconder
   o `hint` quando houver `error` (manter ambos no `aria-describedby` não é necessário).

### 3.3 Home — `/` (`pages/HomePage.tsx`, `components/wallet/*`)

**Fiel:** data em caixa alta, Large Title "Olá, Ana", BalanceHero com `text-hero` fluido (R$ 1.297.425,20
cabe em 320 px), cotação com horário, selo "desatualizada" com ícone, aviso amarelo de cotação indisponível
com BTC "sem cotação", seções por família (A→Z) com ponto colorido + chevron e "Avulsas" por último,
skeleton no formato do hero e das linhas, estado vazio com "Criar carteira", erro com "Tentar novamente",
FAB posicionada certa nas quatro larguras.

1. **H-1 · alta · nome da carteira quebra no meio da palavra em 320 px** — `components/wallet/WalletCard.tsx`
   (e `WalletBalanceRow.tsx`, mesmo padrão). "Reserva de emergência…" vira "Reser / va …" porque o valor
   `R$ 1.234.567,89` ocupa tudo e `line-clamp-2-anywhere` quebra em qualquer ponto. Ajuste:
   - coluna do nome com `min-w-[7.5rem]` e quebra normal (`line-clamp-2 break-words hyphens-auto`,
     sem `anywhere`);
   - a linha vira `flex-wrap`: quando não couber, o valor desce para uma segunda linha alinhada à direita
     (`ms-auto basis-auto`), em vez de espremer o nome. Assim nenhum valor trunca e nenhum nome é picotado.
2. **H-2 · média · selo "virtual" some em < 768 px** — `WalletCard.tsx`. O selo está dentro da linha de
   subtítulo com `truncate`, e "Real · de Theo Silva · …" corta o selo. Mockup: selo sempre visível. Colocar o
   selo antes do titular ("Real · `virtual` · de Theo Silva") e truncar só o nome do titular (span próprio
   com `truncate min-w-0`, selo `shrink-0`).
3. **H-3 · média · cabeçalho de família longo** — `components/wallet/WalletSection.tsx`. Com nome de 3 linhas
   em 320 px, ponto e chevron ficam centralizados verticalmente no bloco. Usar `items-start`, ponto com
   `mt-[5px]` (alinhado à primeira linha), chevron também no topo, e `line-clamp-2` no nome.
4. **H-4 · baixa** — mockup: a seção da família tem a linha "R$ total" à direita só na tela do membro; na Home
   não. Está correto; apenas registrar que os nomes longos de família ficam com `tracking-wide` em caixa alta e
   ficam bem mais longos — considerar `line-clamp-2` (já em H-3).

### 3.4 Folha de lançamento (`components/transaction/*`, `components/ui/Sheet.tsx`)

**Fiel:** sobe de baixo com alça, scrim, "Cancelar" à esquerda e título centralizado, três opções de 60 px
com ícone/título/descrição e foco inicial na primeira, formulário com SegmentedControl, SelectRow da carteira
com saldo, MoneyInput grande com prefixo, "Disponível", descrição com contador, botão primário fixo no rodapé;
no desktop vira modal central de 480 px.

1. **T-1 · alta** — "Transferência" cortado no SegmentedControl em 320 px (resolvido por G-2).
2. **T-2 · baixa** — no SelectRow da carteira, o subtítulo "−R$ 342,10 · Casa da Praia c…" corta o nome da
   família, o que é aceitável; mas o valor negativo poderia vir em `text-negative` para coerência com as
   listas (hoje fica `text-muted`). Opcional.

Não foi exercitado com a API simulada: prévia BRL↔BTC, bloqueio 503 e "Outra carteira (código)". Conferir
no T093 contra `mockups/transaction-sheet.html` §2–4.

### 3.5 Extrato — `/carteiras/{id}` (`pages/WalletStatementPage.tsx`, `components/statement/*`)

**Fiel:** voltar com rótulo da origem, lápis, título, "família · moeda · código" com botão copiar, saldo atual,
PeriodPicker com o intervalo abaixo, totais 2×2 no celular e 4 colunas no desktop, grupos por dia ("Hoje",
"Ontem", "29 de outubro"), linhas com ícone por tipo + valor com sinal e cor, compra de bitcoin com cotação na
linha, detalhe em sheet com tabela e "Estornar lançamento" em rosa, estado vazio "Nenhum lançamento no período".

1. **E-1 · alta · PeriodPicker estoura 12 px em 320 px** (resolvido por G-2).
2. **E-2 · alta · "Saldo final" cortado em 320 px** — `components/statement/StatementTotals.tsx`.
   O valor usa `text-title-2 whitespace-nowrap` numa célula de ~144 px; "R$ 11.520,90" passa da borda.
   Usar `text-headline` em todas as células abaixo de 360 px e `text-title-2` só a partir de `min-[360px]:`;
   e trocar `whitespace-nowrap` por `[overflow-wrap:anywhere]` **só como último recurso** (valores longos
   descem de linha em vez de serem cortados).
3. **E-3 · média · título do lançamento trunca cedo** — `components/statement/StatementEntryRow.tsx`.
   Em 320 px a descrição vira "Salário de …", "Mesada sema…" (1 linha), enquanto a linha de detalhe quebra
   em 2–3 linhas. Inverter: título com `line-clamp-2`, detalhe com `truncate`.
4. **E-4 · média · sinal dos totais com espaço** — `StatementTotals.tsx`. Totais saem como `− R$ 2.505,37` e
   `+ R$ 8.620,00` (com espaço); linhas e Home usam `−R$ 342,10`. Padronizar sem espaço, via o mesmo
   formatador (`utils/money.ts`), conforme `DESIGN_DIRECTION.md` §3.
5. **E-5 · baixa · ponto da família no subtítulo** — mockup tem o ponto colorido antes de "Silva · Real ·
   código 1007". Adicionar `<span class="size-2 rounded-pill {familyColorClass}">` antes do nome da família.
6. **E-6 · baixa · menu "mais" (`Ellipsis`)** — o mockup tem lápis + "…" (ações desativar/excluir/mover de
   família). Se essas ações estão dentro do formulário de edição, tudo bem; senão, acrescentar o botão "…".

### 3.6 Carteiras — `/carteiras` (`pages/WalletsPage.tsx`)

**Fiel:** Large Title, "Nova carteira" e "Nova família" logo abaixo (44 px), seção "Famílias" com ícone
`Users` em quadrado na cor de apoio, "N membros · responsável: …" ou selo "Responsável", carteiras agrupadas
como na Home, estado vazio de famílias com convite.

1. **W-1 · média · estado vazio sem carteiras** — com zero famílias e zero carteiras só aparece o cartão
   "Crie sua primeira família"; não há nada sobre carteiras. Mostrar abaixo um `EmptyState` compacto
   "Você ainda não tem carteiras" (mesmo texto da Home) — e, para não repetir CTAs, deixar o botão do
   cartão de família como `variant="secondary"` (o primário já está no topo).
2. **W-2 · baixa** — o nome longo da família na lista "Famílias" trunca em 1 linha ("Casa da Praia
   compartilhada c…"); preferir `line-clamp-2` como nas carteiras.
3. **W-3 · não verificado** — seção "Inativas (N)" recolhida (não havia inativas na simulação). Conferir
   contra `mockups/wallets.html` (estado 2).

### 3.7 Família — `/familias/{id}` (`pages/GroupPage.tsx`, `components/group/MemberRow.tsx`)

**Fiel:** voltar "Carteiras", lápis só para a responsável, título + "N membros · quem vê", hero "Total da
família", aviso azul "Você vê só os totais" no modo Summary, avatares por posição (azul, rosa, amarelo,
verde), "você" na própria linha, "sem carteiras", carteiras da família com titular.

1. **F-1 · alta · nome do membro some quando há selo "Responsável"** — `components/group/MemberRow.tsx`.
   O selo está na mesma linha do nome (`flex items-center gap-2`), o nome `truncate` perde a disputa e vira
   "A" em 390 px e **desaparece** em 320 px ("Carlos Pereira" não aparece). Mockup: selo em linha própria,
   abaixo do nome. Estrutura: nome (`truncate text-headline`) → selo (`mt-0.5`, quando houver) → subtítulo.
2. **F-2 · média · subtítulo inconsistente entre membros** — Ana mostra "você · R$ … · ₿ …"; Bruno e Theo,
   só com reais, não mostram nada, e as linhas ficam com alturas diferentes. Mockup: sempre o detalhe
   ("R$ 100,00"). Mostrar o subtítulo com o valor em reais sempre que `detailLevel !== Hidden`.
3. **F-3 · média · total negativo no hero com sinal depois do prefixo** — `components/wallet/BalanceHero.tsx`.
   Sai "R$ −342,10"; regra: `−R$ 342,10`. Renderizar o sinal antes do prefixo da moeda
   (`<span>−</span><span class="prefix">R$</span><span>342,10</span>`), com `sr-only` "saída de"/"negativo"
   como em `DESIGN_DIRECTION.md` §8.
4. **F-4 · baixa · título muito longo** — nome de família de 60 caracteres ocupa 4 linhas de Large Title em
   320 px. `LargeTitleHeader`: `line-clamp-3 break-words hyphens-auto` e `title` com o nome completo.

### 3.8 Membro — `/pessoas/{id}` (`pages/MemberPage.tsx`)

**Fiel:** hero "Saldo nas famílias", aviso de cotação indisponível dentro do hero, seções por família com total
à direita, carteiras da família Full, cartão "Só o total" com ícone `EyeOff` nas famílias Summary, BTC "sem
cotação".

1. **M-1 · média · avatar abaixo do título** — mockup: avatar 64 px **à esquerda** do nome, com
   "Membro de N famílias que você vê" logo abaixo do nome (cabeçalho em linha, `gap-4`). Hoje o título vem
   sozinho e o avatar + legenda numa linha separada embaixo, gastando ~70 px.
2. **M-2 · média · cor do avatar diferente da tela de origem** — `MemberPage.tsx:113` usa
   `colorIndex={result.userId}`; na família a mesma pessoa usa a posição. Bruno é rosa na família e azul na
   tela dele; Ana é azul na Conta e na família e verde na tela dela. Passar o índice na navegação
   (`state: { colorIndex }` a partir do `MemberRow`) e usar `userId` só como fallback (link direto).
3. **M-3 · baixa · rótulo do voltar** — vindo da família, o mockup mostra o nome da família ("‹ Silva");
   hoje mostra "Carteiras". Usar o `state.from` com o nome da família quando existir.
4. **M-4 · baixa** — cabeçalho de família longo com o total à direita: o chevron fica minúsculo e
   desalinhado (mesma correção de H-3).

### 3.9 Conta — `/conta` (`pages/AccountPage.tsx`)

**Fiel:** cartão de perfil com avatar 64 px, "Dados pessoais" estilo Ajustes com valor à direita e chevron,
"Segurança" com ícone em quadrado colorido, Google "✓ Vinculado" em verde, "Pessoas que cadastrei" com nota
explicativa, sem FAB, email longo trunca sem estourar em 320 px.

1. **C-1 · média · "Sair" não está em rosa** — mockup e regra de cor: ação destrutiva em `text-negative`,
   centralizada. Hoje o texto/ícone é `text-text`. Trocar para `text-negative` (contraste 7,76:1 sobre `surface`).
2. **C-2 · baixa · subtítulo das pessoas cadastradas** — mockup: "sem login · família Silva". Hoje só "sem login".
   Acrescentar as famílias em que a pessoa está (quando houver).
3. **C-3 · baixa · ícone do Google** — hoje é a letra "G" azul em quadrado branco (3,34:1, e um leitor de tela
   lê "G"). Usar o "G" multicolorido oficial em SVG com `aria-hidden="true"`; o rótulo "Google" já identifica.

### 3.10 Página não encontrada (`pages/NotFoundPage.tsx`)

**Fiel:** AppIcon, título, texto e "Voltar para a Home" centralizados, com safe area. Sem ajustes.

---

## 4. Lista consolidada para o T092

| # | Sev. | Onde | Ajuste |
|---|---|---|---|
| G-1 | alta | `index.css` | `scroll-padding-bottom` para o foco não ficar sob FAB/TabBar |
| G-2 / E-1 / T-1 | alta | `ui/SegmentedControl.tsx` | não estourar em 320 px (colunas `minmax(0,1fr)`, quebra, `text-footnote` < 360 px) |
| H-1 | alta | `wallet/WalletCard.tsx`, `WalletBalanceRow.tsx` | nome com largura mínima e quebra normal; valor desce de linha |
| E-2 | alta | `statement/StatementTotals.tsx` | "Saldo final" cortado em 320 px |
| F-1 | alta | `group/MemberRow.tsx` | selo "Responsável" em linha própria |
| G-4 | média | `AppShell`, `TabBar`, `Fab`, `Sheet` | safe area lateral |
| G-5 | média | `brand/AppIcon.tsx` | importar `app-icon.webp` |
| G-6 | média | `ui/ErrorState.tsx` | separar "sem conexão" de "erro do servidor" |
| H-2 | média | `wallet/WalletCard.tsx` | selo "virtual" sempre visível |
| H-3 | média | `wallet/WalletSection.tsx` | cabeçalho de família longo alinhado ao topo, `line-clamp-2` |
| E-3 | média | `statement/StatementEntryRow.tsx` | título `line-clamp-2`, detalhe `truncate` |
| E-4 | média | `statement/StatementTotals.tsx` | sinal sem espaço (`−R$`) |
| W-1 | média | `pages/WalletsPage.tsx` | estado vazio de carteiras + CTA secundário |
| F-2 | média | `group/MemberRow.tsx` | subtítulo com valor para todos os membros |
| F-3 | média | `wallet/BalanceHero.tsx` | `−R$ 342,10` no hero |
| M-1 | média | `pages/MemberPage.tsx` | avatar ao lado do nome |
| M-2 | média | `pages/MemberPage.tsx`, `MemberRow.tsx` | cor do avatar igual à da origem |
| C-1 | média | `pages/AccountPage.tsx` | "Sair" em `text-negative` |
| demais | baixa | — | L-1, L-2, R-1, T-2, E-5, E-6, W-2, W-3, F-4, M-3, M-4, C-2, C-3, G-3, G-7 |
