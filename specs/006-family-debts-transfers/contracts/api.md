# Contrato da API — feature 006

Todas as rotas exigem `Authorization: Bearer {token}`. Erros usam o envelope existente
`{ "sucesso": false, "mensagem": "...", "erros": [] }`.

## Novo — `GET /api/users/{userId}/debts`

Dívidas da pessoa com cada contraparte, por moeda (R-01, R-10).

- **Autorização**: `IAccessPolicy.CanViewUserAsync(currentUserId, target)` → senão **404**
  (mesmo comportamento de `GET /api/users/{id}`).
- **200**:

```json
{
  "userId": 7,
  "debts": [
    {
      "counterpartUserId": 9,
      "counterpartName": "Bruno Souza",
      "counterpartFirstName": "Bruno",
      "currency": "BRL",
      "amount": 70.00,
      "direction": "owed"
    },
    {
      "counterpartUserId": 9,
      "counterpartName": "Bruno Souza",
      "counterpartFirstName": "Bruno",
      "currency": "BTC",
      "amount": 0.00040000,
      "direction": "owes"
    }
  ]
}
```

- `direction`: `owes` = a pessoa `userId` deve à contraparte; `owed` = a contraparte deve a ela.
- Lista vazia quando não há dívidas em aberto.

## Novo — `GET /api/wallets/{id}/transfer-destinations`

Opções do campo Para para a carteira de origem `{id}` (R-05).

- **Autorização**: quem consulta precisa controlar a carteira de origem
  (`EnsureCanControlWalletAsync`) → senão **403** "Você não tem permissão sobre esta carteira.".
- Origem inexistente → **404**; origem desativada → **422** (mensagem existente de carteira
  desativada).
- **200**:

```json
{
  "sourceWalletId": 5,
  "sameCurrency": [
    { "walletId": 6, "name": "Poupança", "currency": "BRL", "ownerUserId": 7,
      "ownerFirstName": "Ana", "isOwn": true, "balance": 300.00 },
    { "walletId": 12, "name": "Mesada", "currency": "BRL", "ownerUserId": 9,
      "ownerFirstName": "Bruno", "isOwn": false, "balance": null }
  ],
  "conversion": [
    { "walletId": 8, "name": "Ledger", "currency": "BTC", "ownerUserId": 7,
      "ownerFirstName": "Ana", "isOwn": true, "balance": 0.01000000 }
  ]
}
```

- `balance: null` = saldo oculto para quem consulta (FR-018).

## Alterado — `GET /api/wallets`, `GET /api/wallets/{id}`

`WalletInfo` ganha `ownerFirstName` (string). Aditivo; demais campos inalterados.

## Alterado — `POST /api/transactions/transfer` e `POST /api/transactions/transfer/preview`

Corpo:

```json
{ "sourceWalletId": 8, "destinationWalletId": 14, "amountBrl": 200.00, "description": "Presente" }
```

| Campo | Regra |
|---|---|
| `amount` | Opcional agora; valor na moeda da origem |
| `amountBrl` | Novo, opcional; só com origem **e** destino BTC |

Exatamente um dos dois deve vir preenchido.

Novas respostas de erro (em ambos os endpoints):

| Status | Mensagem | Quando |
|---|---|---|
| 400 | "Informe o valor em bitcoin ou em reais." | nenhum ou os dois campos de valor |
| 400 | "Valor em reais só vale para transferência entre carteiras de bitcoin." | `amountBrl` fora de BTC → BTC |
| 422 | "Só é possível transferir para pessoas da sua família." | titulares sem família em comum (R-03) |
| 422 | "Conversão entre real e bitcoin só entre carteiras da mesma pessoa." | moedas diferentes e titulares diferentes (R-04) |
| 422 | "Valor pequeno demais para conversão." | `amountBrl` vira 0 BTC (mensagem existente) |
| 503 | (mensagem existente de cotação indisponível) | `amountBrl` sem cotação |

Preview com `amountBrl`: `sourceAmount` = valor em BTC calculado, `destinationAmount` = o mesmo,
`type` = `"Transfer"`, `quote` preenchido.

Transfer com `amountBrl`: grava o valor em BTC calculado e a cotação (`btcQuoteId`,
`quotePriceBrl`) na transação. O app **não** usa `amountBrl` no registro: ele envia o `amount` em
BTC vindo do preview (R-07).

## Sem mudança

- `GET /api/wallets/{id}/public` permanece, mas deixa de ser usado pelo app (R-09).
- `POST /api/transactions/{id}/reverse`: sem mudança; o estorno compensa a dívida pelo cálculo.
