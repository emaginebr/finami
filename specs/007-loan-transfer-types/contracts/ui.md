# Contrato de interface — feature 007

O `ux-designer` define o layout e os tokens antes da implementação (Princípio VIII). Tudo segue o
Princípio IX (WCAG 2.1 AA). O que já existe da feature 006 continua: campos De/Para, alternador
Bitcoin | Satoshis | Reais e prévia.

## Tela Transferir (`/transferir`)

### Seletor "Tipo"

- **Quando aparece**: só quando o Para é de outro titular (`destination.isOwn === false`), entre o
  campo Para e o campo Valor.
- **Forma**: `role="radiogroup"` com rótulo "Tipo", três opções na ordem **Empréstimo**,
  **Quitação**, **Pagamento**, e setas para navegar. Nenhuma vem selecionada.
- **Ajuda curta da opção escolhida** (`aria-describedby`):
  - Empréstimo: "{destino} vai ficar devendo esse valor a {origem}.";
  - Quitação: "Abate uma dívida de {origem} com {destino}.";
  - Pagamento: "Não gera dívida.".
- **Sem tipo escolhido**: "Continuar" mostra o erro "Escolha o tipo da transferência." junto ao
  grupo e põe o foco nele.
- **Troca de Para**: se o novo destino for do mesmo titular, o tipo some e é limpo. Se for de outro
  titular diferente do anterior, o tipo é limpo.

### Painel de quitação (tipo = Quitação)

- **Dados**: `getUserDebts(titular da origem)`, filtrado pela contraparte = titular do destino com
  `direction = "owes"`. Enquanto carrega, aparece um skeleton de uma linha.
- **Texto**: "Você deve R$ 100,00 a Ana", ou "Caio deve R$ 100,00 a Ana" quando a origem é de um
  dependente.
- **Moeda da dívida**: grupo "Quitar dívida em" com **Real** | **Bitcoin**. Aparece quando há dívida
  nas duas moedas, ou só na moeda diferente da das carteiras.
  - Sugestão inicial: a dívida na moeda das carteiras, se existir; senão, a outra.
  - Quando a moeda da dívida é diferente da das carteiras, aparece a nota "Convertido pela cotação
    atual na confirmação.".
- **Sem dívida em nenhuma moeda**: aviso informativo "{Você não tem | Caio não tem} dívida com Ana."
  e "Continuar" desabilitado (`aria-disabled`, com o aviso no `aria-describedby`).
- **Ação "Quitar tudo"** (botão secundário pequeno, na linha da dívida):
  - liga o modo "quitar tudo";
  - **mesma moeda**: preenche o Valor com o total da dívida;
  - **outra moeda**: o campo Valor mostra "Valor calculado na confirmação" e fica somente leitura;
  - digitar no Valor ou trocar a moeda da dívida desliga o modo.
- **Envio**: o app manda `kind: "settlement"`, `debtCurrency` e `settleAll` (quando ligado).

### Confirmação (prévia)

A prévia já é obrigatória entre pessoas diferentes. Ela ganha:

- linha "Tipo" (Empréstimo, Quitação ou Pagamento) no `<dl>`;
- bloco **"Efeito na dívida"**, quando `debt` vem preenchido:
  - "Bruno vai dever R$ 100,00 a Ana" (empréstimo), ou "Dívida de Bruno com Ana: R$ 100,00 →
    R$ 70,00" (quitação), com "quitada" quando chega a zero;
  - em quitação em outra moeda: "Abatido da dívida: R$ 100,00" mais a cotação e o horário (linhas que
    já existem);
- botão principal: "Registrar empréstimo", "Registrar quitação" ou "Registrar pagamento".

### Sucesso (toast)

- "Empréstimo de R$ 100,00 para Bruno registrado."
- "Quitação de R$ 30,00 para Ana registrada."
- "Pagamento de R$ 50,00 para Bruno registrado."

## Extrato e detalhe do lançamento

- **Rótulo da entrada** de transferência com tipo, conforme o lado da carteira do extrato:
  - "Empréstimo para Bruno" / "Empréstimo de Ana";
  - "Quitação para Ana" / "Quitação de Bruno";
  - "Pagamento para Bruno" / "Pagamento de Ana".
- **Detalhe**: linha "Tipo" e, em quitação em outra moeda, "Abatido da dívida".
- **Estorno**: o rótulo do original continua, e o estorno mostra "Estorno de empréstimo" (ou de
  quitação/pagamento).

## Dívidas (Home e página da pessoa)

O formato não muda (feature 006).

## i18n (`pt-BR.json`) — chaves novas

| Chave | Texto |
|---|---|
| `transaction.kind.label` | "Tipo" |
| `transaction.kind.loan` / `settlement` / `payment` | "Empréstimo" / "Quitação" / "Pagamento" |
| `transaction.kind.help.loan` | "{{debtor}} vai ficar devendo esse valor a {{creditor}}." |
| `transaction.kind.help.settlement` | "Abate uma dívida de {{debtor}} com {{creditor}}." |
| `transaction.kind.help.payment` | "Não gera dívida." |
| `transaction.validation.kindRequired` | "Escolha o tipo da transferência." |
| `transaction.settlement.youOwe` / `owes` | "Você deve {{amount}} a {{name}}" / "{{debtor}} deve {{amount}} a {{name}}" |
| `transaction.settlement.noDebt` / `noDebtOther` | "Você não tem dívida com {{name}}." / "{{debtor}} não tem dívida com {{name}}." |
| `transaction.settlement.debtCurrency` | "Quitar dívida em" |
| `transaction.settlement.settleAll` | "Quitar tudo" |
| `transaction.settlement.computedOnPreview` | "Valor calculado na confirmação" |
| `transaction.settlement.convertedNote` | "Convertido pela cotação atual na confirmação." |
| `transaction.preview.kind` | "Tipo" |
| `transaction.preview.debtEffect` | "Efeito na dívida" |
| `transaction.preview.loanEffect` | "{{debtor}} vai dever {{amount}} a {{creditor}}" |
| `transaction.preview.settlementEffect` | "Dívida de {{debtor}} com {{creditor}}: {{before}} → {{after}}" |
| `transaction.preview.debtAbated` | "Abatido da dívida" |
| `transaction.submit.loan` / `settlement` / `payment` | "Registrar empréstimo" / "Registrar quitação" / "Registrar pagamento" |
| `statement.kind.loanTo` / `loanFrom` / … | "Empréstimo para {{name}}" / "Empréstimo de {{name}}" / … |
