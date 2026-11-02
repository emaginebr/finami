# Finami — Especificação de componentes

Tarefa T009 · direção [`DESIGN_DIRECTION.md`](./DESIGN_DIRECTION.md) · tokens
[`tokens.css`](./tokens.css) · telas em [`mockups/`](./mockups/).

Os nomes seguem `specs/002-finami-frontend-mobile/contracts/ui-routes.md` e `tasks.md`; o
`frontend-react-developer` deve usá-los como nome de arquivo/componente. Classes citadas são
utilitários do Tailwind 4 gerados pelos tokens (ex.: `bg-surface`, `text-hero`, `rounded-card`).

**Base técnica** (research R-01): sem shadcn CLI; os padrões visuais equivalem a
shadcn `Sheet`/`Dialog`/`AlertDialog` (→ `@radix-ui/react-dialog`), `ToggleGroup`/`RadioGroup`
(→ `SegmentedControl`, `VisibilityPicker` com HTML nativo + teclado), `Switch`, `Skeleton`,
`Badge`. Ícones `lucide-react`, `strokeWidth={1.75}`.

## Regras comuns a todos os componentes

| Regra | Especificação |
|---|---|
| Foco visível | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus` em todo elemento interativo. Dentro de listas o anel fica dentro do cartão (`outline-offset:-2px`) para não ser cortado por `overflow:hidden`. |
| Alvo de toque | mínimo 44×44 px (`min-h-touch min-w-touch`). Ícones menores ganham área de toque transparente. |
| Pressed | linhas: `active:bg-surface-3`; botões cheios: `active:bg-accent-pressed`; transição `motion-safe:transition-colors duration-150`. |
| Hover (ponteiro fino) | mesmas cores do pressed, mas só em `@media (hover:hover)` (`hover:` do Tailwind 4 já respeita isso). |
| Disabled | `aria-disabled`/`disabled`, fundo `surface-2`, texto `text-disabled`, `cursor-not-allowed`, sem hover. |
| Loading | o controle mantém a largura, troca o rótulo por spinner + texto `sr-only` "Enviando…", `aria-busy="true"`, e fica desabilitado (evita duplo envio, FR-034). |
| Valores | `tabular-nums`, nunca quebram (`whitespace-nowrap shrink-0`); quem trunca é o texto ao lado. Negativos com "−" (U+2212) + `text-negative`; positivos de extrato com "+" + `text-positive`. |
| Movimento | toda animação com `motion-safe:`; regra global de `prefers-reduced-motion` em `tokens.css`. |

Breakpoint único: **`md` = 768 px**. "Celular" = abaixo; "desktop" = a partir.

---

## 1. Layout

### AppShell
- **Anatomia**: `TabBar` (celular) ou `Sidebar` (desktop) + `<main id="conteudo">` + `Fab`
  opcional + `<Toaster>` do sonner. Link "Pular para o conteúdo" (`sr-only focus:not-sr-only`)
  como primeiro elemento focável.
- **Celular**: `main` com `px-gutter`, `pt-[env(safe-area-inset-top)]`,
  `pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+88px)]` quando há Fab (senão
  `+24px`).
- **Desktop**: grid `[240px_1fr]`; `main` com `max-w-content mx-auto px-gutter-lg py-8`.
- **Props**: `showFab: boolean`, `onFabClick`, `children`.
- **A11y**: um único `<main>`; navegação em `<nav aria-label="Principal">`.

### TabBar (< 768 px)
- **Anatomia**: `<nav aria-label="Principal">` fixa no rodapé; 3 `NavLink` em colunas iguais —
  **Home** `/` (`House`), **Carteiras** `/carteiras` (`WalletCards`), **Conta** `/conta`
  (`CircleUser`). Ícone 24 px sobre rótulo `text-tab`.
- **Medidas**: altura 49 px + `env(safe-area-inset-bottom)`; cada item ocupa 1/3 da largura e
  toda a altura de 49 px (≥ 44 px). Hairline superior `border-t border-separator`.
- **Fundo**: `bg-tabbar backdrop-blur-xl backdrop-saturate-150`.
- **Estados**: inativo `text-text-muted`; ativo `text-accent` + ícone `strokeWidth={2.25}` +
  `aria-current="page"` (não depende só da cor); pressed `opacity-70`; foco com anel interno.
- **Comportamento**: em telas *push* a aba de origem continua ativa (`/carteiras/:id` e
  `/familias/:id` → Carteiras se veio de lá, senão Home; `/pessoas/:id` → aba da família).
  Com zoom 200 % o rótulo pode quebrar: a barra cresce (`min-h`, nunca `h` fixo).
- **Oculta** em `/entrar` e `/cadastro`; some (`hidden md:hidden`) a partir de 768 px.

### Sidebar (≥ 768 px)
- **Anatomia**: `<aside>` fixo à esquerda, 240 px, `bg-surface border-r border-separator`;
  topo com `Logo` (altura 32 px) em `p-6`; `<nav aria-label="Principal">` com as mesmas 3
  entradas; rodapé com nome da pessoa (`text-footnote text-text-muted`).
- **Item**: 44 px de altura, `rounded-md px-3 gap-3`, ícone 20 px + rótulo `text-callout`.
- **Estados**: padrão `text-text-muted`; hover `bg-surface-2 text-text`; ativo
  `bg-brand-tint text-text font-semibold` com ícone `text-accent` e `aria-current="page"`.
  (Não usar `text-subtle` aqui — contraste insuficiente sobre `brand-tint`.)
- **Topo (feature 003)**: linha `flex items-center justify-between gap-2` com a `Logo` à esquerda
  e o `NotificationBell variant="sidebar"` à direita (ver §7). A logo (40 px de altura ≈ 140 px de
  largura com o contêiner) + o sino de 44 px cabem nos 208 px úteis.

### LargeTitleHeader
- **Anatomia**: linha de navegação de 44 px (voltar à esquerda, ação à direita) + título grande
  `<h1 class="text-large-title">` abaixo, alinhado à margem. Subtítulo opcional
  `text-subhead text-text-muted`.
- **Props**: `title`, `subtitle?`, `backTo?` (rota) + `backLabel?` (ex.: "Carteiras"),
  `actions?: ReactNode` (botões ícone 44 px com `aria-label`).
- **Voltar**: `ChevronLeft` 24 px + rótulo da tela anterior em `text-accent`, alvo ≥ 44 px,
  `aria-label="Voltar para {backLabel}"`.
- **Rolagem (celular)**: ao rolar além do título, a linha de 44 px ganha fundo `bg-tabbar
  backdrop-blur-xl`, hairline inferior e o título compacto `text-title-3` centralizado (fade
  `motion-safe`). Sem JS de rolagem disponível, o título grande simplesmente rola.
- **Desktop**: sem modo compacto; título grande com `pt-8`.
- **Prop nova (feature 003)**: `titleAccessory?: ReactNode` — elemento à direita do `<h1>`, na
  mesma linha. Com ela, o bloco do título vira `flex items-start gap-2`, o `<h1>` fica
  `min-w-0 flex-1` (o `line-clamp-3` continua) e o acessório `shrink-0`. Uso único hoje: o
  `NotificationBell variant="header"` nas telas-raiz das abas (Home, Carteiras, Conta). Não usar
  `actions` para o sino: isso criaria a linha de navegação de 44 px vazia acima do título.

### Fab
- **Anatomia**: `<button aria-label="Novo lançamento">` circular 56 px, `bg-accent
  text-on-accent shadow-fab`, ícone `Plus` 28 px traço 2,5.
- **Posição celular**: `fixed right-4 bottom-[calc(49px+env(safe-area-inset-bottom)+16px)]`
  `z-30` (acima do conteúdo, abaixo de sheets).
- **Posição desktop**: `bottom-8`, `right: max(24px, calc((100vw - 960px) / 2 - 72px))`.
- **Estados**: hover `bg-accent-hover`; pressed `bg-accent-pressed motion-safe:scale-94`;
  foco: anel `outline-focus` com offset 3 px; enquanto a sheet está aberta, `aria-expanded="true"`
  e `aria-haspopup="dialog"`.
- **Presente** em `/`, `/carteiras` e `/carteiras/:walletId` (FR-009).

---

## 2. Sobreposições (Radix Dialog)

### Sheet
- **Celular**: `Dialog.Content` preso embaixo, largura total, `max-h-[92dvh]`, `bg-surface-2
  rounded-t-sheet shadow-sheet`, `pb-[env(safe-area-inset-bottom)]`. Alça decorativa 36×5 px
  `bg-border/60 rounded-pill` centrada a 8 px do topo (`aria-hidden`). Cabeçalho de 56 px:
  botão "Cancelar" ou `ChevronLeft` "Voltar" à esquerda (texto `text-accent`, ≥ 44 px),
  `Dialog.Title` `text-headline` no centro, ação opcional à direita. Corpo rolável `px-4 pb-6`.
- **Desktop**: modal central `max-w-sheet w-full rounded-card`, mesmo cabeçalho;
  `animate-modal-in`.
- **Animação**: `motion-safe:animate-sheet-in`; scrim `bg-scrim motion-safe:animate-fade-in`.
- **A11y**: foco preso, `Esc` e toque no scrim fecham (exceto durante envio — ver
  TransactionSheet); `Dialog.Title` obrigatório; `Dialog.Description` opcional (`sr-only`); foco
  inicial no primeiro campo; ao fechar, foco volta ao gatilho (Fab).
- **Props**: `open`, `onOpenChange`, `title`, `leading?`, `trailing?`, `dismissible?` (default
  `true`), `children`.

### Modal
- Central em todas as larguras, `max-w-sheet`, `bg-surface-2 rounded-card shadow-modal p-6`.
  Título `text-title-2`, corpo `text-body text-text-muted`, rodapé com botões alinhados à direita
  (desktop) ou empilhados em largura total (celular, primário em cima).

### ConfirmModal
- `Modal` com `role="alertdialog"` (Radix `AlertDialog` ou `Dialog` com o papel), props
  `title`, `description`, `confirmLabel`, `cancelLabel = "Cancelar"`, `tone: "default" |
  "destructive"`, `loading`, `onConfirm`.
- `tone="destructive"`: botão de confirmação `Button variant="destructive"`; ícone
  `TriangleAlert` `text-negative` ao lado do título.
- **Foco inicial no botão "Cancelar"** (ação segura). Usado em: Sair, Estornar, Retirar membro,
  Desativar/Excluir carteira, confirmação de destino de terceiro.

---

## 3. Controles

### Button
| Variante | Visual | Uso |
|---|---|---|
| `primary` | `bg-accent text-on-accent font-semibold` | Entrar, Confirmar, Salvar |
| `secondary` | `bg-surface-2 text-text border border-border` | Ações neutras, "Tentar novamente" |
| `ghost` | transparente, `text-accent` | Links de ação, "Cancelar" em cabeçalho |
| `destructive` | `bg-negative text-on-accent` (cheio) ou `text-negative` em `ghost` | Excluir, Sair, Estornar |

- **Tamanhos**: `md` 48 px (padrão, `text-headline`, `px-5 rounded-md`), `sm` 44 px
  (`text-subhead`). Nunca abaixo de 44 px. `block` = largura total.
- **Estados**: hover/pressed conforme regras comuns; `loading` → spinner 18 px + rótulo
  mantido em `sr-only`, desabilitado; `disabled` → regras comuns.
- **Ícone**: opcional à esquerda, 20 px. Botão só com ícone exige `aria-label`.

### TextField
- **Anatomia**: `<label>` acima (`text-footnote text-text-muted font-medium`) → campo 48 px
  `bg-surface-2 border border-border rounded-md px-4 text-body text-text`
  placeholder `text-text-subtle` → ajuda `text-footnote text-text-muted` → erro.
- **Estados**: foco `border-focus` + anel; erro `border-negative` + linha
  `CircleAlert` 16 px + mensagem `text-footnote text-negative` em `role="alert"` ligada por
  `aria-describedby` e `aria-invalid="true"`; disabled conforme regras comuns; somente leitura
  `bg-surface` sem borda.
- **Props**: `label`, `hint?`, `error?`, `type`, `autoComplete` (`email`, `current-password`,
  `new-password`, `given-name`, `family-name`), `required` (asterisco só visual + `required`).
- Senha: botão olho 44 px dentro do campo (`aria-label="Mostrar senha"`/`"Ocultar senha"`,
  `aria-pressed`).

### MoneyInput
- **Anatomia**: `TextField` especial: prefixo da moeda fixo à esquerda (`R$` ou `₿`,
  `text-title-2 text-text-muted`, `aria-hidden`), valor `text-[2rem] font-bold tabular-nums`
  alinhado à esquerda, altura 64 px. Rótulo "Valor" visível; `aria-describedby` aponta para a
  moeda ("em reais"/"em bitcoin", `sr-only`) e para o erro.
- **Entrada**: `inputMode="decimal"`, aceita vírgula ou ponto, placeholder `0,00` (BRL) ou
  `0,00000000` (BTC). Caracteres além das casas permitidas: o campo não aceita **e** mostra
  "Use no máximo 2 casas decimais" / "… 8 casas decimais" (FR-019).
- **Ajuda**: linha abaixo com o saldo disponível da carteira de origem
  ("Disponível: R$ 1.250,00").
- **Estados**: igual ao TextField; erro também por `aria-invalid`.

### SegmentedControl
- **Anatomia**: trilho `bg-surface rounded-pill p-1` (borda `border-border` para 3:1), segmentos
  iguais com altura 44 px (trilho 52 px), `text-subhead font-semibold`.
- **Estados**: selecionado `bg-brand-tint text-text` + `aria-checked="true"` (ou
  `aria-pressed`); não selecionado `text-text-muted`; hover `text-text`.
- **Semântica**: `role="radiogroup"` + `aria-label`, segmentos `role="radio"`, roving tabindex,
  setas ←/→ mudam a seleção, `Home`/`End`.
- **Usos**: tipo de lançamento (Entrada · Saída · Transferência), moeda (Real · Bitcoin),
  PeriodPicker. Com 4 itens em 320 px os rótulos podem quebrar em 2 linhas — permitido.

### Switch (auxiliar, para "Carteira virtual")
- `<button role="switch" aria-checked>` dentro de uma linha de lista de 44 px com rótulo à
  esquerda; trilho 51×31 px (`bg-surface-3` → `bg-accent` ligado), botão branco; estado
  "ligado" também indicado pelo texto auxiliar ("Sim/Não" `sr-only` não é necessário — o papel
  `switch` anuncia).

### Badge (auxiliar, "selo")
- `inline-flex h-5 px-2 rounded-pill text-caption font-semibold` com fundo suave:
  `virtual` (`bg-info-soft text-info`, ícone `Cloud` 12 px), `desatualizada`
  (`bg-warning-soft text-warning`, `Clock`), `estornado` (`bg-surface-3 text-text-muted`,
  `Undo2`), `interna` (`bg-surface-3 text-text-muted`), `Responsável`
  (`bg-positive-soft text-positive`, `Crown`), `inativa` (`bg-surface-3 text-text-muted`).
  Sempre com texto.
- **Variantes novas (feature 003)** — estado final do convite em `NotificationItem`:
  `InviteAccepted` "Você aceitou" (`bg-positive-soft text-positive`, `Check` traço 2,5 —
  8,02:1), `InviteDeclined` "Você recusou" (`bg-surface-3 text-text-muted`, `X` — 7,05:1),
  `InviteCanceled` "Convite cancelado" (`bg-surface-3 text-text-muted`, `Ban` — 7,05:1).

### ListGroup / ListRow (auxiliares, lista agrupada estilo Ajustes)
- `ListGroup`: título opcional `text-footnote uppercase tracking-wide text-text-muted px-4 mb-2`,
  cartão `bg-surface rounded-lg overflow-hidden`, rodapé opcional `text-footnote
  text-text-muted`.
- `ListRow`: `min-h-row` (44) ou `min-h-row-2` (60), `px-4 gap-3`, ícone/avatar 28–36 px à
  esquerda, conteúdo, valor/acessório à direita, `ChevronRight` 18 px `text-text-subtle` quando
  navega. Separador hairline recuado (`ml-4` ou depois do ícone). Pressed `bg-surface-3`.
  Variante `destructive`: texto `text-negative` centralizado ou à esquerda.

---

## 4. Estados de conteúdo

### Skeleton
- Bloco `bg-surface-2 rounded-md` com `motion-safe:animate-shimmer` (gradiente
  `surface-2 → surface-3 → surface-2`, `bg-[length:200%_100%]`); com movimento reduzido, estático.
- Formas prontas: `BalanceHero` (rótulo 96×14, valor 220×40), `WalletCard` (círculo 36,
  2 linhas 140×14 e 80×12, valor 90×16), `StatementEntryRow`.
- O contêiner recebe `aria-busy="true"` e um texto `sr-only` "Carregando…"; os blocos são
  `aria-hidden`.

### EmptyState
- Centralizado, `py-12 px-6`: ícone 40 px em círculo 72 px `bg-surface-2 text-text-muted`,
  título `text-headline`, texto `text-subhead text-text-muted` (máx. 32ch), ação opcional
  `Button primary sm`.
- Mensagens: Home sem carteira "Você ainda não tem carteiras" + "Criar carteira"; extrato
  "Nenhum lançamento no período"; Carteiras sem família "Crie sua primeira família" +
  "Nova família".

### ErrorState
- Mesma anatomia do EmptyState com ícone `WifiOff` (rede/500) ou `CircleAlert`, título "Não foi
  possível conectar", texto do servidor quando houver, `Button secondary` "Tentar novamente"
  (`RotateCw`). Contêiner `role="alert"`.
- Variantes de status (ui-routes): 403 "Sem permissão" (`Lock`), 404 "Não encontrado" +
  "Voltar". A explicação de visibilidade (FR-031) **não** é ErrorState: é um aviso informativo
  (`bg-info-soft`, `EyeOff`) — ver GroupPage.

---

## 5. Marca

### AppIcon
- `<img src={appIcon}>` (`src/assets/app-icon.png`, 512 px) com `rounded-icon` e
  `shadow-card`; tamanhos `sm` 32, `md` 64, `lg` 96 px. `alt` configurável (default `""`
  quando ao lado do texto "Finami"; `"Finami"` quando sozinho).
- Usos: login (lg, acima da logo), Sidebar compacta, `NotFoundPage`.

### Logo
- `<img src={logo} alt="Finami">` (`src/assets/logo.webp`, largura 640, proporção 3:1). Exibir com
  `h-8` (Sidebar), `h-12`/`h-14` (login). A logo já tem fundo `#380159`: exibi-la sobre
  `bg-brand` ou dentro de um contêiner `rounded-lg overflow-hidden` para não criar retângulo
  visível sobre `bg`.

---

## 6. Domínio

### BalanceHero (Home, família, membro)
- **Anatomia**: cartão `bg-brand rounded-card p-5 shadow-card` com leve brilho
  (`radial-gradient` verde a 6 % no canto superior direito, decorativo). Rótulo "Saldo total"
  `text-subhead text-text-muted`; valor `<p class="text-hero tabular-nums">` com prefixo `R$`
  a 60 %; linha da cotação `text-caption text-text-muted`: `₿ 1 = R$ 512.340,00 · 14:32` +
  Badge `desatualizada` quando `isStale`.
- **Aviso sem cotação** (FR-012): faixa abaixo do valor `bg-warning-soft text-warning
  rounded-md p-3 text-footnote` com `TriangleAlert`: "Cotação do bitcoin indisponível. Suas
  carteiras em bitcoin não entraram no total." `role="status"`.
- **Estados**: carregando (skeleton), normal, sem cotação, cotação desatualizada, zero
  (`R$ 0,00` + EmptyState abaixo).
- **A11y**: o valor fica num `<p>` precedido pelo rótulo; `aria-live` **não** (evita leitura a
  cada atualização da cotação).

### WalletSection
- Cabeçalho de seção: ponto 10 px na cor de família (por posição) + nome da família em
  `text-footnote uppercase tracking-wide text-text-muted`. Para famílias, o cabeçalho é um link
  (`/familias/:groupId`) com `ChevronRight` 14 px e alvo ≥ 44 px; "Avulsas" não tem link nem ponto
  colorido (ponto `bg-border`).
- Corpo: `ListGroup` com os `WalletCard`s ordenados por nome. Ordem das seções: famílias A→Z,
  depois "Avulsas" (FR-013).
- Semântica: `<section aria-labelledby>` com `<h2>` no título.

### WalletCard
- `ListRow` de 60 px que é um link para `/carteiras/:walletId`.
- **Esquerda**: ícone 36 px em quadrado `rounded-md` — BRL `Wallet` em `bg-surface-2
  text-accent`; BTC `Bitcoin` em `bg-warning-soft text-warning`.
- **Centro**: nome `text-headline line-clamp-2` (até 2 linhas, depois reticências); linha 2 `text-footnote text-text-muted`: moeda
  ("Real"/"Bitcoin") · titular quando ≠ pessoa logada ("de Pedro") · Badge `virtual`.
- **Direita** (`shrink-0 text-right`): saldo `text-headline tabular-nums` (negativo com "−" e
  `text-negative`); BTC tem segunda linha `≈ R$ 1.250,00` `text-footnote text-text-subtle`
  (ou "sem cotação"); `ChevronRight`.
- **Variante inativa** (aba Carteiras): `opacity-60` no conteúdo + Badge `inativa` (texto, não
  só opacidade).
- **A11y**: `aria-label="{nome}, {moeda}, saldo {valor}[, aproximadamente {brl}][, de {titular}]"`.

### MemberRow
- `ListRow` de 60 px, link para `/pessoas/:userId`. Avatar 40 px `rounded-pill` com iniciais
  (`text-subhead font-bold text-on-family`) na cor de família por posição; nome
  `text-headline truncate` + Badge `Responsável`; à direita total `text-headline tabular-nums`
  ou "—" (`aria-label="valor oculto"`) quando `null`; linha 2 só quando o membro tem BTC: `R$ 300,00 · ₿ 0,00100000`
  (`text-footnote text-text-muted`) em `Full`/`Summary`.
- Variante `Hidden`: sem coluna de valor e **sem** link se a rota do membro não for permitida
  (decisão do frontend conforme a API; o mockup mostra linha sem chevron).

### StatementTotals
- Grade 2×2 em `bg-surface rounded-lg` (celular) / 4 colunas (desktop): "Saldo inicial",
  "Entradas" (`+` `text-positive`, `ArrowDownLeft`), "Saídas" (`−` `text-negative`,
  `ArrowUpRight`), "Saldo final" (`text-title-2`). Rótulos `text-footnote text-text-muted`,
  valores `text-headline tabular-nums`. `<dl>` semântico.

### StatementEntryRow
- `ListRow` 60 px+ (botão que abre o detalhe). Ícone 32 px por tipo (Entrada `ArrowDownLeft`
  verde, Saída `ArrowUpRight` rosa, Transferência `ArrowLeftRight` azul, Compra/Venda `Bitcoin`
  amarelo, Estorno `Undo2` cinza). Centro: descrição (ou o tipo) `text-headline truncate`; linha 2
  `text-footnote text-text-muted`: `dd/mm · HH:mm · Tipo · contraparte` + cotação
  "₿ 1 = R$ 498.000,00" quando houver + Badges `estornado`/`interna`. Direita: valor com sinal e
  cor `text-headline tabular-nums`.
- Linhas agrupadas por dia com cabeçalho `text-footnote uppercase` ("Hoje", "Ontem",
  "12 de outubro").
- **Detalhe** (Sheet): todos os campos em ListGroup + `Button destructive ghost` "Estornar" só
  quando a pessoa controla a carteira e o lançamento não foi estornado → ConfirmModal.

### PeriodPicker
- `SegmentedControl` com "Este mês", "Mês passado", "30 dias", "Personalizado" (rótulo longo
  "Últimos 30 dias" no `aria-label`) + linha `text-footnote text-text-muted` com o intervalo
  ("01/10/2026 – 31/10/2026"). "Personalizado" revela dois `TextField type="date"` ("De", "Até")
  lado a lado (empilhados < 360 px) e o erro "O período máximo é de 366 dias" /
  "A data inicial deve ser anterior à final".

### VisibilityPicker
- `role="radiogroup"` em ListGroup: 3 linhas de 60 px+, cada uma com radio visual (círculo 22 px,
  marcado `bg-accent` + `Check` `text-on-accent`), título `text-headline` e explicação
  `text-footnote text-text-muted`:
  - "Somente o responsável" — "Só você vê saldos e extratos da família. Os membros veem apenas a
    lista de pessoas."
  - "Todos os membros" — "Todos veem os saldos e os extratos de todas as carteiras da família."
  - "Membros veem só os totais" — "Todos veem o saldo de cada pessoa, mas só você abre os
    extratos."

### TransactionSheet (TypeStep · FormStep · PreviewStep)
Implementa data-model §6 sobre o `Sheet`. Ver `mockups/transaction-sheet.html`.
- **TypeStep**: 3 opções em lista de 60 px (ícone 36 px colorido + título + descrição curta):
  Entrada "Dinheiro que chegou de fora", Saída "Dinheiro que saiu", Transferência "Entre
  carteiras".
- **FormStep**: SegmentedControl do tipo no topo (troca rápida), seletor de carteira (ListRow que
  abre lista com saldo de cada carteira; `aria-haspopup="listbox"`), MoneyInput, descrição
  (TextField, contador "0/500"), na Transferência: "Para" com as carteiras próprias + linha
  "Outra carteira (código)" → TextField numérico + botão "Buscar" → cartão de confirmação
  (`bg-surface rounded-lg`, nome, moeda, titular, checkbox/Switch "Confirmo que é a carteira de
  {titular}"). Rodapé fixo com `Button primary block` "Continuar"/"Registrar".
- **PreviewStep**: resumo `Você envia R$ 500,00` → `Recebe ₿ 0,00097591`, tipo
  ("Compra de bitcoin"), cotação e horário, titular do destino. Bloqueado (503): faixa
  `bg-warning-soft` "Cotação indisponível. A conversão não pode ser feita agora." e botão
  "Confirmar" desabilitado.
- **Erro do servidor**: faixa `bg-negative-soft text-negative` com `CircleAlert` no topo do passo
  `role="alert"`, dados preservados.
- **Enviando**: botão em `loading`, Sheet com `dismissible=false` (Esc/scrim ignorados até
  responder) e campos `disabled`.

### WalletForm · GroupForm · MemberManager
- Formulários em ListGroups estilo Ajustes, campos `TextField`; moeda com SegmentedControl
  apenas na criação (na edição, linha somente leitura "Moeda · Real" com `Lock`); virtual com
  Switch; família e titular com linha que abre seleção.
- **MemberManager**: ListGroup "Membros" com avatar + nome + Badge `Responsável`; para o
  responsável, botão `ghost destructive` "Retirar" por linha (≥ 44 px, `aria-label="Retirar
  {nome}"`). Para quem não é responsável, essas partes **não são renderizadas** (FR-028).
  **Feature 003**: o ListGroup "Incluir membro" (busca por email) e a linha "Cadastrar pessoa
  sem login" **saem** do MemberManager; no lugar, rodapé `text-footnote text-text-muted` "Para
  incluir pessoas, use "Adicionar membro" na tela da família." A inclusão passa a ser o
  `AddMemberSheet` (§7).
- Zona de perigo da carteira: ListGroup com "Desativar carteira" e "Excluir carteira"
  (`text-negative`); exclusão bloqueada mostra Modal "Esta carteira tem lançamentos e não pode
  ser excluída. Você pode desativá-la." com ação "Desativar".

---

## 7. Convites e notificações (feature 003)

Mockups: [`add-member-sheet.html`](./mockups/add-member-sheet.html),
[`notifications.html`](./mockups/notifications.html), [`group.html`](./mockups/group.html) e o
sino em [`home.html`](./mockups/home.html), [`wallets.html`](./mockups/wallets.html),
[`account.html`](./mockups/account.html). Textos de resultado e toasts:
`specs/003-family-member-invites/contracts/ui.md` (os demais rótulos abaixo são propostas para
`pt-BR.json`). Nenhum token novo: tudo usa cores já validadas em `tokens.css`.

### NotificationBell
- **Anatomia**: `<Link to="/notificacoes">` (é navegação, não `button`) com ícone `Bell`
  (lucide, traço 1,75) centralizado num alvo de **44×44 px** `rounded-pill`, e selo numérico
  sobreposto ao canto superior direito do ícone.
- **Props**: `variant: "header" | "sidebar"`, `className?`. O número vem do
  `NotificationContext` (`unread`); para testes, `count?: number` sobrescreve o contexto.
- **Posição — celular (`variant="header"`)**: só nas três telas-raiz das abas (Home `/`,
  Carteiras `/carteiras`, Conta `/conta`), via `LargeTitleHeader titleAccessory`. Fica **na linha
  do título grande, à direita**, alinhado à primeira linha do `<h1>`: `-mt-0.5 -mr-2.5` (centro do
  alvo de 44 px no centro da linha de 41 px do título; glifo rente à margem de 16 px). Na Home
  continua abaixo da data ("DOMINGO, 1 DE NOVEMBRO") e ao lado de "Olá, Ana". Recebe `md:hidden`.
  Rola junto com o título (não há barra compacta nas abas hoje). Telas de detalhe (família,
  extrato, membro, notificações) **não** têm sino no celular — o "voltar" leva à aba.
- **Posição — desktop (`variant="sidebar"`)**: no topo da `Sidebar`, na mesma linha da `Logo`,
  alinhado à direita (`-mr-1.5`). Aparece em **todas** as telas ≥ 768 px, inclusive as de detalhe.
- **Cores**: `header` → ícone `text-text` (18,74:1 sobre `bg`), hover `bg-surface-2`, pressed
  `bg-surface-3`. `sidebar` → ícone `text-text-muted` (8,81:1 sobre `surface`), hover
  `bg-surface-2 text-text`. Na rota `/notificacoes` o sino da sidebar fica **ativo**:
  `aria-current="page"`, `bg-brand-tint text-accent` (7,64:1), como os itens da navegação.
  Ícone 24 px no `header`, 22 px na `sidebar`.
- **Selo (`NotificationBadge`, interno)**: `absolute top-[5px] left-[22px] h-[18px]
  min-w-[18px] px-[5px] rounded-pill bg-accent text-on-accent text-tab font-bold leading-[18px]
  tabular-nums text-center`, anel de 2 px na cor do fundo para separar do ícone
  (`ring-2 ring-bg` no header, `ring-surface` na sidebar, `ring-brand-tint` quando ativo).
  Texto: **1–9** com o número; **≥ 10 → "9+"**; **0 → sem selo** (só o sino). Contraste
  `on-accent`/`accent` 11,68:1; selo contra o fundo ≥ 7,6:1 (≥ 3:1 exigido para não-texto).
  O selo é `aria-hidden="true"` — a informação está no `aria-label` e o número é texto (não
  depende de cor).
- **`aria-label`** (com o número **real**, nunca "9+"): 0 → "Notificações"; 1 → "Notificações,
  1 não lida"; N → "Notificações, N não lidas" (i18n com plural: `notifications.bellLabel_zero /
  _one / _other`). Não é região viva: a contagem muda em silêncio (atualizada ao trocar de rota e
  ao voltar à aba, research R-06); quem navega até o sino ouve o valor atual.
- **Foco**: anel padrão `focus-visible:outline-2 outline-offset-2 outline-focus` em volta do
  círculo de 44 px (≥ 9,08:1 sobre `bg`/`surface`/`surface-2`).
- **Navegação**: ao tocar, `navigate("/notificacoes", { state: { tab, backTo, backLabel } })`
  com a aba atual — a aba de origem continua ativa na TabBar/Sidebar e o "voltar" da tela diz
  "Home"/"Carteiras"/"Conta".
- **Movimento**: nenhuma animação no selo (sem pulso/balanço).

### NotificationsPage (`/notificacoes`) e NotificationItem
- **Página**: `LargeTitleHeader title="Notificações"` com `backTo/backLabel` da aba de origem;
  lista `<ul class="bg-surface rounded-lg overflow-hidden" aria-label="Notificações">`; botão
  "Carregar mais" (`Button variant="secondary" size="sm"`, centralizado, `pt-4`) quando
  `nextBeforeId != null`; em loading, "Carregando…" com spinner e `aria-busy`. Ao carregar
  mais, o foco vai para o primeiro item novo.
- **Marcar como lidas**: ao exibir a primeira página (e cada página nova), chamar
  `markRead(ids não lidos)`; o sino zera. O indicador de "não lida" do item **continua
  visível enquanto a pessoa estiver na tela** (usa o `isRead` recebido), para mostrar o que era novo.
- **Item (`<li>`)**: `flex gap-3 px-4 py-3.5`, separador hairline recuado 64 px. Esquerda:
  bloco de ícone 36 px `rounded-[10px]` (mesmo `WalletIcon`/tile): convite recebido `UserPlus`
  `bg-info-soft text-info` (6,94:1); aceito `UserCheck` `bg-positive-soft text-positive`;
  recusado `UserX` `bg-surface-3 text-text-muted`. Centro: frase `text-subhead` com nomes de
  pessoa e família em `font-semibold`; linha meta `text-footnote text-text-muted` com
  `<time dateTime>` ("Hoje às 14:32", "Ontem às 19:05", senão "28 de out.") e, se houver, o
  Badge de estado final.
- **Não lida**: ponto 8 px `bg-accent` a 6 px da borda esquerda, na altura da 1ª linha
  (`aria-hidden`) + `<span class="sr-only">Não lida. </span>` no começo da frase.
- **Convite recebido pendente** (`invitation.status = Pending`): linha de ações `mt-3 flex
  gap-2` com `Button secondary sm` "Recusar" e `Button primary sm` "Aceitar" (44 px; no celular
  `flex-1` cada, no desktop `min-w-32`). `aria-label` com contexto: "Aceitar convite para a
  família {família}" / "Recusar convite para a família {família}".
  Enviando: o botão tocado em `loading` ("Aceitando…"/"Recusando…") e o outro `disabled`.
  Sucesso ao aceitar: toast "Você agora faz parte de {família}.", item passa a "Você aceitou",
  foco vai para a frase do item (`tabIndex=-1`), recarregar famílias e carteiras.
  Recusar não pede confirmação (é reversível: o responsável pode convidar de novo).
- **Estado final** (Accepted/Declined/Canceled): sem botões, Badge `InviteAccepted` /
  `InviteDeclined` / `InviteCanceled` na linha meta.
- **409 "Este convite não está mais disponível."**: `Banner tone="error" role="alert"` dentro do
  item (`mt-2.5`), botões removidos, item recarregado com o estado final.
- **Aceito/recusado (responsável)**: frase "{ator} aceitou o convite para {família}" /
  "recusou". O de **aceito** é um `<Link>` para `/familias/:groupId` (o `<li>` inteiro, hover
  `bg-surface-3`, `ChevronRight` 18 px `text-text-subtle`); o de **recusado** não navega.
- **Vazio**: `EmptyState` com `BellOff`, título "Nenhuma notificação por enquanto" e apoio
  opcional "Convites para famílias aparecem aqui.".
- **Carregando / erro**: 4 skeletons no formato do item (tile 36 + 2 linhas + data) com
  `aria-busy`; `ErrorState` padrão.

### AddMemberSheet
- **Gatilho**: `SectionHeaderAction` "Adicionar membro" na seção Membros da `GroupPage` (abaixo),
  só para o responsável (FR-001). Ao fechar, o foco volta a esse botão.
- **Sheet**: `tall`, título fixo **"Adicionar membro"** (`Dialog.Title`) em todos os passos.
  Cabeçalho esquerdo: "Cancelar" no passo `email`; `ChevronLeft` "Voltar" nos demais (volta ao
  passo `email` preservando o texto). Rodapé fixo com o botão do passo (`Button block`).
  Cada passo (exceto `email`) começa com `<h3 tabIndex={-1} class="text-title-3 font-semibold
  mt-2 mb-1">` que **recebe o foco** ao entrar no passo — o leitor de tela anuncia o resultado.
- **Passos** (máquina de `data-model.md`):

| Passo | Conteúdo | Rodapé |
|---|---|---|
| `email` | texto de apoio `text-subhead text-text-muted` "Comece pelo email. Se a pessoa já tiver conta no Finami, você envia um convite."; `TextField` "Email" (`type="email"`, `inputMode="email"`, `autoComplete="email"`, `autoCapitalize="none"`, `spellCheck={false}`, `data-autofocus`); divisor "ou" (`aria-hidden`); `ListRow` 60 px `UserPlus` "Adicionar sem email" / "Para quem não vai usar o app" com chevron | "Continuar" (sempre habilitado; Enter envia) |
| `email` inválido | `TextField` com erro "Informe um email válido." (`errors.emailInvalid` existente), `aria-invalid`, foco volta ao campo | idem |
| lookup em curso | campo e atalho `disabled` | "Verificando…" (loading) |
| `available` → `newPersonForm` | h3 "Nova pessoa"; apoio "Esse email ainda não tem conta. A pessoa será cadastrada com ele e já entra na família {família}."; linha somente leitura "Email" com `Mail` 18 px (`bg-surface text-text-muted`, sem borda); `TextField` "Nome" e "Sobrenome" (`autoComplete="off"`, obrigatórios, até 120) | "Adicionar à família" |
| `newPersonForm` sem email | h3 "Nova pessoa sem email"; apoio "A pessoa não vai entrar no app. Você poderá criar carteiras para ela, e ela aparece em "Pessoas que cadastrei"."; Nome e Sobrenome | "Adicionar à família" |
| `registered` → `inviteConfirm` | h3 "Pessoa encontrada"; `PersonCard` (avatar neutro + nome + "Já tem conta no Finami" — FR-008: só nome); frase do contrato em `text-body text-text`; `Banner info` "A pessoa só entra na família depois de aceitar. O convite aparece nas notificações do app." (texto neutro — REVIEW-003 M-2) | "Convidar para a família" com ícone `Send` |
| `alreadyMember` | h3 "Já faz parte"; `PersonCard` ("Membro da família {família}"); `Banner info role="status"` com `UserCheck` e o texto do contrato. Vale também para o próprio email do responsável | `secondary` "Usar outro email" (volta ao `email` com o texto selecionado) |
| `pendingInvite` | h3 "Convite já enviado"; `PersonCard` com avatar `pending` e "Enviado em {data}"; `Banner tone={BannerTone.Warning} role="status"` com `Clock` e o texto do contrato; `Button variant={ButtonVariant.DestructiveGhost}` "Cancelar convite" (ícone `X`) → `ConfirmModal` (abaixo) → toast "Convite cancelado." e volta ao `email` | `secondary` "Usar outro email" |
| `submitting` | campos `disabled`, "Voltar" desabilitado, `dismissible={false}`, `busy` | "Adicionando…" / "Enviando convite…" (loading) |
| erro do servidor | `Banner tone="error" role="alert"` no topo do passo (`mb-4`), dados preservados, botão volta ao normal. 409 de email em `members/new` (corrida) não mostra faixa: refazer o lookup e ir para `registered` | — |
| `done` | Sheet fecha; toast do contrato ("{nome} foi adicionado(a) à família." / "Convite enviado para {nome}."); recarregar saldos/membros e pendentes | — |

- **`PersonCard`** (interno): `flex items-center gap-3 bg-surface rounded-lg px-4 py-3 mb-4`;
  avatar 40 px — variante `neutral` (`bg-surface-3 text-text`, 14,01:1) para quem não é membro
  ou cujo índice de cor não se conhece, `pending` para convite pendente; nome `text-headline`,
  linha 2 `text-footnote text-text-muted`.

### SectionHeaderAction ("Adicionar membro")
- Botão no cabeçalho de seção da `GroupPage` (o `<h2>` MEMBROS vira `flex items-center` com o
  botão em `ml-auto -mr-2`). Visual: pílula **36 px** `rounded-pill bg-surface-2 text-accent
  px-3.5 pl-3 gap-1.5 text-subhead font-semibold normal-case tracking-normal`, ícone `UserPlus`
  18 px. Alvo de toque **44 px** com `before:absolute before:inset-x-0 before:-inset-y-1`.
  Hover/pressed `bg-surface-3`. Contraste `accent`/`surface-2` 9,98:1 (`surface-3` 8,73:1).
- `type="button"`, `aria-haspopup="dialog"`; o texto visível é o nome acessível. Fica **fora**
  do `<h2>` (irmão dele dentro do cabeçalho), para o título da seção continuar só "Membros".
- Só para o responsável; quem não é responsável não recebe o botão (nem espaço reservado).

### PendingInvitesSection / PendingInviteRow
- Seção **"Convites pendentes"** logo abaixo de Membros e antes de "Carteiras da família", só
  para o responsável e só quando há ao menos um pendente (sem pendentes, a seção não é
  renderizada). Cabeçalho igual ao das outras seções (`text-footnote uppercase`).
- Lista `<ul>` `bg-surface rounded-lg`; cada `<li>` `ListRow` 60 px estático: avatar 40 px
  **`pending`** (`bg-transparent border-[1.5px] border-dashed border-border text-text-muted`,
  borda 3,93:1 sobre `surface`) com as iniciais; nome `text-headline`; linha 2 "Enviado em
  {30 de out.}" (`<time dateTime>`, `text-footnote text-text-muted`); à direita
  `Button variant={ButtonVariant.DestructiveGhost} size={ButtonSize.Sm}` "Cancelar" com
  `aria-label="Cancelar convite de {nome}"`.
- Rodapé `text-footnote text-text-muted px-4 pt-2`: "Quem foi convidado só entra na família
  depois de aceitar o convite."
- **ConfirmModal do cancelamento** (FR-014): `tone="destructive"`, título "Cancelar o convite
  de {nome}?", descrição "{nome} não poderá mais aceitar o convite para a família {família}.
  Você pode convidar de novo depois.", `confirmLabel="Cancelar convite"`,
  **`cancelLabel="Manter convite"`** (o padrão "Cancelar" ficaria ambíguo) com foco inicial
  nele. Sucesso: toast "Convite cancelado.", linha removida, foco no próximo "Cancelar" ou, sem
  pendentes, no botão "Adicionar membro".

### Avatar — variantes novas
- `neutral`: `bg-surface-3 text-text` (pessoa encontrada / sem índice de família).
- `pending`: fundo transparente, borda tracejada `border-border` 1,5 px, iniciais
  `text-text-muted` — sempre acompanhado de texto ("Enviado em …" ou a seção "Convites
  pendentes"), nunca só a borda.

---

## 8. Assistentes de IA — OAuth e conexões (feature 004)

Mockups: [`oauth-consent.html`](./mockups/oauth-consent.html),
[`account-connections.html`](./mockups/account-connections.html) e a página da API
[`oauth-error.html`](./mockups/oauth-error.html). Textos: `specs/004-mcp-oauth-server/contracts/ui.md`
(namespace i18n `oauth`); textos marcados *(proposta)* não estão no contrato e devem entrar em
`pt-BR.json` como estão. Nenhum token novo; contrastes conferidos no fim de cada componente.
Ícones lucide novos: `Bot`, `Unplug`, `ExternalLink`.

### OAuthConsentPage (`/autorizar?pedido={requestKey}`)
- **Moldura**: `AuthLayout` (o mesmo do login; sem TabBar/Sidebar/Fab). Sem sessão →
  `<Navigate to="/entrar" state={{ from: "/autorizar?pedido=…" }}>`. Sem `?pedido=` → estado
  "inexistente" sem chamar a API.
- **Anatomia (pronto)**, de cima para baixo:
  1. `Logo` centralizada, `h-12`, dentro de `rounded-[12px] overflow-hidden bg-brand`, `mt-2 mb-7`
     (sem o AppIcon: a tela é longa).
  2. `<h1>` `font-display text-[28px] leading-[34px] font-normal [overflow-wrap:anywhere] mb-1.5`
     com `<b class="font-bold">{clientName}</b>` + " quer acessar sua conta".
  3. Linha do host: `<p class="flex items-start gap-1.5 mb-5 text-subhead text-text-muted">` com
     `ExternalLink` 16 px + "Você vai voltar para " + `<b class="font-semibold text-text
     [overflow-wrap:anywhere]">{redirectHost}</b>`.
  4. **AccountCard**: `flex flex-wrap items-center gap-x-3 min-h-16 bg-surface rounded-lg py-2
     pl-4 pr-1` — avatar 40 px (cor do usuário, `aria-hidden`); bloco `flex-[1_1_6.5rem] min-w-0`
     com "Entrando como" (`text-footnote text-text-muted whitespace-nowrap`) e o nome
     (`text-headline`); `Button variant="ghost" size="sm" className="ml-auto px-3"` **"Trocar de
     conta"** (logout e volta a `/entrar` mantendo o retorno). Em 320 px o botão desce para a
     2ª linha, à direita.
  5. **ScopeChoice** (abaixo), `mt-6`.
  6. `Banner tone="info"` (`ShieldCheck` 18 px), `mt-4`: "Você pode desconectar quando quiser em
     **Conta → Assistentes conectados**." (trecho em negrito inline, `font-semibold text-text`).
  7. Ações `mt-6 flex flex-col gap-2`: `Button primary block` **"Autorizar"** (`type="submit"`)
     e `Button secondary block` **"Negar"**. Negar **não** é destrutivo (é a ação segura).
     Empilhados também no desktop.
  8. Região viva `<p role="status" aria-live="polite" class="sr-only">`, sempre montada (só o
     texto muda).
- **ScopeChoice — pedido com `finami:write`**: `<fieldset>` sem borda + `<legend>` no estilo de
  cabeçalho de seção (`block w-full px-4 py-[13px] text-footnote uppercase tracking-[.06em]
  font-semibold text-text-muted`) **"O que o assistente pode fazer"**; `ListGroup` com 2
  `<label>` (linhas `min-h-[60px] px-4 py-3.5 items-start gap-3`), cada uma com
  `<input type="radio" name="scope" class="sr-only">` **nativo** + círculo visual 22 px
  (`aria-hidden`; marcado `bg-accent border-accent` com `Check` 14 px traço 3 `text-on-accent`;
  desmarcado `border-2 border-border`) + título `text-headline` + descrição `text-footnote
  text-text-muted` (quebra livre):
  - `read` — **"Consultar"** · "Ver saldos, carteiras, extratos, família e notificações"
  - `read write` — **"Consultar e fazer alterações"** · "Também lançar receitas, despesas e
    transferências, gerenciar carteiras, família e convites"

  Padrão = o que foi pedido (com write → 2ª opção marcada). Foco: anel na linha inteira com
  `has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-focus
  outline-offset-[-2px] rounded-[12px]`. Teclado nativo: Tab entra pela opção marcada, setas
  trocam. Hover `bg-surface-3`. Envio: `["finami:read"]` ou `["finami:read","finami:write"]`.
- **ScopeChoice — só `finami:read` pedido**: sem rádio (um rádio sozinho não é escolha). `<h2>`
  no mesmo estilo da legend: **"O que o assistente vai poder fazer"**; `ListGroup` com 1 item
  estático: tile 32 px `bg-info-soft text-info` com `Eye` 18 px + "Consultar" + descrição;
  rodapé `text-footnote text-text-muted px-4 pt-2`: "O assistente pediu só para consultar. Ele
  não poderá fazer alterações." *(proposta)*. Autorizar envia `["finami:read"]`.
- **Estados**

| Estado | Visual | A11y |
|---|---|---|
| Carregando | Logo real + skeletons (título 2 linhas, host, card 64 px, legend, lista 150 px, 2 botões) | contêiner `aria-busy="true"`, "Carregando…" `sr-only`, blocos `aria-hidden` |
| Pronto | acima | `<form aria-labelledby={id do h1}>` |
| Enviando (Autorizar) | Autorizar `loading` com rótulo visível **"Conectando…"** (spinner 18 px); Negar, Trocar de conta e `<fieldset disabled>` | região viva "Conectando…" |
| Enviando (Negar) | Negar `loading` **"Negando…"** *(proposta)*; resto desabilitado | região viva "Negando…" |
| Voltando | tudo desabilitado; abaixo dos botões `<p role="status">` visível (`flex justify-center items-center gap-2 min-h-11 mt-2 text-subhead text-text-muted`) com spinner + **"Voltando para {redirectHost}…"**; depois `window.location.assign(redirectUrl)` | a linha visível substitui o `sr-only` como região viva |
| Erro de rede ao enviar | `Banner tone="error"` (`WifiOff`) `mt-4` acima das ações: **"Não foi possível enviar sua resposta"** / "Confira sua conexão e toque de novo em Autorizar ou Negar." *(proposta)*; escolha preservada; botões reabilitados — eles são o "tentar de novo" | `role="alert"`; foco fica no botão tocado |
| Erro de rede ao carregar | Logo + `<h1 class="sr-only">Autorizar assistente</h1>` + `Banner tone="error"`: **"Não foi possível carregar o pedido"** / "Confira sua conexão e tente de novo." + `Button secondary sm` **"Tentar de novo"** (`RotateCw`), que refaz o GET | `role="alert"` |
| 410 | círculo 72 px `bg-warning-soft text-warning` com `TriangleAlert` 36 px; `<h1 class="text-title-3 font-semibold">` **"Este pedido de autorização venceu."**; `<p class="text-subhead text-text-muted max-w-[34ch]">` **"Volte ao assistente e tente conectar de novo."** Centralizado. Sem botões | contêiner `role="alert"` |
| 404 / sem `pedido` | igual, título **"Pedido de autorização não encontrado."** | idem |

  A `mensagem` do 410 traz as duas frases juntas; a tela usa chaves i18n por status (mesmo texto,
  separado em título + instrução) e só usa a `mensagem` da API para status inesperados.
- **Ordem de foco**: Trocar de conta → grupo de rádio (1 parada) → Autorizar → Negar. Não mover o
  foco ao carregar. `document.title`: "Autorizar {clientName} — Finami".
- **Contraste**: título `text`/`bg` 18,74 · host muted/`bg` 9,43 · "Trocar de conta"
  `accent`/`surface` 10,91 · descrições muted/`surface` 8,81 · círculo do rádio `border`/`surface`
  3,93 (≥ 3) · marcado `on-accent`/`accent` 11,68 · aviso `info`/`info-soft` 6,94 (negrito
  `text`/`info-soft` 14,60) · "Conectando…" `on-accent`/`accent-pressed` 8,19 · alerta 410
  `warning`/`warning-soft` 9,76 · erro `negative`/`negative-soft` 6,71 · foco/`surface` 9,92.
  Desabilitado `text-disabled`/`surface-2` 3,58 (isento, WCAG 1.4.3).

### ConnectedAssistantsSection (Conta)
- **Posição**: `AccountPage`, **entre "Segurança" e "Pessoas que cadastrei"**.
  `<section aria-labelledby aria-describedby>`: cabeçalho de seção padrão **"Assistentes
  conectados"** e, logo abaixo, `<p class="-mt-1 mb-2 px-4 text-footnote text-text-muted">`
  **"Assistentes de IA que podem acessar sua conta pelo MCP."** (alvo do `aria-describedby`).
  Carrega sozinha (`GET /api/oauth/connections`); o resto da Conta não espera.
- **Lista**: `<ul class="bg-surface rounded-lg overflow-hidden">`, separador hairline recuado
  64 px. **ConnectionItem** (`<li>`): `flex flex-wrap items-start gap-x-3 px-4 pt-3.5 pb-1.5`
  (≥ 768 px: `md:flex-nowrap md:items-center md:py-3 md:pr-2`):
  - tile 36 px `rounded-[10px] bg-surface-2 text-accent` com `Bot` 20 px (`aria-hidden`);
  - `min-w-0 flex-1`: linha `flex flex-wrap items-center gap-x-2 gap-y-1` com
    `<h3 class="text-headline font-semibold">{clientName}</h3>` + **ScopeBadge**; meta
    `<p class="mt-1 flex flex-wrap gap-x-1.5 text-footnote text-text-muted">`: "Conectado em
    `<time>`01/11/2026`</time>`" · (separador `aria-hidden`) · "Último uso `<time>`há 5
    min`</time>`" ou **"Ainda não usado"** (`lastUsedAt == null`). Data `dd/MM/yyyy`; último
    uso relativo (`Intl.RelativeTimeFormat("pt-BR")`: "há 5 min", "há 2 h", "há 3 dias"; > 30
    dias → data), `dateTime` ISO;
  - ações `basis-full pl-8` (≥ 768 px: `md:basis-auto md:pl-0`): `Button
    variant={DestructiveGhost} size="sm"` **"Desconectar"** (`px-4`; no celular o texto alinha
    com o nome), `aria-label="Desconectar {clientName}"`, `aria-haspopup="dialog"`.
- **ScopeBadge** (variante nova de Badge, sempre ícone + texto): com `finami:write` →
  **"Consulta e alterações"** `bg-warning-soft text-warning` + `Pencil` 12 px (9,76:1);
  só leitura → **"Só consulta"** `bg-surface-3 text-text-muted` + `Eye` 12 px (7,05:1).
- **Desconectar todos** (só com **2+** conexões): `ListGroup` próprio `mt-4` com uma `ListRow
  destructive` alinhada à esquerda: `Unplug` 20 px + **"Desconectar todos"**,
  `aria-haspopup="dialog"`.
- **ConfirmModal** (`tone="destructive"`, foco inicial em "Cancelar"):
  - item: título **"Desconectar {nome}?"**, descrição **"O assistente perde o acesso na hora."**,
    `confirmLabel="Desconectar"`, loading "Desconectando…"; sucesso → toast **"{nome}
    desconectado."**;
  - todos: **"Desconectar todos os assistentes?"** / "Os {n} assistentes perdem o acesso na
    hora. Para usar de novo, será preciso conectar cada um outra vez." *(proposta)*,
    `confirmLabel="Desconectar todos"`; sucesso → toast "Assistentes desconectados."
    *(proposta)* e a seção vai para o vazio;
  - erro → toast de erro com a mensagem da API; a lista não muda.
- **Foco depois de desconectar**: "Desconectar" do item que ocupou a posição (ou do anterior);
  sem itens, o `<h3 tabIndex={-1}>` "Nenhum assistente conectado.".
- **Vazio (McpAddressCard)**: `bg-surface rounded-lg p-4` com `<h3 tabIndex={-1}
  class="text-headline font-semibold mb-1">` **"Nenhum assistente conectado."**;
  `<p class="text-subhead text-text-muted mb-4">` **"Para conectar, adicione este endereço no seu
  assistente (ex.: Claude → Conectores):"**; `TextField` com `<label>` visível **"Endereço do
  MCP"** *(proposta)*, `readOnly`, `value={mcpUrl}`, `font-mono text-body` (17 px evita zoom
  no iOS), `spellCheck={false}`, seleciona tudo ao focar. Mantém o visual de campo comum
  (`bg-surface-2 border-border`), porque o "somente leitura sem borda" do TextField sumiria
  sobre `bg-surface`. Ao lado, `Button secondary sm` **"Copiar"** com `Copy` 18 px e
  `aria-label="Copiar endereço do MCP"` (começa pelo texto visível, WCAG 2.5.3). Layout
  `flex flex-wrap gap-2`: campo `basis-full` no celular (botão embaixo, à esquerda);
  `md:flex-nowrap` + campo `md:basis-auto md:flex-1` no desktop. Sucesso → toast **"Endereço
  copiado."**; falha de `navigator.clipboard` → toast de erro "Não foi possível copiar.
  Selecione o endereço e copie manualmente." *(proposta)* com o texto do campo selecionado.
- **Carregando**: `ListGroup aria-busy` com 2 skeletons no formato do item (tile 36 + 2 linhas)
  e "Carregando…" `sr-only`. **Erro**: `Banner tone="error" role="alert"` (`WifiOff`) "Não foi
  possível carregar os assistentes" / "Confira sua conexão e tente de novo." *(proposta)* +
  `Button secondary sm` "Tentar de novo" (`RotateCw`).
- **Ordem de foco**: Desconectar (item 1) → Desconectar (item 2) → … → Desconectar todos; no
  vazio, campo → Copiar.
- **Contraste**: nome `text`/`surface` 17,50 · meta muted/`surface` 8,81 · tile
  `accent`/`surface-2` 9,98 · "Desconectar" `negative`/`surface` 7,76 (hover `surface-3` 6,22) ·
  selos 9,76 e 7,05 · campo `text`/`surface-2` 16,02, borda/`surface` 3,93 · toast
  `text`/`surface-3` 14,01.

### OAuthErrorPage (HTML da API, `GET /oauth/authorize` → 400)
- O arquivo [`oauth-error.html`](./mockups/oauth-error.html) (≈ 22 KB) é **final**: embutir como
  recurso no backend e trocar **só** o texto do motivo (marcado `{{REASON}}`), sempre com
  `HtmlEncoder.Default.Encode`. Motivos: **"Assistente não registrado."** (`client_id`
  desconhecido) e **"Endereço de retorno não autorizado."** (`redirect_uri` não registrado).
- Autocontido: CSS inline, logo em data URI (`logo.webp`), fontes do sistema, sem JS e sem
  requisições externas. `lang="pt-BR"`, `color-scheme: dark`, `noindex`. CSP compatível:
  `default-src 'none'; style-src 'unsafe-inline'; img-src data:`.
- Anatomia: fundo `#12021C`, coluna de 384 px centralizada; logo `h-12` em cápsula `#380159`;
  cartão `#1E0631`, raio 20 px, com `<h1>` 22 px **"Não foi possível conectar este
  assistente."**, faixa de erro (`CircleAlert` + "Motivo" + texto do motivo) e a instrução
  "Volte ao assistente e tente conectar de novo. Se o erro continuar, remova o Finami do
  assistente e adicione outra vez." *(proposta)*; abaixo, "Você pode fechar esta janela."
  *(proposta)*.
- Contraste: `text`/`bg` 18,74 · `text`/`surface` 17,50 · muted/`surface` 8,81 e /`bg` 9,43 ·
  `negative`/`negative-soft` 6,71 · `text`/`negative-soft` 15,12. Sem elementos interativos.

---

## 9. PWA (feature 005)

Mockups: [`pwa-states.html`](./mockups/pwa-states.html). Contrato:
`specs/005-pwa-webapp/contracts/ui.md`. Arquivos em `frontend/src/components/pwa/` (exceto
`OfflinePage`, em `pages/`). Textos pt-BR no namespace i18n `pwa`. **Nenhum token novo.**
Ícones lucide novos: `Download`, `Share`, `SquarePlus`, `RefreshCw`, `Wifi` (além de `WifiOff`,
`RotateCw`, `X`, `Check` e `Loader2`, já usados).

### Cor de aviso (faixa "Sem internet") — valores e contraste

| Elemento | Token | Valor | Contraste |
|---|---|---|---|
| Fundo da faixa | `bg-warning-soft` | `#33290A` (opaco) | — |
| Texto ("Sem internet · dados de…") | `text-text` | `#F9F7F9` | **13,47:1** sobre `#33290A` |
| Ícone `WifiOff` e separador "·" | `text-warning` | `#FFD007` | **9,76:1** sobre `#33290A` (ícone exige 3:1) |
| Borda inferior (decorativa) | `border-warning/30` | `#FFD007` a 30 % | não é a única pista: texto + ícone |
| Faixa × fundo do app | `#33290A` / `#12021C` | — | 1,39 (decorativo; a faixa se identifica pelo texto e pelo ícone) |

Amarelo sólido como fundo (`#FFD007` com texto `#12021C`, 13,58:1) foi descartado: grita demais
para um estado que pode durar minutos ("calmo, não fintech neon"). O texto da faixa é branco
para leitura confortável em 13 px; o amarelo fica no ícone, que carrega o sentido de "aviso"
junto com as palavras.

### Área segura e camadas (z-index)

| Camada | z | Celular | ≥ 768 px |
|---|---|---|---|
| `OfflineBanner` | `z-30` | `sticky top-0`; o fundo cobre `env(safe-area-inset-top)` | `sticky top-4` no topo da coluna de 720 px |
| `Fab` | `z-30` | como hoje; sobe quando há `UpdatePrompt` | como hoje |
| `UpdatePrompt` | `z-40` | `fixed`, 12 px acima da TabBar | `fixed`, canto inferior direito, acima do FAB |
| Toasts (sonner) | `z-[45]` | topo (abaixo da faixa, quando ela existe) | embaixo, ao centro |
| Radix Dialog (Sheet/Modal) | `z-50` | — | — |

O `AppShell` publica duas variáveis CSS no `<html>` (via `ResizeObserver`; `0px` quando o
elemento não existe): `--offline-banner-h` e `--update-prompt-h`. Elas deslocam o cabeçalho
compacto, o FAB, o `padding-bottom` do `main` e o `offset` dos toasts, sem números fixos e
funcionando com zoom de 200 % (a faixa e o cartão crescem com o texto).

### OfflineBanner
- **Quando**: `showBanner` do `ConnectivityContext` (após 2 s offline; some na primeira
  resposta bem-sucedida). Em todas as telas do layout autenticado (abas e push).
- **Região viva**: o contêiner `<div role="status" aria-live="polite">` fica **sempre** montado
  no `AppShell` (vazio quando online) e só o conteúdo entra e sai; assim o anúncio funciona em
  todos os leitores de tela. Não é focável e não tem botões.
- **Contêiner**:
  `sticky top-0 z-30 -mx-gutter -mt-[env(safe-area-inset-top)] pt-[env(safe-area-inset-top)]
  bg-warning-soft border-b border-warning/30
  md:top-4 md:mx-0 md:mt-0 md:mb-4 md:pt-0 md:rounded-lg md:border`.
  O `-mt`/`pt` da área segura faz o fundo âmbar subir por baixo da barra de status (no modo
  instalado, `black-translucent`) e o texto ficar logo abaixo dela.
- **Linha**: `flex items-center gap-2 min-h-9 px-gutter py-2 text-footnote text-text`
  (`md:px-4`); `WifiOff` 16 px `shrink-0 text-warning` `aria-hidden`.
- **Texto**: `<span class="font-semibold">Sem internet</span><span aria-hidden="true"
  class="text-warning"> · </span><span class="sr-only">, </span>dados de <time
  dateTime="2026-11-01T18:42">01/11 às 18:42</time>` (dia/mês e hora de Brasília). Sem
  `staleSince`: só "Sem internet". `min-h` (nunca `h` fixo): em 320 px com zoom o texto quebra
  e a faixa cresce; a data nunca é truncada.
- **Telas push**: a faixa vem **antes** da linha de navegação de 44 px; o cabeçalho compacto
  (ao rolar) usa `top-[var(--offline-banner-h,0px)]` para grudar logo abaixo dela.
- **Toasts com a faixa visível (celular)**: `<Toaster mobileOffset={{ top:
  "calc(env(safe-area-inset-top) + var(--offline-banner-h) + 8px)" }}>` (sonner 2.x); o toast
  nunca cobre a faixa.
- **Reconexão**: a faixa some + toast curto **"Conexão restabelecida."** com ícone `Wifi` em
  `text-positive` (`positive`/`surface-3` 8,73:1; texto 14,01:1).
- **Movimento**: entrada `motion-safe:animate-fade-in`; nada desliza (não empurra o conteúdo com
  animação). Com movimento reduzido, aparece direto.

### Fab (offline) e ações de escrita
- `aria-disabled="true"` (**não** `disabled`: continua focável e é anunciado como
  indisponível); `aria-haspopup` mantido. Visual: `bg-surface-2 text-text-disabled border
  border-border shadow-none cursor-not-allowed`, sem `hover`/`active` nem `scale`.
- Clique/Enter não abre a folha; toast de aviso **"Sem internet. Conecte-se para fazer
  lançamentos."** com `WifiOff` em `text-warning` (`warning`/`surface-3` 10,16:1; texto
  14,01:1). Demais ações de escrita: mesmo padrão via `useOnlineAction`, com "Sem internet.
  Conecte-se para fazer alterações.".
- Contraste: `text-disabled`/`surface-2` 3,58 (isento, WCAG 1.4.3 — controle inativo); o
  contorno `border`/`bg` 4,21 mantém o círculo visível (≥ 3:1, WCAG 1.4.11).
- `Button` com `aria-disabled` usa o estado Disabled das regras comuns.

### OfflineContent
- Mesma anatomia do `EmptyState`/`ErrorState`: `flex flex-col items-center text-center py-12
  px-6 gap-2`, contêiner `role="status"` (não é erro da pessoa; não usar `alert`).
- Ícone `WifiOff` 36 px em círculo 72 px `bg-surface-2 text-text-muted` (8,06:1).
- Título `<h2 class="text-headline">` **"Este conteúdo não está disponível sem internet."**;
  apoio opcional `text-subhead text-text-muted max-w-[32ch]` "Abra esta tela de novo quando
  estiver conectado." *(proposta)*.
- `Button secondary sm` com `RotateCw` 20 px **"Tentar de novo"** (`onRetry`). Durante a
  tentativa: estado Loading das regras comuns (`aria-busy`).
- Props: `onRetry: () => void`, `className?`.

### OfflinePage (`pages/OfflinePage.tsx`)
- Tela inteira sem TabBar/Sidebar: `min-h-dvh grid place-items-center bg-bg px-gutter
  pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`; coluna `max-w-auth flex
  flex-col items-center text-center gap-2`.
- `Logo` `h-14` dentro de `rounded-lg overflow-hidden` (fundo `brand`); círculo 64 px
  `bg-warning-soft text-warning` com `WifiOff` 30 px (`aria-hidden`, 9,76:1), `mt-8 mb-2`.
- `<h1 tabIndex={-1} class="text-title-2">` **"Sem internet"** (18,74:1); `<p class="text-body
  text-text-muted max-w-[30ch] mb-4">` **"Conecte-se para usar o Finami pela primeira vez neste
  aparelho."** (9,43:1); `Button primary` com `RotateCw` **"Tentar de novo"** (recarrega).
- Foco inicial no `<h1>` para o leitor de tela ler a situação primeiro.

### UpdatePrompt
- **Quando**: `needRefresh` do `useRegisterSW`. Não modal, não move o foco, `role="status"`
  + `aria-live="polite"` (o contêiner fica montado; o conteúdo entra), `aria-labelledby` no
  texto. Na ordem de tabulação fica depois do `main` e antes da TabBar.
- **Posição**: celular `fixed inset-x-3
  bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+12px)]`; ≥ 768 px
  `md:inset-x-auto md:w-[360px] md:right-[max(24px,calc((100vw-960px)/2-72px))]
  md:bottom-[104px]` (alinhado à borda direita do FAB e 16 px acima dele; os toasts do desktop
  ficam embaixo, ao centro, sem colisão).
- **Cartão**: `z-40 flex flex-col gap-2 rounded-[14px] border border-border bg-surface-3 p-3
  pl-3.5 shadow-modal motion-safe:animate-modal-in`.
  - Linha: `flex items-center gap-2.5 min-h-6 text-subhead font-semibold text-text` com
    `RefreshCw` 20 px `text-accent` + **"Nova versão disponível"**.
  - Ações: `flex justify-end gap-2` → `Button ghost sm` **"Agora não"** + `Button primary sm`
    **"Atualizar"** (ambos `min-h-touch`, 44 px).
- **Atualizando…**: as ações saem; a linha mostra `Loader2` 20 px `motion-safe:animate-spin`
  + **"Atualizando…"**, `aria-busy="true"`, `min-h-touch`. Depois o app recarrega na mesma rota.
- **Agora não**: oculta até a próxima abertura do app (a versão nova entra no próximo início
  do zero).
- **FAB e conteúdo (celular)**: enquanto o cartão está visível, o FAB vai para
  `bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+12px+var(--update-prompt-h)+16px)]`
  e o `main` ganha `var(--update-prompt-h) + 12px` a mais de `padding-bottom`. No desktop o FAB
  não se move.
- **Com Sheet/Modal aberto**: fica por baixo do scrim (z-40 < z-50) e nada recarrega.
- **Contraste**: texto `text`/`surface-3` 14,01 · ícone e "Agora não" `accent`/`surface-3` 8,73
  · "Atualizar" `on-accent`/`accent` 11,68 · borda `border`/`bg` 4,21 (separa o cartão do
  conteúdo).

### InstallInvite (Home)
- **Quando**: depois que a Home carregou os dados, se `canPromptNative || isIos`, não instalado
  e sem dispensa nos últimos 30 dias (`finami:install-dismissed-at`). Logo abaixo do
  `BalanceHero`, uma vez.
- **Anatomia**: `<section aria-labelledby aria-describedby class="relative mt-4 flex
  items-start gap-3 rounded-lg bg-surface p-3.5 pr-1 shadow-card">`:
  - `AppIcon` 44 px `rounded-icon mt-0.5`, `alt=""` (decorativo; o título já diz "Finami");
  - `min-w-0 flex-1`: `<h2 class="text-headline">` **"Instalar o Finami"**; `<p class="mt-0.5
    mb-2.5 text-subhead text-text-muted">` **"Use o Finami como um app, direto da tela
    inicial."**; `Button secondary sm` com `Download` 18 px **"Instalar"** (no iOS,
    `aria-haspopup="dialog"` e abre `InstallIosSheet`);
  - fechar: `<button aria-label="Dispensar convite de instalação" class="size-11 -mt-1.5
    shrink-0 grid place-items-center rounded-full text-text-muted hover:bg-surface-2
    hover:text-text">` com `X` 20 px.
- **Depois**: dispensar grava a data e o cartão sai; o foco vai para o próximo elemento
  focável (primeiro cabeçalho de seção da Home). Instalação aceita: o cartão sai + toast
  **"Finami instalado."**.
- **Contraste**: título `text`/`surface` 17,50 · texto e X `muted`/`surface` 8,81 · "Instalar"
  `text`/`surface-2` 16,02, borda `border`/`surface` 3,93.

### InstallAppItem (Conta → seção "App")
- Seção nova **"App"** entre "Pessoas que cadastrei" e o grupo do "Sair". Com o item oculto
  (instalado, ou sem suporte fora do iOS), a seção inteira não é renderizada.
- `ListRow` de 2 linhas (`min-h-row-2`, 60 px; alvo ≥ 44 px): ícone em quadrado 30 px
  `rounded-lg bg-accent text-on-accent` com `Download` 18 px (11,68:1); título `text-body`
  **"Instalar o Finami"**; descrição `text-footnote text-text-muted` **"Use o Finami como um
  app, direto da tela inicial."** (pode quebrar em 2 linhas; ligada por `aria-describedby`).
  Sem chevron (é ação, não navegação). No iOS, `aria-haspopup="dialog"`.
- Nativo: `promptInstall()`; aceito → toast "Finami instalado." e o item some (foco vai para o
  botão "Sair"). iOS: abre `InstallIosSheet`; ao fechar, o foco volta ao item.

### InstallIosSheet
- `Sheet` (Radix Dialog; modal central ≥ 768 px). Título **"Instalar no iPhone"** (no iPad,
  **"Instalar no iPad"**), sem botão no cabeçalho; `Dialog.Description` = introdução
  `text-subhead text-text-muted mb-4` "No Safari, são 3 toques para ter o Finami na tela de
  início." *(proposta)*.
- Passos: `<ol class="bg-surface rounded-lg overflow-hidden">`; cada `<li class="flex
  items-center gap-3 min-h-16 px-4 py-2.5 text-body">`, separador hairline recuado 64 px:
  - ilustração `size-9 rounded-[10px] bg-info-soft text-info` (6,94:1) com o ícone do passo e o
    número num selo 18 px `bg-info text-on-accent text-[11px] font-bold` no canto superior
    esquerdo (`on-accent`/`info` 8,92:1; anel 2 px `surface`); a ilustração inteira é
    `aria-hidden` — a ordem vem do `<ol>`;
  1. `Share` — "Toque em **Compartilhar**." + `<small class="block text-footnote
     text-text-muted">` "Fica na barra do Safari; no iOS 26, dentro do menu ⋯." *(proposta)*;
  2. `SquarePlus` — "Toque em **Adicionar à Tela de Início**." + "Role a lista se não
     aparecer de cara." *(proposta)*;
  3. `Check` (traço 2,25) — "Toque em **Adicionar**, no canto superior direito.".
- Rodapé: `Button primary block` **"Entendi"** (fecha). Foco inicial no "Entendi"; `Esc` e
  scrim fecham; o foco volta ao gatilho.
- Contraste: passos `text`/`surface` 17,50 · ajuda `muted`/`surface` 8,81.

### Aparência instalada (área segura e movimento)
- `index.html` mantém `viewport-fit=cover`, `theme-color #12021C` e
  `apple-mobile-web-app-status-bar-style=black-translucent`; colar as tags de
  `frontend/public/splash/splash-links.txt` (telas de abertura do iOS).
- Conferir no modo standalone: `main` `pt-[env(safe-area-inset-top)]`; TabBar e Sheet
  `pb-[env(safe-area-inset-bottom)]`; `OfflineBanner` e `UpdatePrompt` como acima; em paisagem
  no iPhone, `pl-[max(var(--spacing-gutter),env(safe-area-inset-left))]` (e o equivalente à
  direita) no `main` e na TabBar.
- Toda entrada usa `motion-safe:` (`animate-fade-in`, `animate-modal-in`, `animate-spin`); a
  regra global de `prefers-reduced-motion` de `tokens.css` cobre o resto.

### Ícones, atalhos e screenshots (gerados)
- `npm run icons` gera `icon-any-{192,512}.png` (cartão `#380159` arredondado 22,37 %, cantos
  transparentes, casa a 70 %), `icon-maskable-{192,512}.png` (fundo `#12021C` cheio, casa
  recortada com raio máximo de 38,5 % do lado — dentro do círculo seguro de 40 %),
  `shortcut-new-transaction-96.png` e `shortcut-wallets-96.png` (fundo `#380159`, disco
  `#6AE005` de raio 30 %, símbolo `#12021C` — seguros com ou sem máscara) e `splash/*.png`.
- Screenshots em `public/screenshots/`: `home-narrow.png` e `wallets-narrow.png` (1080×1920,
  `form_factor: "narrow"`) e `home-wide.png` (1920×1080, `form_factor: "wide"`). Rótulos
  sugeridos: "Saldo total e carteiras da família", "Carteiras e famílias", "Finami no
  computador".
- **Precache**: excluir `splash/**`, `screenshots/**` e `splash/splash-links.txt` dos
  `globPatterns` do Workbox (`globIgnores`) — são cerca de 2,6 MB que o app nunca usa offline.
