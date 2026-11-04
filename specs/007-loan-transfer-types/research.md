# Research: Tipos de transferência — empréstimo, quitação e pagamento

**Feature**: `007-loan-transfer-types` · **Data**: 2026-11-03

Ponto de partida (código atual, feature 006):

- `transactions` guarda tipo contábil (`Transfer`, `BtcPurchase`, `BtcSale`, `Reversal`…), valores de
  saída/entrada e a cotação (`btc_quote_id`, `quote_price_brl`).
- A dívida é calculada na leitura por `TransactionRepository.GetPersonDebtsAsync`: toda transação entre
  carteiras de titulares diferentes e mesma moeda conta (`recebido − enviado`). O estorno, que inverte
  origem e destino, compensa sozinho.
- As regras de transferência ficam em `LedgerService.PlanTransferAsync`, usado pelo registro e pela
  prévia (app, API e MCP).

## R-01 — Onde guardar o tipo e o efeito na dívida

**Decision**: três colunas novas e anuláveis em `transactions`:

- `transfer_kind` (`smallint`): 1 Loan, 2 Settlement, 3 Payment;
- `debt_currency` (`smallint`);
- `debt_amount` (`numeric(20,8)`).

Todo lançamento que mexe em dívida (Empréstimo, Quitação e os estornos deles) grava o par moeda/valor
**do efeito na dívida**. O cálculo da dívida passa a somar só esses lançamentos, por
(`debt_currency`, contraparte), com o mesmo sinal de hoje: "o titular do destino deve ao da origem".

**Rationale**:

- **Mesmo sentido para empréstimo e quitação**: os dois aumentam "destino deve à origem". O
  empréstimo vai do credor ao devedor; a quitação vai do devedor ao credor e reduz a dívida dele, o
  que dá o mesmo sinal.
- **Estornos**: o estorno inverte origem e destino e copia `transfer_kind`, `debt_currency` e
  `debt_amount`, então desfaz o efeito exato, inclusive o valor abatido por uma quitação em outra
  moeda, sem nova cotação.
- **Moeda da dívida separada da moeda das carteiras**: necessária para a quitação em outra moeda
  (FR-013/014), sem tabela nova.
- **Dívida continua derivada**: sem saldos materializados que possam divergir (Princípio V; a 006
  fez o mesmo).

**Alternatives considered**:

- **Tabela `loans` com saldo por empréstimo**: descartada pela clarificação Q1 (saldo único por
  pessoa e moeda).
- **Tabela de "efeitos de dívida" 1:N**: um lançamento tem no máximo um efeito, então colunas
  bastam.
- **Inferir o tipo só pela descrição**: não é confiável.

## R-02 — Migração dos dados existentes (FR-016, SC-002)

**Decision**: a migration `AddTransferKindAndDebt` cria as colunas e roda um `UPDATE` com o mesmo
filtro de `GetPersonDebtsAsync` atual:

- origem e destino são carteiras;
- mesma moeda;
- titulares diferentes e não nulos.

Ele grava `transfer_kind = 1` (Loan), `debt_currency = source.currency` e
`debt_amount = source_amount`. Isso cobre transferências e seus estornos.

**Rationale**: o novo cálculo sobre os dados migrados dá exatamente as dívidas de hoje (SC-002). Um
teste de integração compara os dois cálculos antes e depois.

**Alternatives considered**: migrar como Payment (zeraria as dívidas mostradas hoje; recusado na spec).

## R-03 — Validação da quitação e concorrência

**Decision**: dentro da transação de `PostAsync`, para lançamentos com efeito em dívida:

1. obter um lock consultivo do par de titulares com `pg_advisory_xact_lock(<chave do par>)`;
2. recalcular a dívida do par na moeda;
3. para Quitação, validar que existe dívida e que `abatido ≤ dívida`.

A chave do par é `(min(userId) << 32) | max(userId)` (ids cabem em 32 bits na escala da app) e fica
em `IUnitOfWork.LockDebtPairAsync`. Empréstimos e estornos também pegam o lock, para que um estorno
concorrente não deixe a quitação passar do saldo. A prévia valida sem lock: é só informativa, e o
registro revalida.

**Rationale**:

- O lock das carteiras (`LockAccountsAsync`) não basta: duas quitações podem usar carteiras
  diferentes do mesmo par.
- O lock consultivo é transacional e solto no commit/rollback.
- O PostgreSQL já é a base, então não entra dependência nova.

**Alternatives considered**:

- **Tabela de saldos com `SELECT … FOR UPDATE`**: exigiria materializar a dívida (R-01 descarta).
- **Isolamento `SERIALIZABLE`**: seria mais caro e exigiria retry.

## R-04 — Conversão na quitação em outra moeda (FR-013..015)

**Decision**: o dinheiro sempre anda entre carteiras da mesma moeda (regra da 006). Com `P` = moeda
das carteiras, `C` = moeda da dívida e `preço` = cotação atual (`IBtcQuoteService.GetForConversionAsync`):

| Caso | Enviado (moeda P) | Abatido (moeda C) |
|---|---|---|
| P = C | `amount` | `amount` |
| Dívida BRL, paga BTC | `amount` (₿) | `trunc2(amount × preço)` |
| Dívida BTC, paga BRL | `amount` (R$) | `trunc8(amount ÷ preço)` |
| **Quitar tudo**, P = C | dívida | dívida |
| **Quitar tudo**, dívida BRL / paga BTC | `ceil8(dívida ÷ preço)` | dívida |
| **Quitar tudo**, dívida BTC / paga BRL | `ceil2(dívida × preço)` | dívida |

- Quando `abatido = 0`, a quitação é recusada com "Valor pequeno demais para conversão.".
- Quando `abatido > dívida`, é recusada com "O valor é maior que a dívida (…)." (Q2).
- A cotação usada fica em `btc_quote_id`/`quote_price_brl`, como na transferência em reais.
- O tipo contábil continua `Transfer`, porque não há câmbio nos lançamentos (2 lançamentos, mesma
  moeda).

**Rationale**:

- **"Quitar tudo" calculado no servidor**: é a única forma de garantir dívida exatamente zerada
  (SC-004) com o arredondamento para cima na moeda paga.
- **Truncamento no parcial**: nunca abate mais do que o valor convertido.

**Alternatives considered**:

- **Converter no app** (como no depósito/saque em reais): não garante o zero exato e deixaria a regra
  fora do servidor (FR-017).
- **Abatimento arredondado**: poderia abater um centavo a mais.

## R-05 — Contrato da transferência (compatibilidade)

**Decision**: `TransferInfo` ganha três campos opcionais:

- `kind`: `"loan" | "settlement" | "payment"`;
- `debtCurrency`: `"BRL" | "BTC"`, só para quitação; o padrão é a moeda das carteiras;
- `settleAll`: `bool`, só para quitação; exclui `amount` e `amountBrl`.

Regras:

- **Titulares diferentes sem `kind`**: vale `loan`, que é o comportamento atual (Assumptions). O app
  sempre envia o tipo.
- **Mesmo titular**: `kind`, `debtCurrency` e `settleAll` são recusados com 400 ("O tipo só vale para
  transferência entre pessoas diferentes."), para não registrar um tipo que não teria efeito.
- **`amountBrl`**: continua só para BTC → BTC; numa quitação, o BTC calculado a partir dele é o valor
  enviado.

**Rationale**: a mudança é aditiva e não quebra clientes; a recusa explícita evita que um tipo
inútil fique gravado sem efeito.

## R-06 — Respostas e exibição

**Decision**:

- **`TransferPreviewResult`** ganha:
  - `kind`;
  - `debt`, que é nulo para pagamento e entre o mesmo titular, com os campos `currency`, `amount`
    (valor emprestado ou abatido), `before` e `after`. `before` e `after` são a dívida do titular
    devedor com o credor na moeda; `after = 0` em "quitar tudo".
- **`TransactionInfo`** (detalhe, registro e MCP) e **`StatementEntryInfo`** (extrato) ganham
  `transferKind` e `debtAmount`/`debtCurrency`.
- O app rotula as entradas do extrato pelo tipo: "Empréstimo para Bruno", "Quitação de Bruno",
  "Pagamento para Bruno".

**Rationale**: a confirmação mostra o efeito na dívida antes de gravar (FR-014) e o extrato mostra o
tipo (FR-004) sem chamadas extras.

## R-07 — Dívida no formulário (quitação)

**Decision**: ao escolher Quitação, o app usa o endpoint já existente
`GET /api/users/{titularDaOrigem}/debts` (feature 006, `BalanceContext.getUserDebts`) e filtra a
contraparte que é titular do destino com `direction = owes`.

- **Exibição**: mostra "Você deve R$ 100,00 a Ana", ou "Caio deve…" quando o lançamento é feito pelo
  responsável.
- **Escolha da moeda**: aparece quando há dívida nas duas moedas, ou só na outra moeda.
- **"Quitar tudo"**: envia `settleAll: true`.

**Rationale**: não precisa de endpoint novo. O responsável já pode ver a pessoa dependente
(`CanViewUserAsync`).

## R-08 — MCP

**Decision**: `previa_transferencia` e `registrar_transferencia` ganham:

- `tipo`: `emprestimo | quitacao | pagamento`;
- `moeda_da_divida`: `BRL | BTC`;
- `quitar_tudo`: bool.

As descrições e o `TRANSFER_RULES` explicam os três tipos e pedem ao assistente que confirme o tipo
com a pessoa. `dividas_da_pessoa` não muda de contrato, só de regra de cálculo. O catálogo continua
com 40 ferramentas.

## R-09 — Interface (ux-designer antes do frontend)

**Decision**: o `ux-designer` especifica, antes da implementação:

- o seletor de tipo: grupo de rádio segmentado com 3 opções e uma linha de ajuda por tipo;
- o painel de quitação: dívida atual, escolha da moeda da dívida e ação "Quitar tudo";
- o bloco "Efeito na dívida" da confirmação;
- os rótulos do extrato.

Tudo segue o Princípio IX (WCAG 2.1 AA).
