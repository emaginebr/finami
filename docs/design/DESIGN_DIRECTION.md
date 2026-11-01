# Finami — Direção visual "Noite Roxa"

Tarefa T007 · feature `002-finami-frontend-mobile` · tokens em [`tokens.css`](./tokens.css) ·
componentes em [`components.md`](./components.md) · telas em [`mockups/`](./mockups/).

## 1. Conceito

**Noite Roxa** = *iOS Dark Grouped* tingido com a marca. A estrutura é a do iPhone (Large Title,
listas agrupadas como em Ajustes, barra inferior translúcida, folhas que sobem de baixo); a
personalidade vem da logo: o roxo profundo vira a "noite" onde tudo acontece, o verde-limão do
"mi" é a única cor de ação e de dinheiro entrando, e o azul, rosa e amarelo das figuras da família
identificam famílias e pessoas.

Três ideias guiam cada tela:

1. **O número primeiro.** O saldo é o maior elemento da tela (`text-hero`), em números tabulares,
   sobre o cartão roxo da marca. Nenhum outro número compete com ele (spec US1-4).
2. **Calmo, não "fintech neon".** Fundos quase pretos com tom roxo, um único verde de ação,
   sem gradientes chamativos, sem glassmorphism fora da TabBar/cabeçalho.
3. **Família visível.** Cada família e cada pessoa tem uma cor de apoio estável (pontinho da seção,
   avatar de iniciais), mas o nome sempre acompanha a cor.

Evitar: fontes web, gradiente roxo→azul genérico, sombras pesadas, cartões com borda colorida,
ícones preenchidos misturados com ícones de traço.

## 2. Cores-semente (research R-06)

| Papel | Cor da logo | Hex | Token derivado |
|---|---|---|---|
| Fundo da marca | roxo | `#380159` | `--color-brand` (hero, ícone); app usa `--color-bg` `#12021C`, mais escuro |
| Destaque / positivo / ação | verde "mi" | `#6AE005` (barras `#59DE14`) | `--color-accent`, `--color-positive` |
| Texto principal | branco | `#F9F7F9` | `--color-text` |
| Apoio famílias / info | azul | `#02A7F4` | `--color-family-blue`, `--color-info` (`#3DB8F5`, mais claro) |
| Apoio / negativo | rosa | `#FD809B` | `--color-family-pink`, `--color-negative` |
| Apoio / avisos | amarelo | `#FFD007` | `--color-family-yellow`, `--color-warning` |

### Escala de superfícies

```
bg #12021C  →  surface #1E0631  →  surface-2 #2A0B44  →  surface-3 #381457
(fundo)        (listas, sidebar)    (campos, sheet)       (hover / pressed)
brand #380159 (cartão do saldo, ícone) · brand-tint #4A0F73 (item ativo da sidebar)
```

Todas as razões de contraste estão calculadas no cabeçalho de `tokens.css`. Resumo: texto
principal ≥ 11:1 em qualquer superfície, secundário ≥ 5,6:1, terciário ≥ 4,95:1 (proibido sobre
`brand-tint` e TabBar), verde/rosa/amarelo/azul como texto ≥ 4,9:1, bordas de campo ≥ 3,15:1.

### Regras de uso de cor

- **Verde** = ação principal (botão cheio, FAB, aba ativa, link) **e** valor que entra. Nunca para
  decoração.
- **Rosa** = valor que sai **sempre com "−"** (U+2212), erro de campo **com ícone e texto**, ação
  destrutiva (texto "Excluir", "Sair").
- **Amarelo** = cotação desatualizada/indisponível, sempre com ícone `TriangleAlert` e texto.
- **Azul** = informação (selo "virtual", cotação, dica).
- Cores de família: pela **posição** na lista (`índice % 4`) → azul, rosa, amarelo, verde (T083). Iniciais em `--color-on-family`.
- Texto sobre verde/amarelo/rosa/azul sólidos é sempre `#12021C` (`on-accent` / `on-family`).

## 3. Tipografia

Pilha do sistema (`--font-sans`), números com `font-variant-numeric: tabular-nums` (utilitário
`tabular-nums`) em **todo** valor monetário, horário e código de carteira.

| Token | Tamanho / linha | Uso |
|---|---|---|
| `text-hero` | clamp 28→44 px / 1.1, 700 | Saldo total (Home), total da família/membro |
| `text-large-title` | 34/41, 700 | Título grande de cada tela |
| `text-title-2` | 22/28, 700 | Título de sheet, saldo final do extrato |
| `text-title-3` | 20/25, 600 | Título compacto do cabeçalho ao rolar |
| `text-headline` | 17/22, 600 | Nome da carteira, botões |
| `text-body` | 17/22 | Texto e campos (17 px evita o zoom automático do iOS) |
| `text-subhead` | 15/20 | Valor secundário, descrição |
| `text-footnote` | 13/18 | Rótulos de seção em CAIXA ALTA (`tracking-wide`), ajuda de campo |
| `text-caption` | 12/16 | Selos, horário da cotação |
| `text-tab` | 11/13, 600 | Rótulos da TabBar (menor texto do app) |

Valores: o prefixo da moeda (`R$`, `₿`) em peso normal e 60 % do tamanho do número no
`text-hero`; centavos no mesmo tamanho (sem "centavos pequenos", para leitura com zoom).
Formatação: `R$ 1.234,56`, `−R$ 45,90`, `₿ 0,00250000`, `≈ R$ 1.250,00`, datas `dd/mm/aaaa`,
horários `HH:mm` (Brasília).

## 4. Forma, espaço e elevação

- **Grade**: múltiplos de 4 px; margem lateral 16 px no celular, 24 px ≥ 768 px.
- **Raios**: 10 px campos/botões, 12 px listas agrupadas, 20 px cartão do saldo e sheet,
  `pill` para selos e segmented, `22,37 %` no ícone do app.
- **Listas**: estilo *inset grouped* do iOS — cartão `surface` com raio 12, linhas de 44 px (1
  linha) ou 60 px (2 linhas), separador hairline `--color-separator` recuado 16 px à esquerda,
  chevron `ChevronRight` em `text-subtle` quando a linha navega.
- **Elevação**: no escuro, quem sobe clareia (bg → surface → surface-2). Sombra só no FAB
  (brilho verde suave), na sheet e no modal.
- **Translucidez**: só TabBar e cabeçalho compacto — `--color-tabbar` + `backdrop-blur-xl` +
  `backdrop-saturate-150`, com hairline superior. Sem suporte a `backdrop-filter`, a cor de 82 %
  já garante o contraste calculado.

## 5. Layout

| Largura | Navegação | Conteúdo | FAB |
|---|---|---|---|
| < 768 px | TabBar inferior fixa, 49 px + `env(safe-area-inset-bottom)`, 3 abas: **Home** (`House`), **Carteiras** (`WalletCards`), **Conta** (`CircleUser`) | largura total, margem 16 px, `padding-bottom` = TabBar + FAB + 16 px | 56 px, `right: 16px`, `bottom: 49px + safe-area + 16px` |
| ≥ 768 px | Sidebar fixa 240 px (`surface`) com Logo no topo e as 3 entradas (44 px, ativo em `brand-tint` + texto verde) | centralizado, `max-w-content` (720 px), margem 24 px | 56 px, `right: max(24px, calc((100vw - 960px) / 2 - 72px))`, `bottom: 32px` — fica 16 px à direita da coluna de conteúdo quando há espaço (≥ 1104 px); abaixo disso, encostado em 24 px da borda, e o conteúdo ganha `padding-bottom` de 96 px |

- Telas *push* (extrato, família, membro) têm cabeçalho com botão voltar `ChevronLeft` + rótulo da
  aba de origem; a aba de origem continua ativa.
- `index.html`: `lang="pt-BR"`, `viewport-fit=cover`, sem bloquear zoom, `theme-color` `#12021C`.
- 320 px: nenhum valor quebra — `BalanceHero` usa `text-hero` fluido; linhas de carteira truncam o
  **nome** (`line-clamp-2`), nunca o valor (`shrink-0`).

## 6. Iconografia

`lucide-react`, traço 1,75 px (`strokeWidth={1.75}`), 24 px na TabBar/Sidebar, 20 px em linhas e
botões, 28 px no FAB (`Plus`, traço 2,5). Ícone sempre com rótulo visível ou `aria-label`.

| Conceito | Ícone |
|---|---|
| Home / Carteiras / Conta | `House` / `WalletCards` / `CircleUser` |
| Entrada / Saída / Transferência | `ArrowDownLeft` / `ArrowUpRight` / `ArrowLeftRight` |
| Carteira BRL / BTC | `Wallet` / `Bitcoin` |
| Família / membro | `Users` / avatar de iniciais |
| Responsável | `Crown` (selo "Responsável") |
| Virtual | `Cloud` (selo "virtual") |
| Aviso de cotação | `TriangleAlert` |
| Estorno | `Undo2` |
| Erro / vazio | `WifiOff`, `CircleAlert` / `Inbox`, `WalletCards` |

**Ícone do app**: a casa com a família recortada da logo sobre `#380159`
(`frontend/scripts/generate-icons.mjs`). No app é exibido com `rounded-icon` (squircle).

## 7. Movimento

| Elemento | Animação | Duração / curva |
|---|---|---|
| Sheet (celular) | sobe de baixo (`animate-sheet-in`) + scrim `fade-in` | 360 ms `--ease-ios` |
| Modal / sheet (desktop) | `animate-modal-in` | 220 ms `--ease-out-soft` |
| Pressed (linhas, botões, FAB) | fundo → `surface-3` ou `accent-pressed`; FAB `scale(0.94)` | 120 ms |
| Skeleton | brilho horizontal `animate-shimmer` | 1,4 s linear |
| Troca de aba | sem animação (como no iOS) | — |

`prefers-reduced-motion: reduce`: transições e animações viram instantâneas (regra global em
`tokens.css`); skeleton fica estático em `surface-2`; FAB não escala. Todas as animações usam
`motion-safe:` no Tailwind.

## 8. Acessibilidade (Princípio IX) — resumo aplicado

- Contraste validado nos tokens (tabela em `tokens.css`).
- Alvos ≥ 44×44 px: linhas de lista, abas, botões, FAB (56), botão voltar, chips do PeriodPicker.
- Foco visível: `outline: 2px solid var(--color-focus); outline-offset: 2px` em todo elemento
  focável (`focus-visible:`), inclusive linhas de lista; nunca `outline: none` sem substituto.
- Sem depender de cor: sinal "−"/"+" nos valores, ícone + texto nos avisos, selo com texto
  ("virtual", "estornado", "Responsável", "desatualizada"), aba ativa também com peso e
  `aria-current="page"`.
- Leitores de tela: `R$ 10.500,00` já é lido corretamente, sem `aria-label`; valores negativos
  usam o caractere U+2212 e recebem um `<span class="sr-only">saída de</span>` antes do valor
  (o "−" sozinho pode ser omitido por alguns leitores).
- Toasts (`sonner`) com `aria-live="polite"`; erros de formulário em `role="alert"` e ligados ao
  campo por `aria-describedby`.
- Zoom 200 %: tamanhos em `rem`, nada com altura fixa que corte texto; a TabBar cresce em altura
  se o rótulo quebrar.
