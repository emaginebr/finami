# Data Model — Convites e notificações

Convenções da constituição (Princípio V): tabelas snake_case no plural, PK `{entidade}_id` bigint
identity, constraint `{tabela}_pkey`, FKs `fk_{pai}_{filho}` com `ClientSetNull`, `timestamp
without time zone` (UTC), enums como `integer`.

## Backend (PostgreSQL / EF Core)

### Tabela `group_invitations` — modelo `GroupInvitation`

| Coluna | Tipo | Regras |
|---|---|---|
| `group_invitation_id` | bigint identity | PK `group_invitations_pkey` |
| `group_id` | bigint not null | FK `fk_group_group_invitation` → `groups` |
| `invited_user_id` | bigint not null | FK `fk_user_group_invitation_invited` → `users` |
| `invited_by_user_id` | bigint not null | FK `fk_user_group_invitation_inviter` → `users` |
| `status` | integer not null default 1 | `GroupInvitationStatus`: 1 Pending, 2 Accepted, 3 Declined, 4 Canceled |
| `created_at` | timestamp not null | UTC |
| `responded_at` | timestamp null | quando saiu de Pending |

Índices: único parcial `ix_group_invitations_pending` em `(group_id, invited_user_id) WHERE status
= 1`; `ix_group_invitations_invited_user_id`.

**Transições** (só a partir de `Pending`; qualquer outra → 409 "convite não está mais disponível"):

```text
Pending ──accept (convidado)──▶ Accepted   (+ group_members, + notificação ao convidante)
Pending ──decline (convidado)─▶ Declined   (+ notificação ao convidante)
Pending ──cancel (responsável)─▶ Canceled
```

Na aceitação, se o grupo não existir ou `invited_by_user_id` não for mais o responsável → 409 e o
convite fica `Canceled` (FR-016).

### Tabela `notifications` — modelo `Notification`

| Coluna | Tipo | Regras |
|---|---|---|
| `notification_id` | bigint identity | PK `notifications_pkey` |
| `user_id` | bigint not null | destinatário; FK `fk_user_notification` |
| `type` | integer not null | `NotificationType`: 1 GroupInvitationReceived, 2 GroupInvitationAccepted, 3 GroupInvitationDeclined |
| `group_id` | bigint null | FK `fk_group_notification` |
| `group_invitation_id` | bigint null | FK `fk_group_invitation_notification` |
| `actor_user_id` | bigint null | quem causou (convidante ou convidado); FK `fk_user_notification_actor` |
| `created_at` | timestamp not null | UTC |
| `read_at` | timestamp null | lida quando preenchido |

Índices: `ix_notifications_user_id_notification_id` em `(user_id, notification_id DESC)`;
parcial `ix_notifications_unread` em `user_id WHERE read_at IS NULL`.

Geração: convite criado → `GroupInvitationReceived` para o convidado (ator = responsável); aceito →
`GroupInvitationAccepted` para o convidante (ator = convidado); recusado →
`GroupInvitationDeclined` idem. Tudo na mesma transação da operação.

### Regra alterada — `GroupService.AddMemberAsync`

Inclui diretamente apenas se `target.CreatedByUserId == chamador`; caso contrário
`BusinessRuleException` (422) "Essa pessoa precisa ser convidada e aceitar o convite.".

## DTOs / tipos (backend `[JsonPropertyName]` camelCase · frontend `src/types/`)

| Nome | Campos |
|---|---|
| `MemberLookupInfo` (entrada) | `email` |
| `MemberLookupResult` | `status: "Available" \| "Registered" \| "AlreadyMember" \| "PendingInvite"`, `email` (normalizado), `user: { userId, firstName, lastName } \| null`, `invitationId: number \| null` (quando `PendingInvite`) |
| `NewMemberInfo` (entrada) | `firstName`, `lastName`, `email: string \| null` |
| `GroupInvitationInsertInfo` (entrada) | `email` |
| `GroupInvitationInfo` | `invitationId`, `groupId`, `groupName`, `invitedUser: { userId, firstName, lastName }`, `invitedBy: { userId, firstName, lastName }`, `status`, `createdAt`, `respondedAt: string \| null` |
| `NotificationInfo` | `notificationId`, `type`, `createdAt`, `isRead`, `group: { groupId, name } \| null`, `actor: { userId, firstName, lastName } \| null`, `invitation: { invitationId, status } \| null` |
| `NotificationPage` | `items: NotificationInfo[]`, `nextBeforeId: number \| null` |
| `UnreadCountResult` | `unread` |
| `MarkReadInfo` (entrada) | `notificationIds: number[]` (máx. 100) |

Validação: email com formato válido e até 254 caracteres; nome/sobrenome obrigatórios até 120
(mesmas regras do cadastro de usuário).

## Frontend — estado

| Context | Estado | Métodos |
|---|---|---|
| `InvitationContext` | `loading`, `error` | `lookupMember(groupId, email)`, `createMember(groupId, info)`, `invite(groupId, email)`, `listPending(groupId)`, `cancel(groupId, invitationId)`, `accept(invitationId)`, `decline(invitationId)` |
| `NotificationContext` | `unread`, `items`, `nextBeforeId`, `loading`, `error` | `refreshUnread()`, `loadFirstPage()`, `loadMore()`, `markRead(ids)` |

Após `accept`: `refreshUnread`, `loadGroups`, `refreshWallets`. Após criar/convidar/cancelar:
recarregar `GroupBalances`/membros e pendentes da família.

### Máquina de estados da folha "Adicionar membro"

```text
email → (lookup) → available → newPersonForm → submitting → done
                 → registered → inviteConfirm → submitting → done
                 → alreadyMember (fim, voltar)
                 → pendingInvite (cancelar convite opcional)
email → ("Adicionar sem email") → newPersonForm(sem email) → submitting → done
qualquer → erro do servidor permanece no passo, dados preservados
```
