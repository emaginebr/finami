# Contrato da API — feature 007

Mudanças aditivas. Erros seguem o padrão atual: 400 para validação, 422 para regra de negócio, com
`{ "message": "..." }`.

## `POST /api/transactions/transfer/preview` e `POST /api/transactions/transfer`

### Corpo (`TransferInfo`)

```json
{
  "sourceWalletId": 12,
  "destinationWalletId": 14,
  "amount": 30.00,
  "amountBrl": null,
  "kind": "settlement",
  "debtCurrency": "BRL",
  "settleAll": false,
  "description": "Devolvendo parte"
}
```

| Campo | Novo | Regra |
|---|---|---|
| `kind` | ✔ | `loan` \| `settlement` \| `payment`. Titulares diferentes: opcional (padrão `loan`). Mesmo titular: precisa estar ausente. |
| `debtCurrency` | ✔ | Só com `settlement`; padrão = moeda das carteiras. |
| `settleAll` | ✔ | Só com `settlement`; com `true`, sem `amount`/`amountBrl`. |
| `amount` / `amountBrl` | — | Como na 006; exatamente um, ou nenhum com `settleAll`. |

### Prévia — resposta 200 (`TransferPreviewResult`)

```json
{
  "type": "Transfer",
  "sourceAmount": 0.0002,
  "destinationAmount": 0.0002,
  "quote": { "priceBrl": 500000.00, "quotedAt": "2026-11-03T17:32:00Z", "source": "coingecko" },
  "kind": "settlement",
  "debt": {
    "currency": "BRL",
    "amount": 100.00,
    "before": 100.00,
    "after": 0.00,
    "debtorUserId": 9,
    "creditorUserId": 7,
    "debtorFirstName": "Bruno",
    "creditorFirstName": "Ana"
  }
}
```

- `kind` vale `null` entre carteiras do mesmo titular.
- `debt` vale `null` para `payment` e para o mesmo titular.
- `quote` vem preenchido quando houve conversão de valor: `amountBrl`, ou quitação em outra moeda.

### Registro — resposta 201 (`TransactionInfo`)

Ganha `transferKind`, `debtCurrency` e `debtAmount` (null quando não se aplicam).

### Erros novos

| Status | Mensagem | Quando |
|---|---|---|
| 400 | "Tipo de transferência inválido." | `kind` fora da lista |
| 400 | "Moeda da dívida inválida. Use BRL ou BTC." | `debtCurrency` fora da lista |
| 400 | "O tipo só vale para transferência entre pessoas diferentes." | `kind`/`debtCurrency`/`settleAll: true` com carteiras do mesmo titular |
| 400 | "Moeda da dívida e quitar tudo só valem para quitação." | `debtCurrency`/`settleAll` sem `kind = settlement` |
| 400 | "Informe o valor em bitcoin ou em reais, ou quite tudo." | combinação inválida de `amount`/`amountBrl`/`settleAll` |
| 422 | "Você não tem dívida com {primeiro nome} nesta moeda." | quitação sem dívida do titular da origem com o do destino na moeda |
| 422 | "O valor é maior que a dívida ({valor formatado})." | abatimento acima do saldo |
| 422 | "Valor pequeno demais para conversão." | abatimento convertido igual a zero (existente) |
| 503 | (existente) | cotação indisponível numa quitação em outra moeda |

As regras da 006 (família e conversão) continuam, com as mesmas mensagens.

## `GET /api/wallets/{id}/statement` (e demais extratos)

Cada `StatementEntryInfo` ganha `transferKind`, `debtCurrency` e `debtAmount`.

## `GET /api/transactions/{id}`

`TransactionInfo` ganha os mesmos três campos.

## `GET /api/users/{userId}/debts`

O formato não muda. O cálculo passa a considerar só empréstimos e quitações (e seus estornos). Os
dados anteriores migram como empréstimo, então os valores mostrados hoje se mantêm.
