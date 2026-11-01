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
  {nome}"`) e ListGroup "Incluir membro" com busca por email (TextField + "Buscar", resultado
  exato) e linha "Cadastrar pessoa sem login". Para quem não é responsável, essas partes **não
  são renderizadas** (FR-028).
- Zona de perigo da carteira: ListGroup com "Desativar carteira" e "Excluir carteira"
  (`text-negative`); exclusão bloqueada mostra Modal "Esta carteira tem lançamentos e não pode
  ser excluída. Você pode desativá-la." com ação "Desativar".
