# API Contract: Finami Backend v1

Base: `/api`. JSON em camelCase (`[JsonPropertyName]` em todos os DTOs). Datas em ISO-8601 UTC
(`2026-11-01T14:03:00Z`); datas de filtro em `yyyy-MM-dd` (fuso `America/Sao_Paulo`). Valores
monetários como número decimal (string-safe: até 8 casas). `currency`: `"BRL"` | `"BTC"`.

**Autenticação**: `Authorization: Bearer {jwt}` em todos os endpoints, exceto os marcados como
🔓 públicos.

**Envelope de erro** (todas as respostas ≠ 2xx):

```json
{ "sucesso": false, "mensagem": "Saldo insuficiente na carteira de origem.", "erros": [] }
```

| Status | Quando |
|---|---|
| 400 | validação de entrada (`erros` lista campo + mensagem) |
| 401 | não autenticado, token inválido/expirado, credenciais inválidas (mensagem genérica) |
| 403 | sem permissão sobre o recurso |
| 404 | recurso inexistente (ou invisível para o usuário) |
| 409 | conflito de unicidade (email já usado, transação já estornada, membro duplicado, convite pendente duplicado, convite não mais disponível) |
| 422 | regra de negócio (saldo insuficiente, carteira inativa, compra resulta em 0 BTC, responsável não pode sair) |
| 503 | cotação indisponível/desatualizada para conversão |
| 500 | erro inesperado (`StatusCode(500, ex.Message)` — Princípio VII) |

---

## Auth

### 🔓 `POST /api/auth/register` — auto-cadastro (FR-002)
Request: `{ "firstName", "lastName", "email", "password" }` — todos obrigatórios, senha ≥ 8.
Response `201`: `AuthResult`. Erros: 400, 409 (email em uso).

### 🔓 `POST /api/auth/login` — email e senha (FR-004/005)
Request: `{ "email", "password" }`. Response `200`: `AuthResult`.
Erros: 401 `"Email ou senha inválidos."` (também para usuário sem senha); 401 para usuário
sem email não se aplica (não há como informá-lo).

### 🔓 `POST /api/auth/google` — login Google (FR-006)
Request: `{ "idToken": "<Google ID token>" }`. Response `200`: `AuthResult` com
`isNewUser: true` quando criado agora. Erros: 401 token inválido / `aud` incorreto /
email não verificado.

### `GET /api/auth/me`
Response `200`: `UserInfo` do usuário autenticado.

```json
// AuthResult
{
  "token": "eyJ...",
  "expiresAt": "2026-11-01T22:00:00Z",
  "isNewUser": false,
  "user": { /* UserInfo */ }
}
```

---

## Users

```json
// UserInfo
{
  "userId": 7, "firstName": "Ana", "lastName": "Silva",
  "email": "ana@ex.com",   // null quando sem email
  "hasPassword": true, "hasGoogle": false, "canLogin": true,
  "createdByUserId": null, "createdAt": "..."
}
```

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| `POST` | `/api/users` | cadastra outro usuário (FR-003). Body `{ firstName, lastName, email?, password? }` → `201 UserInfo` | autenticado; `createdByUserId` = chamador |
| `GET` | `/api/users/{id}` | `UserInfo` | o próprio, quem o cadastrou, ou membro de grupo em comum |
| `PUT` | `/api/users/{id}` | atualiza `{ firstName, lastName, email? }` (FR-010/011) | o próprio ou quem o cadastrou |
| `PUT` | `/api/users/{id}/password` | `{ currentPassword?, newPassword }` — `currentPassword` obrigatório se o próprio já tiver senha | o próprio ou quem o cadastrou |
| `GET` | `/api/users/created-by-me` | usuários que o chamador cadastrou | autenticado |
| `GET` | `/api/users/search?email=` | busca **exata** por email para incluir em grupo/escolher destino; retorna `{ userId, firstName, lastName }` | autenticado |
| `GET` | `/api/users/{userId}/group-balances` | carteiras ativas do usuário em cada família → `UserGroupBalancesResult` (FR-030; feature 002). O próprio vê todos os grupos em `Full`; outro membro vê só os grupos em que seu `detailLevel` não é `Hidden`. Grupos por nome. Ver [api-additions.md §3](../../002-finami-frontend-mobile/contracts/api-additions.md) | o próprio ou membro de grupo em comum; sem grupo visível → 404 |

---

## Groups

```json
// GroupInfo
{
  "groupId": 3, "name": "Família Silva", "responsibleUserId": 7,
  "isResponsible": true, "statementVisibility": "ResponsibleOnly",
  "members": [ { "userId": 7, "firstName": "Ana", "lastName": "Silva", "joinedAt": "..." } ]
}
```

`statementVisibility`: `"ResponsibleOnly"` | `"AllMembers"` | `"MembersSummary"`.

> **Feature 003** — adicionar membro, convites e notificações: `POST /api/groups/{groupId}/member-lookup`,
> `POST /api/groups/{groupId}/members/new`, `POST`/`GET /api/groups/{groupId}/invitations`,
> `DELETE /api/groups/{groupId}/invitations/{invitationId}`, `POST /api/invitations/{invitationId}/accept|decline`,
> `GET /api/notifications`, `GET /api/notifications/unread-count` e `POST /api/notifications/read`.
> Contrato completo em [003 contracts/api.md](../../003-family-member-invites/contracts/api.md).

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| `POST` | `/api/groups` | `{ name }` → `201 GroupInfo`; chamador vira responsável e membro (FR-012/016) | autenticado |
| `GET` | `/api/groups` | grupos em que o chamador é membro/responsável (FR-017) | autenticado |
| `GET` | `/api/groups/{id}` | `GroupInfo` | membro |
| `PUT` | `/api/groups/{id}` | `{ name?, statementVisibility? }` (FR-013, FR-035a) | responsável |
| `POST` | `/api/groups/{id}/members` | `{ userId }` → `201`; 409 se já membro; **desde a feature 003** só inclui pessoas cadastradas pelo responsável (`createdByUserId`), outras → 422 "Essa pessoa precisa ser convidada e aceitar o convite." | responsável |
| `DELETE` | `/api/groups/{id}/members/{userId}` | retira membro e desvincula as carteiras dele (FR-019d); 422 se for o responsável | responsável |
| `GET` | `/api/groups/{groupId}/balances` | saldo por membro → `GroupBalancesResult` (FR-029; feature 002). Só carteiras ativas do grupo; `detailLevel` `Full` (responsável ou `AllMembers`), `Summary` (`MembersSummary`, sem carteiras) ou `Hidden` (`ResponsibleOnly`, valores `null`). Membros: responsável primeiro, depois por nome. BTC estimado em BRL truncado em 2 casas; cotação desatualizada aceita (`quote.isStale`); sem cotação → `btcExcluded`. Ver [api-additions.md §2](../../002-finami-frontend-mobile/contracts/api-additions.md) | membro; não membro → 404 |

---

## Wallets

```json
// WalletInfo
{
  "walletId": 12, "name": "Nubank", "description": "Conta corrente",
  "currency": "BRL", "isVirtual": false, "isActive": true,
  "ownerUserId": 7, "ownerName": "Ana Silva",
  "groupId": 3,              // null quando pessoal
  "balance": 1520.35,
  "estimatedBrl": null,      // só BTC: balance × cotação atual (pode vir null se sem cotação)
  "canControl": true, "createdAt": "..."
}
```

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| `POST` | `/api/wallets` | `{ name, description?, currency, isVirtual, ownerUserId?, groupId? }` → `201 WalletInfo`. Sem `ownerUserId` = carteira do chamador. Com `ownerUserId` ≠ chamador: exige `groupId` de grupo onde o chamador é responsável e o titular é membro (FR-019c) | autenticado |
| `GET` | `/api/wallets` | carteiras que o chamador controla; filtros `?groupId=`, `?ownerUserId=`, `?includeInactive=` | autenticado |
| `GET` | `/api/wallets/{id}` | `WalletInfo` | controla a carteira |
| `PUT` | `/api/wallets/{id}` | `{ name, description, isVirtual }` (moeda imutável — FR-020) | controla |
| `PUT` | `/api/wallets/{id}/group` | `{ groupId }` vincula (titular, sendo membro) · `{ groupId: null }` desvincula (apenas responsável) | ver FR-019d |
| `POST` | `/api/wallets/{id}/deactivate` | desativa (FR-022) | controla |
| `DELETE` | `/api/wallets/{id}` | exclui só se não houver lançamentos; senão 422 | controla |
| `GET` | `/api/wallets/{id}/public` | `{ walletId, name, currency, ownerName, isActive }` — confirmação de destino (FR-026a) | autenticado |

---

## Transactions

```json
// TransactionInfo
{
  "transactionId": 501, "type": "BtcPurchase",
  "source":      { "accountId": 12, "name": "Nubank", "kind": "Wallet", "currency": "BRL", "ownerName": "Ana Silva" },
  "destination": { "accountId": 15, "name": "Ledger", "kind": "Wallet", "currency": "BTC", "ownerName": "Ana Silva" },
  "sourceAmount": 1000.00, "destinationAmount": 0.00200000,
  "quote": { "priceBrl": 500000.00, "quotedAt": "...", "source": "coingecko" },  // null sem conversão
  "description": "Aporte mensal", "occurredAt": "...",
  "createdByUserId": 7, "reversedTransactionId": null, "reversedByTransactionId": null
}
```

`amount` aceita número ou string JSON (`"amount": "0.00000001"`) — feature 002, [api-additions.md §1](../../002-finami-frontend-mobile/contracts/api-additions.md). As respostas continuam com números.

`type`: `"ExternalIncome"` | `"ExternalExpense"` | `"Transfer"` | `"BtcPurchase"` | `"BtcSale"` | `"Reversal"`.

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| `POST` | `/api/transactions/income` | `{ walletId, amount, description? }` — entrada externa → `201 TransactionInfo` | controla a carteira |
| `POST` | `/api/transactions/expense` | `{ walletId, amount, description? }` — saída externa; 422 se saldo insuficiente | controla |
| `POST` | `/api/transactions/transfer` | `{ sourceWalletId, destinationWalletId, amount, description? }` — `amount` na moeda da origem; o tipo (Transfer/BtcPurchase/BtcSale) é decidido pelo servidor (FR-026/027) | controla a origem; destino qualquer carteira ativa |
| `POST` | `/api/transactions/{id}/reverse` | `{ description? }` → `201` estorno (FR-030); 409 se já estornada; 422 se for um estorno ou se o saldo não permitir | controla a conta de entrada da original |
| `GET` | `/api/transactions/{id}` | `TransactionInfo` | controla a origem ou o destino |
| `POST` | `/api/transactions/transfer/preview` | mesmo body do transfer → `{ type, sourceAmount, destinationAmount, quote }` sem gravar | controla a origem |

---

## Quotes

### `GET /api/quotes/btc` (FR-032)
Response `200`:
```json
{ "priceBrl": 512345.67, "quotedAt": "2026-11-01T14:02:10Z", "source": "coingecko", "isStale": false }
```
Fonte indisponível: devolve a última conhecida com `isStale: true`; se nunca houve cotação → `503`.

---

## Statements (FR-033/034/035/035a)

| Método | Rota | Permissão |
|---|---|---|
| `GET` | `/api/statements/wallets/{walletId}?start=2026-01-01&end=2026-01-31` | controla a carteira, ou é membro do grupo vinculado com visibilidade `AllMembers` |
| `GET` | `/api/statements/users/{userId}?start=&end=` | o próprio, ou quem controla todas as carteiras listadas (as demais são omitidas) |
| `GET` | `/api/statements/groups/{groupId}?start=&end=` | responsável: completo; membro: conforme `statementVisibility` (`AllMembers` completo, `MembersSummary` só `totals`, `ResponsibleOnly` → 403) |

Validação: `start` ≤ `end` (400). Período máximo: 366 dias (400).

```json
// StatementResult
{
  "scope": "Group", "scopeId": 3, "start": "2026-01-01", "end": "2026-01-31",
  "detailLevel": "Full",           // "Full" | "Summary"
  "totals": [
    { "currency": "BRL", "openingBalance": 5000.00, "totalIn": 7000.00, "totalOut": 3200.00, "closingBalance": 8800.00 },
    { "currency": "BTC", "openingBalance": 0.01, "totalIn": 0.002, "totalOut": 0, "closingBalance": 0.012 }
  ],
  "entries": [                       // vazio quando detailLevel = "Summary"
    {
      "transactionId": 501, "occurredAt": "...", "type": "BtcPurchase",
      "sourceName": "Nubank", "destinationName": "Ledger",
      "currency": "BRL", "amount": -1000.00,     // efeito no escopo nesta moeda
      "quotePriceBrl": 500000.00, "description": "Aporte mensal", "internal": false
    }
  ]
}
```

Regras: um item por lançamento do escopo (uma compra/venda com as duas carteiras no escopo gera
2 itens, um por moeda). `internal = true` apenas em transferências **na mesma moeda** com origem
e destino no escopo — esses pares se anulam e não somam em `totalIn`/`totalOut`. Compras e vendas
de bitcoin nunca são internas: no escopo, o BRL sai (`totalOut` em BRL) e o BTC entra
(`totalIn` em BTC). Assim vale sempre, por moeda: `closing = opening + totalIn − totalOut`.
