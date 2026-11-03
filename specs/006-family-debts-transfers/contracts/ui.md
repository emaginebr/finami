# Contrato de interface — feature 006

Layout visual e tokens definidos pelo `ux-designer` antes da implementação (Princípio VIII). Todas
as telas seguem o Princípio IX (WCAG 2.1 AA).

## Tela Transferir (`/transferir`)

### Campo De

- Lista: `GET /api/wallets` (carteiras que a pessoa controla, só ativas).
- Cada opção: ícone do tipo (real / bitcoin, `aria-hidden`, com o tipo também no texto acessível),
  **primeiro nome do titular** e saldo alinhado à direita (`formatMoney`; BTC com 5 casas). O nome da
  carteira **não aparece na tela** (pedido em 2026-11-03); fica só no nome acessível.
- Nome acessível da opção, ex.: "Ana, Nubank, real, saldo R$ 1.234,56".
- Ao trocar o De: recarrega o Para; limpa o destino se ele não estiver mais na lista (FR-019); limpa
  o modo "valor em reais" se a nova origem não for BTC.

### Campo Para

- Lista: `GET /api/wallets/{deId}/transfer-destinations`, carregada quando o De é escolhido.
- Mesmo formato do De. `balance: null` → "—" com texto acessível "saldo oculto".
- Dois grupos: **"Família"** (`sameCurrency`) e **"Converter"** (`conversion`), com cabeçalho de grupo;
  grupo vazio não aparece.
- Sem nenhuma opção: aviso "Não há carteiras para transferir. Só é possível transferir para pessoas
  da sua família, na mesma moeda." e o botão Continuar fica desabilitado.
- Sem modo "código da carteira" (removido).
- Offline: usa a última lista guardada no cache da sessão (feature 005); se não houver, aviso de
  sem internet.

### Valor (origem BTC e destino BTC)

- Alternador "Bitcoin | Reais" junto ao campo Valor (grupo de botões com `aria-pressed`), visível só
  quando De e Para são BTC.
- Em "Reais": campo em R$ (2 casas). O Continuar chama o preview com `amountBrl`.
- A confirmação mostra: valor em reais informado, **valor em BTC** que será enviado, cotação e
  horário da cotação.
- O registro envia `amount` = `preview.sourceAmount` (BTC).
- Cotação indisponível (503): mensagem existente + ação "Informar em bitcoin" que volta o
  alternador.

### Mensagens de erro do servidor

As novas mensagens (contrato da API) aparecem no banner de erro da folha, como as atuais.

## Página da pessoa (`/pessoas/:userId`)

- Nova seção **"Dívidas"** (`<section aria-labelledby>` com `<h2>`), depois do total e antes das
  famílias.
- Dados: `GET /api/users/{userId}/debts`; recarrega com `ledgerVersion`.
- Cada linha: avatar/inicial da contraparte, frase e valor:
  - página da pessoa logada: "Bruno deve a você" / "Você deve a Bruno";
  - outra pessoa: "Bruno deve a Ana" / "Ana deve a Bruno";
  - valor com `formatMoney` na moeda; "a receber" e "a pagar" diferenciados por texto/sinal, não só
    por cor.
- Linha leva à página da contraparte (`/pessoas/:id`, com `NavState` de volta).
- Sem dívidas: texto "Nenhuma dívida em aberto." (sem estado vazio grande).
- Carregando: skeleton; erro: mensagem curta com "Tentar de novo" sem derrubar o resto da página.

## Botão flutuante (Fab)

- `AppShell`: aparece em todas as rotas do shell, **exceto** `/depositar`, `/sacar`, `/transferir`.
- `/carteiras/:walletId` continua pré-selecionando a carteira.
- O padding inferior de `<main>` reservado ao Fab passa a valer em todas as rotas em que ele
  aparece.

## i18n (`pt-BR.json`) — chaves novas

| Chave | Texto |
|---|---|
| `debts.title` | "Dívidas" |
| `debts.empty` | "Nenhuma dívida em aberto." |
| `debts.owedToYou` | "{{name}} deve a você" |
| `debts.youOwe` | "Você deve a {{name}}" |
| `debts.owesTo` | "{{debtor}} deve a {{creditor}}" |
| `transaction.destinationGroups.family` | "Família" |
| `transaction.destinationGroups.conversion` | "Converter" |
| `transaction.noDestinations` | "Não há carteiras para transferir. Só é possível transferir para pessoas da sua família, na mesma moeda." |
| `transaction.amountUnit.btc` | "Bitcoin" |
| `transaction.amountUnit.brl` | "Reais" |
| `transaction.enterInBtc` | "Informar em bitcoin" |
| `transaction.walletOption` | "{{wallet}}, de {{owner}}, {{currency}}, saldo {{balance}}" |
| `balances.hiddenBalance` | "saldo oculto" |
