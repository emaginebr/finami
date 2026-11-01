# API Contract — Adições ao backend para o frontend (feature 002)

Complementa `specs/001-finami-backend-core/contracts/api.md`. Todas as rotas exigem
`Authorization: Bearer {token}`. Erros seguem o envelope `{ sucesso, mensagem, erros }`.
Responsável pela implementação: **dotnet-senior-developer** (Princípio VIII).

---

## 1. Valores numéricos aceitos como string

Todas as rotas que recebem valores (`amount` em `/api/transactions/*`) passam a aceitar o número
também como string JSON:

```json
{ "walletId": 100, "amount": "0.00000001", "description": "Aporte" }
```

Implementação: `JsonSerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString`
em `Program.cs`. Respostas continuam com números JSON. Validações (casas decimais, valor > 0) não
mudam.

---

## 2. `GET /api/groups/{groupId}/balances` — saldo por membro (FR-029)

**Permissão**: membro do grupo (inclui o responsável). Não membro → `404`.

**Nível de detalhe** (`detailLevel`), definido pelo servidor:

| Quem pergunta | `statementVisibility` | `detailLevel` | O que vem |
|---|---|---|---|
| Responsável | qualquer | `Full` | totais por membro + carteiras |
| Membro | `AllMembers` | `Full` | totais por membro + carteiras |
| Membro | `MembersSummary` | `Summary` | totais por membro; `wallets` vazio |
| Membro | `ResponsibleOnly` | `Hidden` | só a lista de membros; valores `null`, `wallets` vazio |

Considera apenas carteiras **ativas** com `groupId` = grupo, agrupadas pelo titular. Membros sem
carteira aparecem com zero.

```json
// GroupBalancesResult
{
  "groupId": 3,
  "name": "Família Silva",
  "statementVisibility": "MembersSummary",
  "isResponsible": false,
  "detailLevel": "Summary",
  "quote": { "priceBrl": 512345.67, "quotedAt": "2026-11-01T14:02:10Z", "isStale": false },  // null se nunca houve cotação
  "btcExcluded": false,          // true quando há BTC e não há cotação → BTC fora de totalBrl
  "totalBrl": 400.00,            // null quando detailLevel = Hidden
  "members": [
    {
      "userId": 7, "firstName": "Ana", "lastName": "Silva", "isResponsible": true,
      "balanceBrl": 300.00,      // soma das carteiras BRL do membro no grupo; null em Hidden
      "balanceBtc": 0.00000000,  // soma das carteiras BTC; null em Hidden
      "estimatedBrl": 0.00,      // balanceBtc × cotação, truncado em 2 casas; null em Hidden ou sem cotação
      "totalBrl": 300.00,        // balanceBrl + estimatedBrl (sem o BTC se btcExcluded); null em Hidden
      "wallets": [ /* WalletBalanceInfo — só em Full */ ]
    }
  ]
}
```

```json
// WalletBalanceInfo
{
  "walletId": 102, "name": "Mesada", "currency": "BRL", "isVirtual": true,
  "balance": 100.00,
  "estimatedBrl": null,          // só BTC
  "canViewStatement": true       // pode abrir GET /api/statements/wallets/{id}
}
```

Ordenação: `members` pelo responsável primeiro e depois por nome; `wallets` por nome.

---

## 3. `GET /api/users/{userId}/group-balances` — carteiras do membro nas famílias (FR-030)

**Grupos incluídos**: grupos em que `userId` é membro **e**:
- quem pergunta é o próprio `userId` (todos os grupos dele, `Full`); ou
- quem pergunta é membro do mesmo grupo e o `detailLevel` dele naquele grupo (tabela da seção 2)
  não é `Hidden`.

Se nenhum grupo for visível e quem pergunta não for o próprio usuário → `404` (não revela a
existência do vínculo).

```json
// UserGroupBalancesResult
{
  "userId": 9, "firstName": "Pedro", "lastName": "Silva",
  "btcExcluded": false,
  "totalBrl": 250.00,            // soma dos totalBrl dos grupos listados
  "groups": [
    {
      "groupId": 3, "name": "Família Silva", "detailLevel": "Full",
      "balanceBrl": 100.00, "balanceBtc": 0.0003, "estimatedBrl": 150.00, "totalBrl": 250.00,
      "wallets": [ /* WalletBalanceInfo — só em Full */ ]
    }
  ]
}
```

Considera só carteiras ativas de `userId` ligadas a cada grupo. Grupos ordenados por nome.

---

## Regras comuns

- Cotação: a mesma do `IQuoteService` (cache de 60 s, última conhecida se a fonte falhar). Se
  nunca houve cotação, `quote = null`, `estimatedBrl = null` e `btcExcluded = true` quando houver
  saldo BTC. Ao contrário das conversões, cotação desatualizada **é aceita** aqui (é só
  estimativa) e sinalizada em `quote.isStale`.
- Arredondamento: `estimatedBrl` truncado em 2 casas, como em `WalletInfo.estimatedBrl`.
- Nenhuma das rotas grava dados.

## Testes esperados (xUnit)

- Responsável vê `Full` nas três visibilidades.
- Membro: `AllMembers` → `Full`; `MembersSummary` → `Summary` sem carteiras; `ResponsibleOnly` →
  `Hidden` com valores `null`.
- Não membro → 404 em `/groups/{id}/balances`; usuário sem grupo visível → 404 em
  `/users/{id}/group-balances`; o próprio usuário sem grupos → 200 com `groups` vazio.
- Carteiras inativas ou de outro grupo não entram nas somas.
- Sem cotação: `btcExcluded = true` e totais só com BRL.
- `amount` enviado como string `"0.00000001"` é aceito em `/api/transactions/income`.
