# API Contract — Convites e notificações (feature 003)

Complementa `specs/001-finami-backend-core/contracts/api.md`. Todas as rotas exigem
`Authorization: Bearer {token}`. Erros usam `{ sucesso, mensagem, erros }`. Enums como string.
Implementação: **dotnet-senior-developer**.

## Família — adicionar membro

### `POST /api/groups/{groupId}/member-lookup` — responsável
Body `{ "email": " Ana@Exemplo.com " }` → `200 MemberLookupResult`

```json
{ "status": "Registered", "email": "ana@exemplo.com",
  "user": { "userId": 9, "firstName": "Ana", "lastName": "Souza" }, "invitationId": null }
```
`status`: `Available` (user null) · `Registered` · `AlreadyMember` · `PendingInvite` (com
`invitationId`). 400 email inválido · 403 não responsável · 404 grupo.

### `POST /api/groups/{groupId}/members/new` — responsável
Body `{ "firstName": "Pedro", "lastName": "Silva", "email": "pedro@exemplo.com" }` (`email`
opcional/null) → `201 GroupInfo` (já com o novo membro). Cria o usuário (`createdByUserId` =
chamador) e inclui na mesma transação. 409 email já cadastrado · 400 validação · 403 · 404.

### `POST /api/groups/{groupId}/members` — regra alterada
Inclui diretamente só usuários cadastrados pelo chamador; outros → `422` "Essa pessoa precisa ser
convidada e aceitar o convite.".

## Convites

### `POST /api/groups/{groupId}/invitations` — responsável
Body `{ "email": "bruno@exemplo.com" }` → `201 GroupInvitationInfo`

```json
{ "invitationId": 12, "groupId": 3, "groupName": "Família Silva",
  "invitedUser": { "userId": 9, "firstName": "Bruno", "lastName": "Lima" },
  "invitedBy": { "userId": 1, "firstName": "Ana", "lastName": "Silva" },
  "status": "Pending", "createdAt": "2026-11-01T18:00:00Z", "respondedAt": null }
```
404 email não cadastrado ("Nenhuma pessoa com esse email.") · 409 já é membro · 409 convite
pendente existente · 403 · 404 grupo. Gera notificação `GroupInvitationReceived` ao convidado.

### `GET /api/groups/{groupId}/invitations` — responsável
`?status=Pending` (padrão `Pending`) → `200 GroupInvitationInfo[]` (mais recentes primeiro).

### `DELETE /api/groups/{groupId}/invitations/{invitationId}` — responsável
Cancela convite pendente → `200 GroupInvitationInfo` (`status: "Canceled"`). 409 se não pendente.

### `POST /api/invitations/{invitationId}/accept` — convidado
→ `200 GroupInvitationInfo` (`Accepted`); o chamador vira membro; notificação
`GroupInvitationAccepted` ao convidante. 403 se não for o convidado · 404 · 409 "Este convite não
está mais disponível." (não pendente, grupo inexistente ou convidante não é mais o responsável).

### `POST /api/invitations/{invitationId}/decline` — convidado
→ `200 GroupInvitationInfo` (`Declined`); notificação `GroupInvitationDeclined` ao convidante.
Mesmos erros do accept.

## Notificações (apenas do próprio usuário)

### `GET /api/notifications?beforeId=&limit=20`
`limit` 1–50 (padrão 20). → `200 NotificationPage`

```json
{ "items": [
  { "notificationId": 40, "type": "GroupInvitationReceived", "createdAt": "...", "isRead": false,
    "group": { "groupId": 3, "name": "Família Silva" },
    "actor": { "userId": 1, "firstName": "Ana", "lastName": "Silva" },
    "invitation": { "invitationId": 12, "status": "Pending" } } ],
  "nextBeforeId": null }
```
`invitation.status` é o estado **atual** do convite.

### `GET /api/notifications/unread-count` → `200 { "unread": 2 }`

### `POST /api/notifications/read`
Body `{ "notificationIds": [40, 39] }` (1–100 ids) → `204`. Ids de outros usuários são ignorados.

## Testes esperados (xUnit)

- Lookup: os 4 status; normalização de email; 403 para não responsável.
- `members/new`: com e sem email; email duplicado → 409; usuário criado com `createdByUserId`.
- `POST members`: usuário criado pelo chamador → ok; outro → 422.
- Convite: criar; duplicado pendente → 409; já membro → 409; email inexistente → 404; gera notificação.
- Aceitar: vira membro + notificação ao convidante; repetir → 409; outro usuário → 403; convidante deixou de ser responsável → 409 e convite `Canceled`.
- Recusar e cancelar: estados e notificações; cancelar não pendente → 409.
- Notificações: ordem decrescente, paginação por `beforeId`, contador, marcar só as próprias.
