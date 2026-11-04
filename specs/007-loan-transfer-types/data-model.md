# Data Model: Tipos de transferência — empréstimo, quitação e pagamento

**Feature**: `007-loan-transfer-types` · **Data**: 2026-11-03

## Esquema (PostgreSQL)

### `transactions` (existente) — colunas novas

| Coluna | Tipo | Nulo | Regra |
|---|---|---|---|
| `transfer_kind` | `smallint` | sim | 1 = Loan, 2 = Settlement, 3 = Payment. Só em transferências entre titulares diferentes e nos estornos delas (copiado do original). |
| `debt_currency` | `smallint` | sim | Moeda da dívida afetada (1 BRL, 2 BTC). Preenchida quando `transfer_kind` ∈ {Loan, Settlement}. |
| `debt_amount` | `numeric(20,8)` | sim | Valor do efeito na dívida, > 0, na escala da `debt_currency`. Preenchido junto com `debt_currency`. |

- Enum no domínio: `TransferKind { Loan = 1, Settlement = 2, Payment = 3 }` (`Finami.Domain/Enums`).
- Check constraint `ck_transactions_debt_effect`:
  `(debt_currency IS NULL) = (debt_amount IS NULL) AND (debt_amount IS NULL OR debt_amount > 0)`.
- Índice parcial `ix_transactions_debt_effect` em `(source_account_id, destination_account_id)`
  `WHERE debt_amount IS NOT NULL`. É opcional, e a decisão fica com a implementação se o plano de
  consulta pedir; os índices de conta da 006 já cobrem.
- Migration `AddTransferKindAndDebt`, que faz o backfill (R-02):

```sql
UPDATE transactions t
SET transfer_kind = 1, debt_currency = s.currency, debt_amount = t.source_amount
FROM accounts s, accounts d
WHERE s.account_id = t.source_account_id AND d.account_id = t.destination_account_id
  AND s.kind = <Wallet> AND d.kind = <Wallet>
  AND s.currency = d.currency
  AND s.user_id IS NOT NULL AND d.user_id IS NOT NULL AND s.user_id <> d.user_id;
```

O `Down` remove as colunas, sem perda de dados contábeis.

## Dívida entre pessoas (derivada) — novo cálculo

```
efeitos de P = transações t com t.debt_amount NOT NULL
               onde origem.user_id = P ou destino.user_id = P (titulares diferentes)

para cada contraparte Q e moeda M = t.debt_currency:
    saldo(P, Q, M) = Σ t.debt_amount onde destino.user_id = P e origem.user_id = Q
                   − Σ t.debt_amount onde origem.user_id  = P e destino.user_id = Q
    (> 0: P deve a Q;  < 0: Q deve a P)
```

- **Empréstimo** de A para B: B deve mais a A.
- **Quitação** de B para A: a dívida de B com A cai. Pela fórmula, o sinal é o mesmo do empréstimo
  de A para B, porque a quitação vai do devedor (origem) ao credor (destino).
- **Pagamento**: sem `debt_amount`, então não conta.
- **Estorno**: inverte origem e destino com o mesmo `debt_amount`, então desfaz o efeito.
- O DTO `PersonDebtInfo` e o endpoint `GET /api/users/{id}/debts` não mudam de formato; muda só a
  consulta `TransactionRepository.GetPersonDebtsAsync`.
- Nova consulta `TransactionRepository.GetPairDebtAsync(debtorUserId, creditorUserId, currency)`,
  que devolve o saldo de "devedor deve a credor" (≤ 0 = não deve). É usada na validação e na prévia.

## Alterações em DTOs

### `TransferInfo`

| Campo | Tipo | Regra |
|---|---|---|
| `kind` | `"loan" \| "settlement" \| "payment"` (opcional) | Titulares diferentes: padrão `loan`. Mesmo titular: precisa estar ausente (400). |
| `debtCurrency` | `"BRL" \| "BTC"` (opcional) | Só com `kind = settlement`; padrão = moeda das carteiras. |
| `settleAll` | `bool` (opcional, padrão `false`) | Só com `kind = settlement`; com `true`, `amount` e `amountBrl` precisam estar ausentes. |

Validação (`TransferInfoValidator`):

- **Valor**: exatamente um entre `amount` e `amountBrl`, ou nenhum dos dois com `settleAll = true`.
  Mensagem existente adaptada: "Informe o valor em bitcoin ou em reais, ou quite tudo.".
- **Campos de quitação fora de quitação**: `debtCurrency` ou `settleAll` com `kind ≠ settlement` dá
  400 "Moeda da dívida e quitar tudo só valem para quitação.".
- **Valor do `kind`**: fora da lista dá 400 "Tipo de transferência inválido.".

### `TransferPreviewResult` (+)

| Campo | Tipo | Regra |
|---|---|---|
| `kind` | string \| null | `loan`/`settlement`/`payment`; `null` entre carteiras do mesmo titular |
| `debt` | `TransferDebtEffect?` | `null` para pagamento e mesmo titular |

`TransferDebtEffect`:

| Campo | Tipo | Regra |
|---|---|---|
| `currency` | `BRL \| BTC` | Moeda da dívida |
| `amount` | decimal | Valor emprestado ou abatido |
| `before` | decimal | Saldo "devedor deve a credor" antes, na moeda (negativo = era o credor quem devia) |
| `after` | decimal | O mesmo saldo depois do lançamento (`0` em "quitar tudo") |
| `debtorUserId` / `creditorUserId` | long | Para o texto "Bruno deve a Ana" |

### `TransactionInfo` e `StatementEntryInfo` (+)

| Campo | Tipo |
|---|---|
| `transferKind` | `"loan" \| "settlement" \| "payment" \| null` |
| `debtCurrency` | `"BRL" \| "BTC" \| null` |
| `debtAmount` | decimal \| null |

## Regras (ordem em `PlanTransferAsync`)

1. Validação do DTO (inclui `kind`, `debtCurrency`, `settleAll`).
2. Carregar a origem; `EnsureCanControlWalletAsync`; carregar o destino; os dois ativos (existente).
3. **Mesmo titular**: se `kind`, `debtCurrency` ou `settleAll` vierem, 400. Segue o fluxo atual
   (transferência ou conversão), sem efeito na dívida.
4. **Titulares diferentes**: regras da 006 (moedas iguais; família em comum).
5. Calcular o valor enviado: `amount`, `amountBrl` (BTC→BTC) ou, se `settleAll`, a partir da dívida
   (R-04).
6. `kind = loan`: efeito = (moeda das carteiras, valor enviado).
7. `kind = payment`: sem efeito.
8. `kind = settlement`:
   - `C = debtCurrency ?? moeda das carteiras`;
   - dívida atual de origem→destino em `C` ≤ 0 → 422 "Você não tem dívida com {nome} nesta moeda.";
   - se `C ≠ moeda das carteiras`, buscar a cotação e converter (R-04); abatido 0 → 422 "Valor
     pequeno demais para conversão.";
   - abatido > dívida → 422 "O valor é maior que a dívida ({dívida formatada}).".
9. **Registro** (`PostAsync`): com efeito na dívida, tomar `LockDebtPairAsync` e repetir a validação
   do passo 8 dentro do lock (R-03).

## Transições de estado

Nenhuma entidade com estado. A dívida muda só por efeito de lançamentos e estornos.
