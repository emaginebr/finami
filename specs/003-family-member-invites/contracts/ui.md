# UI Contract — Adicionar membro, convites e notificações

| Rota / elemento | Mudança | Chamadas | História |
|---|---|---|---|
| `/familias/:groupId` | Botão **"Adicionar membro"** no cabeçalho da seção Membros (só responsável); seção **"Convites pendentes"** (só responsável) com Cancelar; "Gerenciar família" deixa de incluir membros (fica só retirar) | `POST …/member-lookup`, `POST …/members/new`, `POST …/invitations`, `GET …/invitations`, `DELETE …/invitations/{id}` | US1, US2 |
| Folha `AddMemberSheet` | Passos de `data-model.md` (máquina de estados); campo email com `autocomplete="email"` e `inputMode="email"`; link "Adicionar sem email" | idem | US1, US2 |
| `NotificationBell` | Sino com selo (1–9, "9+") no cabeçalho de Home, Carteiras e Conta (celular) e no topo da Sidebar (desktop); `aria-label` "Notificações, N não lidas" | `GET /api/notifications/unread-count` | US3 |
| `/notificacoes` (nova) | Lista mais recente → mais antiga, "Carregar mais", estado vazio; convite pendente com Aceitar/Recusar; estados finais sem botões; aceito/recusado para o responsável (toque → família); ao abrir marca as exibidas como lidas | `GET /api/notifications`, `POST /api/notifications/read`, `POST /api/invitations/{id}/accept`, `…/decline` | US2, US3 |

## Mensagens

| Situação | Texto |
|---|---|
| `Registered` | "Esse email já pertence a {nome}. Você pode enviar um convite para a família." + botão "Convidar para a família" |
| `AlreadyMember` | "{nome} já é membro desta família." |
| `PendingInvite` | "Já existe um convite pendente para {nome}." + "Cancelar convite" |
| Criado e incluído | toast "{nome} agora faz parte da família." |
| Convite enviado | toast "Convite enviado para {nome}." |
| Aceitou | toast "Você agora faz parte de {família}." |
| Convite indisponível (409) | "Este convite não está mais disponível." |
| Notificação recebida | "{ator} convidou você para a família {família}" |
| Notificação aceito / recusado | "{ator} aceitou o convite para {família}" / "{ator} recusou o convite para {família}" |
| Estados finais | "Você aceitou" · "Você recusou" · "Convite cancelado" |
