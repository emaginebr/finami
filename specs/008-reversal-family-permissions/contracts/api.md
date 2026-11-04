# Contrato da API — feature 008

Todos os endpoints exigem `[Authorize]`. Os erros seguem o padrão existente (`ErrorResult`): 400
para validação, 403 para permissão, 404, 409 e 422 para regra de negócio.

## Novo: `PUT /api/groups/{groupId}/members/{userId}/permissions`

Muda as permissões de um membro. Só o responsável pode chamar.

```json
// request
{ "canCreateTransactions": false, "canReverse": true }
```

**200**: `GroupInfo` atualizado.

| Situação | Status | Mensagem |
|---|---|---|
| Campo ausente | 400 | "Informe as duas permissões." |
| Quem chama não é o responsável | 403 | "Apenas o responsável pelo grupo pode realizar esta operação." |
| Grupo inexistente | 404 | "Grupo não encontrado." |
| `userId` não é membro | 404 | "Membro não encontrado." |
| `userId` é o responsável | 422 | "As permissões do responsável não podem ser alteradas." |

Efeitos:

- **Com mudança**: grava uma linha no histórico e notifica o membro (`MemberPermissionsChanged`).
- **Sem mudança**: 200, sem histórico e sem notificação.

## Alterados

### `GET /api/groups`, `GET /api/groups/{id}`, e toda resposta `GroupInfo`

```json
{
  "groupId": 7, "name": "Silva", "responsibleUserId": 1, "isResponsible": false,
  "myPermissions": { "canCreateTransactions": true, "canReverse": false },
  "members": [
    { "userId": 1, "firstName": "Ana", "canCreateTransactions": true, "canReverse": true, "...": "..." },
    { "userId": 3, "firstName": "Caio", "canCreateTransactions": false, "canReverse": false, "...": "..." }
  ]
}
```

### Carteiras (`GET /api/wallets`, `GET /api/wallets/{id}` e listas da Home e da família)

`WalletInfo` passa a ter `"canCreateTransactions": bool`.

### `GET /api/transactions/{id}`

- **Acesso**: abre para quem controla uma das carteiras **ou** pode ver o extrato de uma delas
  (R-05). Fora isso, continua 403 "Você não tem permissão sobre esta transação.".
- **Resposta**: `TransactionInfo` passa a ter `"canReverse": bool`.

### Lançamentos: `POST /api/transactions/income`, `/expense`, `/transfer`, `/transfer/preview`

Erro novo:

| Situação | Status | Mensagem |
|---|---|---|
| Origem numa família em que quem lança não tem "Criar lançamentos" | 403 | "Você não tem permissão para criar lançamentos na família {nome}." |

### `POST /api/transactions/{id}/reverse`

A regra de acesso passa a ser a de R-04.

| Situação | Status | Mensagem |
|---|---|---|
| Sem permissão de estorno na família | 403 | "Você não tem permissão para estornar lançamentos na família {nome}." |
| Lançamento só com carteiras pessoais de outra pessoa | 403 | "Você não tem permissão sobre esta transação." |
| Já estornado | 409 | "Esta transação já foi estornada." (inalterado) |
| É um estorno | 422 | "Um estorno não pode ser estornado." (inalterado) |

Efeito novo: cada titular de carteira do lançamento, exceto quem estornou, recebe
`TransactionReversed`.

### `GET /api/notifications`

`NotificationInfo` ganha `permissions`, `transactionId`, `walletId` e `walletName` (data-model). Os tipos novos
são `MemberPermissionsChanged` e `TransactionReversed`.
