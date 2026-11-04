# Data Model: Estorno e permissões dos membros na família

**Feature**: `008-reversal-family-permissions` · **Data**: 2026-11-03

## Esquema (PostgreSQL) — migration `AddMemberPermissions`

### `group_members` (existente): colunas novas

| Coluna | Tipo | Nulo | Padrão | Regra |
|---|---|---|---|---|
| `can_create_transactions` | `boolean` | não | `true` | Pode registrar lançamentos com origem nas carteiras desta família (R-03) |
| `can_reverse` | `boolean` | não | `false` | Pode estornar lançamentos das carteiras desta família (R-04) |

Os padrões no banco aplicam a decisão Q2 aos membros atuais e aos novos. Na linha do responsável os
valores são ignorados: o domínio considera tudo `true`.

### `group_member_permission_changes` (nova; só recebe inserções)

| Coluna | Tipo | Nulo | Regra |
|---|---|---|---|
| `group_member_permission_change_id` | `bigint identity` | não | PK `group_member_permission_changes_pkey` |
| `group_id` | `bigint` | não | FK → `groups` (`fk_group_member_permission_changes_group`, ON DELETE CASCADE) |
| `member_user_id` | `bigint` | não | FK → `users` (`fk_group_member_permission_changes_member`, ON DELETE RESTRICT) |
| `changed_by_user_id` | `bigint` | não | FK → `users` (`fk_group_member_permission_changes_changed_by`, ON DELETE RESTRICT) |
| `changed_at` | `timestamptz` | não | UTC |
| `before_can_create_transactions` | `boolean` | não | |
| `before_can_reverse` | `boolean` | não | |
| `after_can_create_transactions` | `boolean` | não | |
| `after_can_reverse` | `boolean` | não | |

Índice: `ix_group_member_permission_changes_group_member` em
(`group_id`, `member_user_id`, `changed_at`).

### `notifications` (existente): colunas novas

| Coluna | Tipo | Nulo | Regra |
|---|---|---|---|
| `permission_change_id` | `bigint` | sim | FK → `group_member_permission_changes` (ON DELETE SET NULL). Só em `MemberPermissionsChanged` |
| `transaction_id` | `bigint` | sim | FK → `transactions` (ON DELETE SET NULL). Só em `TransactionReversed`; é o id do **estorno** |

`NotificationType` ganha `MemberPermissionsChanged = 4` e `TransactionReversed = 5`.

`Down`: remove as colunas e a tabela; os lançamentos não são afetados.

## Domínio

### `GroupMember` (+)

```text
CanCreateTransactions: bool (padrão true)
CanReverse: bool (padrão false)
```

### `Group` (+)

```text
CanCreateTransactions(userId) = IsResponsible(userId) || Member(userId)?.CanCreateTransactions == true
CanReverse(userId)            = IsResponsible(userId) || Member(userId)?.CanReverse == true
SetMemberPermissions(actorId, memberId, canCreate, canReverse) -> GroupMemberPermissionChange?
  - EnsureResponsible(actorId)                     → 403 "Apenas o responsável pelo grupo pode realizar esta operação."
  - memberId é o responsável                        → 422 "As permissões do responsável não podem ser alteradas."
  - memberId não é membro                           → 404 "Membro não encontrado."
  - nada mudou                                      → null (sem histórico nem notificação)
```

### `GroupMemberPermissionChange` (novo modelo)

Espelha a tabela.

### `AccessPolicy` (+)

```text
CanCreateTransactionsAsync(userId, wallet):
    CanControlWalletAsync(userId, wallet)
    && (wallet.GroupId == null || group(wallet).CanCreateTransactions(userId))

EnsureCanCreateTransactionsAsync(userId, wallet):
    sem controle   → 403 "Você não tem permissão sobre esta carteira." (inalterado)
    sem permissão  → 403 "Você não tem permissão para criar lançamentos na família {nome}."

CanViewTransactionAsync(userId, accounts):
    alguma carteira com CanViewWalletStatementAsync(userId, wallet)

CanReverseAsync(userId, transaction, accounts):
    transaction.Type != Reversal && não estornado
    && existe carteira w em accounts tal que:
         w.GroupId == null  → CanControlWalletAsync(userId, w)
         w.GroupId != null  → group(w).IsResponsible(userId)
                              || (group(w).CanReverse(userId) && CanViewWalletStatementAsync(userId, w))

EnsureCanReverseAsync:
    → 403 "Você não tem permissão para estornar lançamentos na família {nome}."
       ({nome}: família da primeira carteira de família do lançamento; sem família: "Você não tem permissão sobre esta transação.")
```

## Regras por operação

| Operação | Verificação nova | Onde |
|---|---|---|
| Receita / despesa | `EnsureCanCreateTransactionsAsync(carteira)` | `LedgerService.IncomeAsync`/`ExpenseAsync` |
| Transferência, prévia, conversão, empréstimo, quitação, pagamento | `EnsureCanCreateTransactionsAsync(origem)` | `LedgerService.PlanTransferAsync` |
| Estorno | `EnsureCanReverseAsync`; depois notifica titulares ≠ autor | `LedgerService.ReverseAsync` |
| Detalhe do lançamento | `CanViewTransactionAsync` (amplia o atual) | `LedgerService.EnsureCanViewAsync` |
| Mudar permissões | `Group.SetMemberPermissions` + histórico + notificação | `GroupService.SetMemberPermissionsAsync` |
| Adicionar, convidar, criar ou remover membro | inalterado (`EnsureResponsible`) | `GroupService`, `InvitationService` |

## DTOs

### `GroupMemberInfo` (+)

| Campo | Tipo |
|---|---|
| `canCreateTransactions` | bool (responsável: sempre `true`) |
| `canReverse` | bool (responsável: sempre `true`) |

### `GroupInfo` (+)

| Campo | Tipo |
|---|---|
| `myPermissions` | `{ canCreateTransactions: bool, canReverse: bool }` |

### `MemberPermissionsInfo` (novo, corpo do PUT)

| Campo | Tipo | Regra |
|---|---|---|
| `canCreateTransactions` | bool | obrigatório |
| `canReverse` | bool | obrigatório |

### `WalletInfo` (+)

| Campo | Tipo |
|---|---|
| `canCreateTransactions` | bool (para quem consulta) |

### `TransactionInfo` (+)

| Campo | Tipo |
|---|---|
| `canReverse` | bool (para quem consulta; `false` se já estornado ou se é estorno) |

### `NotificationInfo` (+)

| Campo | Tipo | Quando |
|---|---|---|
| `permissions` | `{ canCreateTransactions, canReverse }` \| null | `MemberPermissionsChanged` (estado **depois** da mudança registrada) |
| `transactionId` | long \| null | `TransactionReversed` (id do estorno) |
| `walletId` | long \| null | `TransactionReversed` (id da carteira do destinatário, a mesma de `walletName`; o app abre a carteira ao tocar) |
| `walletName` | string \| null | `TransactionReversed` (carteira do destinatário) |

## Transições de estado

As permissões de um membro mudam só pelo responsável, e cada mudança gera um registro no histórico.
O estorno continua sem estados: um lançamento é "estornado" quando existe um `Reversal` que aponta
para ele.
