# Revisão de design — telas da feature 007 × especificação (T039)

Feature `007-loan-transfer-types` · direção **Noite Roxa** · referência:
[`mockups/loan-transfer-types.html`](./mockups/loan-transfer-types.html), especificação em
[`components.md` §11](./components.md), comportamento e textos em `specs/007-loan-transfer-types/contracts/ui.md`,
Princípio IX (WCAG 2.1 AA) de `.specify/memory/constitution.md`. Consumo: `frontend-react-developer` (todos os itens
são `.tsx`/`.ts`/`.json`).

## Como foi feita

- **Revisão estática** linha a linha de `components/transaction/TransferKindPicker.tsx`, `SettlementPanel.tsx`,
  `FormStep.tsx`, `PreviewStep.tsx`, `AmountUnitToggle.tsx`, `components/ui/SegmentedControl.tsx`, `MoneyInput.tsx`,
  `Badge.tsx`, `Button.tsx`, `Banner.tsx`, `pages/TransactionPage.tsx`, `components/statement/StatementEntryRow.tsx`,
  `TransactionDetailSheet.tsx`, `transactionVisuals.ts`, `utils/cn.ts`, `utils/money.ts` e `i18n/pt-BR.json`
  (chaves `transaction.*`, `statement.kind.*`, `currency.*`, `currencyIn.*`). Backend consultado só para confirmar
  dados (`LedgerService.cs`: o estorno copia `TransferKind`, `DebtCurrency` e `DebtAmount` do original;
  `StatementDtos.cs`: `sourceOwnerFirstName`/`destinationOwnerFirstName` presentes).
- **Ordem de cascata do Tailwind** conferida no CSS gerado (`frontend/dist/assets/index-*.css`): utilitários da
  mesma propriedade saem em ordem alfabética (`.bg-brand-tint` antes de `.bg-surface-2`), e `cn()` só concatena
  — base do achado I-3.
- **Não verificado no navegador** (sem app rodando nesta revisão): medidas de 320 px / zoom 200 % são estimadas pelo
  código e pelas classes (I-2 em especial); anúncios de leitor de tela são inferidos da árvore ARIA.
- **Contraste**: nenhum token novo; as combinações usadas são as da tabela do §11 (todas ≥ 4,5:1 para texto e
  ≥ 3:1 para bordas/ícones; segmento de moeda inativo isento por 1.4.3).

Severidade: **bloqueante** = falha WCAG 2.1 AA ou informação errada no fluxo principal da feature — corrigir antes
do merge; **importante** = falha de acessibilidade em fluxo secundário, informação errada fora do fluxo principal ou
divergência visível da especificação; **menor** = acabamento.

**Resultado: 0 bloqueantes, 4 importantes, 6 menores.**

---

## 1. Resumo — o que está fiel

| Área | Verificado |
|---|---|
| Ordem dos campos | De → Para → **Tipo** (com ajuda, erro e painel de quitação **dentro** do bloco) → Valor → Descrição → Continuar (`FormStep.tsx:269`, `TransferKindPicker.tsx:61-89`). O bloco só aparece com `destination.isOwn === false` (`TransactionPage.tsx:261-266`); nada acima dele se move. Espaço painel/ajuda = `gap-1.5` + `mt-1.5` = 12 px, igual ao `mt-3` do §11. |
| Seletor "Tipo" | `SegmentedControl` com `value: T \| null`: sem escolha, nenhum `aria-checked="true"` e a parada de Tab no primeiro (`SegmentedControl.tsx:64-67`). `aria-labelledby` = rótulo visível "Tipo", `aria-describedby` só com ids existentes, `aria-required`, `aria-invalid`, trilho `border-negative` no erro. Setas movem **e** selecionam com volta, `Home/End`, opções desabilitadas puladas. Ordem Empréstimo · Quitação · Pagamento. Empilha abaixo de 16rem por container query (`@max-[16rem]:grid-cols-1 rounded-lg`), sem `style` inline. |
| Ajuda e erro do "Tipo" | Textos com o primeiro nome do **titular** (devedor/credor certos por opção, `TransferKindPicker.tsx:46-57`). Erro "Escolha o tipo da transferência." com `CircleAlert` + `role="alert"`; some ao escolher. "Continuar" sem tipo mostra o erro e foca a parada de Tab do grupo (`TransactionPage.tsx:633-637`) — o Tipo vem antes do Valor, então é o primeiro campo com erro. |
| Troca de Para / De | `counterpartKey` limpa tipo, erro, "Quitar tudo" e moeda escolhida quando o par de titulares muda ou o Para passa a ser do mesmo titular (`TransactionPage.tsx:271-278`). Foco volta ao Para (mecanismo da REVIEW-006 I-1). |
| Painel de quitação | Frases "Você deve **R$ 100,00** a Ana" / "Caio deve…" com valor `font-semibold tabular-nums whitespace-nowrap`, `aria-live="polite"`; BTC com 5 casas e 8 quando 5 zerariam (`SettlementPanel.tsx:18-21`). Esqueleto de uma linha 60 px com `aria-busy` + `sr-only role="status"`. Sem dívida: `Banner tone="info" role="status"` com texto `text-text` dentro de `<div id={noDebtId}>`; "Continuar" com `aria-disabled="true"` + `aria-describedby` → aviso, focável e sem ação (`TransactionPage.tsx:625`, `:708-714`, `:887-888`). Erro: `RetryBanner`; offline: `Banner` `WifiOff`. |
| Moeda da dívida | Grupo "Quitar dívida em" Real · Bitcoin só com dívida nas duas moedas ou só na outra; moeda sem dívida visível e `disabled`; sugestão inicial = moeda das carteiras; nota de conversão com `Info` `text-info` ligada por `aria-describedby`; trocar a moeda desliga "Quitar tudo" e limpa o Valor. |
| "Quitar tudo" | `Button secondary sm` (44 px), `aria-pressed`, `aria-describedby` → frase da dívida, `Check` 16 px `strokeWidth 2.5` no estado ligado (ícone dentro de `<span aria-hidden>`). É alternância: tocar de novo desliga, limpa o Valor e, em outra moeda, devolve o foco ao `MoneyInput` (`TransactionPage.tsx:366-380`). Digitar no Valor desliga. Em outra moeda: alternador de unidade `disabled` e Valor `readOnly` (focável, mesmo nome acessível, `bg-surface border-transparent`). Mas ver I-2 e I-3. |
| Confirmação | **Uma** linha "Tipo" com o tipo (`PreviewStep.tsx:200-207`); "Abatido da dívida" logo depois, só em outra moeda, com `formatMoneyFull` (BTC 8 casas); valores do cartão de fluxo com 8 casas (`formatSigned(…, true)`) e, no "quitar tudo", exatamente `preview.sourceAmount`. Bloco "Efeito na dívida" entre o `<dl>` e a nota azul, `<section aria-labelledby>` + `<h3>`; `before` em `text-text-muted`, `after` em semibold, ambos `whitespace-nowrap`; selo `Badge settled` "quitada" com `Check` quando `after === 0` (texto, não só cor). Botão "Registrar empréstimo/quitação/pagamento". 503 com o `Banner` de alerta e o botão `disabled`. |
| Extrato | Rótulos "Empréstimo para Bruno" / "Empréstimo de Ana" etc. com `sourceOwnerFirstName`/`destinationOwnerFirstName` (nome do **titular**, com o nome da carteira só como reserva); estorno "Estorno de empréstimo"; com descrição o rótulo vai para a linha 2; sem `→ Carteira` quando há rótulo; ícone `ArrowLeftRight` inalterado; transferências sem tipo como antes. |
| Detalhe | Cabeçalho com o rótulo do extrato; "Tipo" logo depois de "Para"; "Abatido da dívida" (8 casas em BTC) antes da cotação; `ConfirmModal` usa só o nome do tipo em minúsculas ("empréstimo"), nunca o rótulo com o nome. |
| i18n | Todas as chaves do contrato e as sugeridas no §11 (`preview.settled`, `statement.kind.settlementTo/From`, `paymentTo/From`, `reversal*`) presentes, com acentos, cedilhas e pontuação corretos; "Real"/"Bitcoin" reaproveitam `currency.*`. Toasts conforme o contrato. |
| Alvos de toque | Segmentos `min-h-touch` (44 px) com ~94 px de largura em 320 px; "Quitar tudo" 44 px; alternador de unidade 72 × 44 px. |

---

## 2. Achados

### Bloqueantes

Nenhum.

### Importantes

1. **I-1 · importante · a primeira escolha do "Tipo" não é anunciada: a região viva começa com `display: none`** —
   `components/transaction/TransferKindPicker.tsx:79`.
   O `<p id={helpId} aria-live="polite">` fica montado, mas com `empty:hidden`: antes da escolha ele está vazio, logo
   `display: none`, logo **fora da árvore de acessibilidade**. Quando a pessoa escolhe a primeira opção, o texto entra
   e o elemento passa a existir na árvore ao mesmo tempo — para os leitores isso é uma região viva *nova* com conteúdo,
   que o VoiceOver do iOS (público principal do PWA) e o NVDA normalmente **não** anunciam. Justamente a primeira
   escolha, a que diz o efeito ("Bruno vai ficar devendo esse valor a Ana."), fica muda; as trocas seguintes funcionam.
   O `aria-describedby` está no `radiogroup`, não no rádio, então também não é relido ao mudar a seleção.
   WCAG 4.1.3 (Status Messages) e, na prática, 3.3.2 (a ajuda é a instrução da escolha).
   Correção: trocar `empty:hidden` por **`empty:sr-only`** — o `<p>` vazio continua na árvore, sai do fluxo (posição
   absoluta, não ocupa o `gap-1.5`) e a primeira escolha é anunciada. Nenhuma outra mudança visual.

2. **I-2 · importante · "Valor calculado na confirmação" é cortado em 320 px e com zoom 200 %** —
   `components/ui/MoneyInput.tsx:102-126` (texto como `value` de um `<input>`; `:123` `text-headline`).
   Um `<input>` não quebra linha. Em 320 px sobram ~235 px para o campo (288 − `px-4` × 2 − "₿" − `gap-2`), e a frase
   em 17 px semibold precisa de ~270-280 px (estimado; não medido): aparece "Valor calculado na confir" e o resto
   só rolando dentro do campo. Com zoom 200 % sobra metade disso. O §11 dizia "quebra se precisar" — impossível com
   `<input>` (falha da minha especificação). É o único texto que explica por que o Valor não pode ser editado.
   WCAG 1.4.10 (Reflow).
   Correção (mantém o `<input>` para o nome acessível, o `ref` e o anel de foco do contêiner):
   no modo `readOnly`, o `<input readOnly value={readOnlyText}>` recebe `className="sr-only"` (continua focável; o
   `focus-within` do contêiner desenha o anel) e, ao lado dele, um
   `<span aria-hidden="true" className="min-w-0 flex-1 text-headline font-semibold text-text-muted break-words">`
   com o mesmo texto, que quebra em quantas linhas precisar (`min-h-16` já permite crescer). Opcional: `onClick` no
   contêiner focando o `<input>`, para o toque na frase se comportar como no campo. Corrijo o §11 no próximo ciclo.

3. **I-3 · importante · "Quitar tudo" ligado não ganha o fundo roxo** — `components/transaction/SettlementPanel.tsx:176`;
   causa em `components/ui/Button.tsx:25-26` (variante `secondary` com `bg-surface-2 border-border hover:bg-surface-3`)
   + `utils/cn.ts` (só concatena).
   O estado ligado acrescenta `bg-brand-tint hover:bg-brand-tint border-transparent` por cima das classes da variante.
   No CSS gerado, utilitários da mesma propriedade saem em ordem alfabética: `.bg-surface-2` vem **depois** de
   `.bg-brand-tint` e vence; `hover:bg-surface-3` vence `hover:bg-brand-tint`. Resultado: ligado = fundo cinza
   `surface-2`, só sem borda e com o ✓. O ✓ e o `aria-pressed` seguram a acessibilidade (não é falha de 1.4.1), mas o
   estado ligado fica muito fraco e diverge do §11/mockup ("ligado = fundo roxo + ✓"). Mesmo problema de causa da
   REVIEW-006 I-3.
   Correção: dar ao `Button` uma prop `pressed?: boolean` que, quando `true`, **substitui** a classe da variante
   (`secondary` ligado = `bg-brand-tint text-text border border-transparent hover:bg-brand-tint active:bg-brand-tint`)
   e já repassa `aria-pressed`; no painel, `<Button variant="secondary" size="sm" pressed={settleAll} …>` sem
   `className` de cor. Alternativa mínima: `!bg-brand-tint hover:!bg-brand-tint` no `className` atual.

4. **I-4 · importante · o detalhe de um estorno de quitação diz "Abatido da dívida" (e "Tipo: Quitação")** —
   `components/statement/TransactionDetailSheet.tsx:73-81` e `:169-172`; dado vindo de
   `backend/Finami.Domain/Services/LedgerService.cs:176-177` (o estorno copia `TransferKind`, `DebtCurrency` e
   `DebtAmount` do original).
   Abrindo o lançamento "Estorno de quitação" (quitação em outra moeda), o `<dl>` mostra "Tipo: Quitação" e
   "Abatido da dívida: R$ 100,00" — o contrário do que o estorno faz (ele **devolve** os R$ 100,00 à dívida).
   No estorno de empréstimo, "Tipo: Empréstimo" sob o cabeçalho "Estorno de empréstimo" também confunde.
   Informação errada (WCAG 1.3.1 na prática), fora do fluxo principal.
   Correção: quando `entry.type === TransactionType.Reversal` (ou `transaction.type`), a linha "Tipo" mostra o
   rótulo do estorno (`statement.kind.reversalLoan/Settlement/Payment` — "Estorno de quitação") e a linha de dívida
   **não** usa `debtAbated`: ou some, ou usa uma chave nova `transaction.preview.debtRestored` = "Devolvido à dívida"
   com o mesmo valor (preferível — o número é útil para conferir). O `reverseTypeName` (`:83`) não muda, porque o
   estorno de estorno já é bloqueado por `canReverse`.

### Menores

5. **M-1 · menor · o painel de quitação vira um *landmark* "Tipo"** — `SettlementPanel.tsx:95` e `:129`.
   `<section aria-labelledby={labelId}>` com nome acessível é uma região (`role="region"`): a lista de landmarks
   ganha uma entrada "Tipo, região" que repete o nome do `radiogroup` logo acima e muda conforme a opção (só existe
   na quitação). Pedido da minha especificação — erro meu. Correção: `<div>` sem `aria-labelledby` (o contexto vem do
   grupo "Tipo" imediatamente antes); manter `aria-busy` no `div` do estado carregando. Corrijo o §11.

6. **M-2 · menor · moeda sem dívida aparece "indisponível" sem dizer por quê** — `SettlementPanel.tsx:144-149`.
   O leitor anuncia "Bitcoin, botão de opção, indisponível". Quem vê deduz pela frase "Você deve R$ 100,00 a Ana";
   quem ouve recebe o estado sem motivo. Correção: na opção desabilitada, `ariaLabel` =
   `t("transaction.settlement.noDebtIn", { currency: t("currency.BTC") })` → "Bitcoin, sem dívida" (começa pelo texto
   visível, então 2.5.3 continua atendido). Chave nova `transaction.settlement.noDebtIn` = "{{currency}}, sem dívida".

7. **M-3 · menor · "Continuar" funciona enquanto as dívidas carregam** — `TransactionPage.tsx:309`, `:453-462`,
   `:492`.
   Com o esqueleto na tela, "Continuar" vai para a prévia com `debtCurrency` = moeda das carteiras (o painel ainda
   não sugeriu nada). Se não houver dívida, a pessoa volta ao formulário com o `ServerErrorBanner`; se houver só na
   outra moeda, a prévia pode recusar uma escolha que o painel faria diferente. Raro (a lista costuma chegar antes do
   toque), mas evitável. Correção: com `debtsLoading`, tratar como o "sem dívida" — `aria-disabled="true"` no botão,
   `aria-describedby` apontando para o `<span role="status">` "Carregando…" do esqueleto (dar um `id` a ele) e
   `onPrimary` sem ação.

8. **M-4 · menor · "Quitar tudo" troca Satoshis/Reais por Bitcoin em silêncio** — `TransactionPage.tsx:378`.
   Com De e Para em bitcoin e o alternador em "Satoshis" (ou "Reais"), ligar "Quitar tudo" na mesma moeda força
   "Bitcoin" e preenche "0,0002". O foco fica no botão e a troca de unidade não é anunciada; quem conta em sats vê o
   valor em outra unidade. Correção: em "Satoshis", preencher o total em sats inteiros
   (`Math.round(total * 1e8).toString()`) e manter a unidade; só sair de "Reais" (o total não é um valor em reais),
   e nesse caso o próprio alternador já mostra "Bitcoin" pressionado.

9. **M-5 · menor · toast de quitação pequena em BTC pode dizer "₿ 0,00000"** — `TransactionPage.tsx:539-542`.
   O toast usa `formatMoney` (5 casas); uma quitação de 500 sats vira "Quitação de ₿ 0,00000 para Ana registrada.".
   O painel e a `DebtRow` já resolvem isso com `hidesInDisplay`. Correção: mesma regra do `formatDebt` do
   `SettlementPanel` (8 casas quando 5 zerariam) — vale a pena extrair `formatDebt` para `utils/money.ts` e usar nos dois.

10. **M-6 · menor · com descrição, o nome da pessoa pode sumir na linha 2 do extrato** —
    `components/statement/StatementEntryRow.tsx:53` (`truncate`).
    "14:32 · Quitação para Maximiliano · Cotação R$ 350.000,00" em 320 px trunca no meio do rótulo. O nome acessível
    é completo e o detalhe mostra o rótulo, por isso é menor (decisão da REVIEW E-3 mantida). Correção barata: com
    `kindLabel` e descrição, trocar `truncate` por `line-clamp-2 break-words` na linha 2 — a cotação, que vem por
    último, é que desce/corta, e o rótulo com o nome fica inteiro.

---

## 3. Prioridade sugerida para o `frontend-react-developer`

**I-1 → I-3 → I-2 → I-4 → menores.**

- I-1 é uma classe (`empty:hidden` → `empty:sr-only`) e destrava o anúncio do efeito da escolha.
- I-3 e I-2 mexem em componentes base (`Button` ganha `pressed`; `MoneyInput` ganha o texto visível que quebra) —
  fazer com testes de snapshot de classe/estrutura, como na REVIEW-006 I-3.
- I-4 é só no detalhe; se optar por "Devolvido à dívida", é uma chave nova no `pt-BR.json`.
- M-1, M-2 e M-3 são pequenos e ficam no painel/página; M-4 a M-6 são acabamento.
- Correções de especificação que ficam comigo (`components.md` §11, próximo ciclo de design): estado somente leitura
  do Valor (I-2), `<section>` do painel (M-1), nome da opção sem dívida (M-2) e o detalhe do estorno (I-4).

---

## 4. Resumo

A implementação segue o §11 e o contrato na ordem dos campos, no seletor "Tipo" (nenhum selecionado, setas que movem
e selecionam, foco no erro, nome pelo rótulo visível), no painel de quitação (textos, carregando/erro/sem dívida,
`aria-disabled` + `aria-describedby` no Continuar, "Quitar tudo" com `aria-pressed` e Valor somente leitura focável),
na confirmação (uma linha "Tipo", efeito na dívida, selo "quitada", BTC com 8 casas) e nos rótulos do extrato com o
nome do titular. Não há bloqueantes. Os quatro importantes são: a primeira escolha do tipo não é anunciada (I-1),
a frase do Valor somente leitura é cortada em 320 px/zoom (I-2), o "Quitar tudo" ligado perde o fundo por conflito
de classes (I-3) e o detalhe do estorno de quitação diz "Abatido da dívida" (I-4). Os textos pt-BR estão corretos e
nenhum token novo foi introduzido.
