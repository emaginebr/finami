---
description: "Lista de tarefas — inclusão de membros com convites e notificações"
---

# Tasks: Inclusão de membros na família com convites e notificações

**Input**: `/specs/003-family-member-invites/` (plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/ui.md, quickstart.md)

**Tests**: incluídos — o plano (research R-09) e os "Testes esperados" de `contracts/api.md`
pedem testes xUnit no backend e Vitest + Testing Library + axe no frontend.

## Format: `[ID] [P?] [Story] Descrição → agente`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- Agente responsável ao fim de cada tarefa (constituição, Princípio VIII)
- Skills: `dotnet-architecture` (backend), `react-architecture` + `react-modal` + `react-alert` (frontend)
- Backend: DTOs com `[JsonPropertyName]` camelCase; controllers via `FinamiControllerBase.Execute`; transações com `IUnitOfWork`
- Frontend: pastas `Contexts/`, `Services/`, `hooks/`, `types/`; Services devolvem o DTO e lançam `ApiError`; textos em `src/i18n/pt-BR.json`

---

## Phase 1: Setup (design)

- [X] T001 [P] Criar o mockup `docs/design/mockups/add-member-sheet.html` com todos os passos da máquina de estados de `data-model.md` (email, "Adicionar sem email", Available → nome/sobrenome, Registered → "Convidar para a família", AlreadyMember, PendingInvite com "Cancelar convite", erro de servidor), em 390 px e 1440 px, usando os textos de `contracts/ui.md` → ux-designer
- [X] T002 [P] Criar o mockup `docs/design/mockups/notifications.html` (tela `/notificacoes`: convite pendente com Aceitar/Recusar, estados finais "Você aceitou"/"Você recusou"/"Convite cancelado", aceito/recusado para o responsável, "Carregar mais", vazio) e especificar `NotificationBell` em `docs/design/components.md` (posição no cabeçalho das abas e no topo da Sidebar, selo 1–9 e "9+", foco, `aria-label`) → ux-designer
- [X] T003 [P] Atualizar `docs/design/mockups/group.html` com o botão "Adicionar membro" no cabeçalho da seção Membros e a seção "Convites pendentes" (nome, data, "Cancelar"), e mostrar o sino nos mockups `home.html`, `wallets.html` e `account.html` → ux-designer

---

## Phase 2: Foundational (dados e infraestrutura do backend)

**⚠️ CRITICAL**: as histórias dependem das tabelas e repositórios desta fase.

- [X] T004 [P] Criar enums `backend/Finami.Domain/Enums/GroupInvitationStatus.cs` (Pending=1, Accepted=2, Declined=3, Canceled=4), `NotificationType.cs` (GroupInvitationReceived=1, GroupInvitationAccepted=2, GroupInvitationDeclined=3) e `MemberLookupStatus.cs` (Available, Registered, AlreadyMember, PendingInvite) → dotnet-senior-developer
- [X] T005 [P] Criar os modelos `backend/Finami.Domain/Models/GroupInvitation.cs` (campos de `data-model.md`; métodos `Accept(now)`, `Decline(now)`, `Cancel(now)` que lançam `ConflictException("Este convite não está mais disponível.")` se o status não for Pending) e `backend/Finami.Domain/Models/Notification.cs` (com `MarkRead(now)`) → dotnet-senior-developer
- [X] T006 Configurar `group_invitations` e `notifications` em `backend/Finami.Infra/Context/FinamiContext.cs` exatamente como `data-model.md` (PKs, FKs `fk_*` com `ClientSetNull`, enums como integer, índice único parcial `ix_group_invitations_pending` com `HasFilter("status = 1")`, `ix_notifications_user_id_notification_id`, `ix_notifications_unread` com `HasFilter("read_at IS NULL")`) → dotnet-senior-developer
- [X] T007 Gerar a migration `AddInvitationsAndNotifications` em `backend/Finami.Infra/Migrations/` (`dotnet ef migrations add AddInvitationsAndNotifications --project Finami.Infra --startup-project Finami.API --output-dir Migrations`) e revisar o SQL gerado (nomes de constraints e filtros dos índices) → dotnet-senior-developer
- [X] T008 [P] Criar `backend/Finami.Infra.Interfaces/Repository/IGroupInvitationRepository.cs` (`GetByIdAsync`, `GetByIdForUpdateAsync` com `SELECT … FOR UPDATE`, `GetPendingAsync(groupId, userId)`, `ListByGroupAsync(groupId, status)`, `InsertAsync`, `UpdateAsync`) e `INotificationRepository.cs` (`InsertAsync`, `ListAsync(userId, beforeId, limit)` com convite/grupo/ator carregados, `CountUnreadAsync(userId)`, `MarkReadAsync(userId, ids, now)`) seguindo o padrão genérico dos repositórios existentes → dotnet-senior-developer
- [X] T009 Implementar `backend/Finami.Infra/Repository/GroupInvitationRepository.cs` e `backend/Finami.Infra/Repository/NotificationRepository.cs` e registrá-los em `backend/Finami.Application/Startup.cs` → dotnet-senior-developer
- [X] T010 [P] Criar os DTOs `backend/Finami.DTO/Invitations/InvitationDtos.cs` (`MemberLookupInfo`, `MemberLookupResult`, `NewMemberInfo`, `GroupInvitationInsertInfo`, `GroupInvitationInfo`, `UserSummaryInfo` reutilizado se já existir) e `backend/Finami.DTO/Notifications/NotificationDtos.cs` (`NotificationInfo`, `NotificationPage`, `UnreadCountResult`, `MarkReadInfo`) conforme `contracts/api.md` → dotnet-senior-developer
- [X] T011 [P] Criar validadores em `backend/Finami.Domain/Validators/InvitationValidators.cs` (email obrigatório, formato, ≤ 254; `NewMemberInfo` com nome/sobrenome obrigatórios ≤ 120 e email opcional válido; `MarkReadInfo` com 1–100 ids) e registrá-los → dotnet-senior-developer

**Checkpoint**: `dotnet build` ok e migration aplicável (`docker compose up --build` em homolog aplica na subida).

---

## Phase 3: User Story 1 - Adicionar membro começando pelo email (Priority: P1) 🎯 MVP

**Goal**: responsável adiciona pessoa nova (com ou sem email) direto, e o fluxo detecta email já cadastrado, já membro ou com convite pendente.

**Independent Test**: na família "Silva", adicionar `pedro@exemplo.com` (Pedro Silva) e "Lia Silva" sem email e vê-los em Membros; informar o email de um usuário existente e ver a oferta de convite, sem cadastro duplicado (quickstart 1–5).

### Tests for User Story 1

- [X] T012 [P] [US1] Testes em `backend/Finami.Tests/Domain/MemberLookupTests.cs`: os 4 status (Available, Registered com nome, AlreadyMember inclusive o próprio responsável, PendingInvite com `invitationId`), normalização de `" Ana@Exemplo.com "`, 403 para não responsável, 404 grupo → dotnet-senior-developer
- [X] T013 [P] [US1] Testes em `backend/Finami.Tests/Domain/GroupServiceTests.cs` (criar ou ampliar): `CreateMemberAsync` com e sem email cria usuário com `CreatedByUserId` do responsável e inclui como membro na mesma transação (commit/rollback via mock de `IUnitOfWork`); email duplicado → `ConflictException`; `AddMemberAsync` aceita usuário criado pelo chamador e lança `BusinessRuleException` para usuário criado por outro → dotnet-senior-developer
- [X] T014 [P] [US1] Teste `frontend/src/components/group/AddMemberSheet.test.tsx`: começa pelo email; email inválido mostra erro no campo; Available → nome/sobrenome → `POST …/members/new` e toast; "Adicionar sem email" → envia `email: null`; Registered mostra "Esse email já pertence a …" sem formulário de cadastro; AlreadyMember mostra aviso sem ação; PendingInvite mostra aviso; 409 do servidor mantém os dados; sem violações do `axe` → frontend-react-developer

### Implementation for User Story 1

- [X] T015 [US1] Em `backend/Finami.Domain/Services/GroupService.cs` (e `IGroupService`): `LookupMemberAsync(userId, groupId, email)` e `CreateMemberAsync(userId, groupId, NewMemberInfo)` (transação: valida, cria `User` com `CreatedByUserId`, inclui `GroupMember`), e alterar `AddMemberAsync` para a regra de `data-model.md` → dotnet-senior-developer
- [X] T016 [US1] Em `backend/Finami.API/Controllers/GroupsController.cs`: `POST api/groups/{groupId:long}/member-lookup` (200) e `POST api/groups/{groupId:long}/members/new` (201) com comentários XML; rodar `dotnet test` → dotnet-senior-developer
- [X] T017 [P] [US1] Entidade Invitation no frontend (skill `react-architecture`): `frontend/src/types/invitation.ts` (todos os tipos de `data-model.md`, enums `MemberLookupStatus` e `GroupInvitationStatus`), `frontend/src/Services/invitationService.ts` (`lookupMember`, `createMember`, `invite`, `listPending`, `cancel`, `accept`, `decline`), `frontend/src/Contexts/InvitationContext.tsx`, `frontend/src/hooks/useInvitation.ts`; registrar `InvitationProvider` em `frontend/src/main.tsx` dentro do `GroupProvider` → frontend-react-developer
- [X] T018 [US1] Criar `frontend/src/components/group/AddMemberSheet.tsx` seguindo `docs/design/mockups/add-member-sheet.html` e a máquina de estados de `data-model.md` (campo email com `type="email"`, `autocomplete="email"`; link "Adicionar sem email"; passo de nome/sobrenome; mensagens de `contracts/ui.md`); no estado Registered deixar o botão "Convidar para a família" pronto para receber a ação da US2 → frontend-react-developer
- [X] T019 [US1] Em `frontend/src/pages/GroupPage.tsx`: botão "Adicionar membro" no cabeçalho da seção Membros, só para o responsável, abrindo o `AddMemberSheet`; após incluir, recarregar membros/saldos; em `frontend/src/components/group/MemberManager.tsx`, remover a inclusão por email e o cadastro sem login (fica só "Retirar membro") e ajustar `MemberManager.test.tsx` → frontend-react-developer
- [X] T020 [US1] Adicionar ao `frontend/src/i18n/pt-BR.json` os textos do fluxo de adicionar membro → frontend-react-developer

**Checkpoint**: US1 funciona sozinha — pessoas novas entram na família; email existente nunca gera cadastro duplicado.

---

## Phase 4: User Story 2 - Convidar pessoa existente e aceitar o convite (Priority: P1)

**Goal**: responsável convida pelo email; convidado aceita ou recusa; responsável vê e cancela pendentes.

**Independent Test**: Ana convida `bruno@exemplo.com`; Bruno aparece em "Convites pendentes"; Bruno abre `/notificacoes`, aceita e passa a ver a família; Ana vê Bruno em Membros (quickstart 5–10, 12–13).

### Tests for User Story 2

- [X] T021 [P] [US2] Testes em `backend/Finami.Tests/Domain/InvitationServiceTests.cs` conforme `contracts/api.md`: criar convite (gera notificação `GroupInvitationReceived`); pendente duplicado → 409; já membro → 409; email inexistente → 404; não responsável → 403; aceitar inclui membro e notifica o convidante; aceitar de novo → 409; aceitar por outro usuário → 403; convidante deixou de ser responsável → 409 e convite `Canceled`; recusar notifica; cancelar → `Canceled` e não pendente → 409; listar pendentes só para o responsável → dotnet-senior-developer
- [X] T022 [P] [US2] Teste `frontend/src/components/group/PendingInvitations.test.tsx` (lista com nome e data, cancelar via `ConfirmModal`, oculto para não responsável) e caso novo em `AddMemberSheet.test.tsx` (Registered → "Convidar para a família" chama `POST …/invitations`, toast "Convite enviado para …") → frontend-react-developer
- [X] T023 [P] [US2] Teste `frontend/src/pages/NotificationsPage.test.tsx` (parte de convites): convite pendente mostra família, quem convidou, data e Aceitar/Recusar; aceitar chama a rota, mostra toast "Você agora faz parte de …" e recarrega famílias e carteiras; recusar mostra "Você recusou"; 409 mostra "Este convite não está mais disponível."; botões bloqueados durante o envio → frontend-react-developer

### Implementation for User Story 2

- [X] T024 [US2] Criar `backend/Finami.Domain/Interfaces/IInvitationService.cs` e `backend/Finami.Domain/Services/InvitationService.cs` (`InviteAsync`, `ListByGroupAsync`, `CancelAsync`, `AcceptAsync`, `DeclineAsync`), com transação + `GetByIdForUpdateAsync` em aceitar/recusar/cancelar, conferência de grupo e responsável no aceite, inclusão do membro e criação das notificações na mesma transação; tratar violação do índice único como 409; registrar em `Startup.cs` → dotnet-senior-developer
- [X] T025 [US2] Criar as rotas de convite: em `backend/Finami.API/Controllers/GroupsController.cs` `POST/GET api/groups/{groupId}/invitations` e `DELETE api/groups/{groupId}/invitations/{invitationId}`; novo `backend/Finami.API/Controllers/InvitationsController.cs` com `POST api/invitations/{id}/accept` e `/decline` (`[Authorize]`, `Execute`, XML); rodar `dotnet test` → dotnet-senior-developer
- [X] T026 [US2] Implementar a mínima base de notificações necessária ao convidado: `backend/Finami.Domain/Interfaces/INotificationService.cs` + `backend/Finami.Domain/Services/NotificationService.cs` com `ListAsync(userId, beforeId, limit)` (junta o estado atual do convite) e `backend/Finami.API/Controllers/NotificationsController.cs` com `GET api/notifications` → dotnet-senior-developer
- [X] T027 [US2] Ligar a ação "Convidar para a família" no `frontend/src/components/group/AddMemberSheet.tsx` (`invite`) e, no estado PendingInvite, "Cancelar convite" com `ConfirmModal` → frontend-react-developer
- [X] T028 [P] [US2] Criar `frontend/src/components/group/PendingInvitations.tsx` (seção "Convites pendentes" só para o responsável, nome, data, "Cancelar" com `ConfirmModal`) e incluí-la em `frontend/src/pages/GroupPage.tsx` abaixo de Membros, recarregando após convidar/cancelar → frontend-react-developer
- [X] T029 [P] [US2] Entidade Notification no frontend (skill `react-architecture`): `frontend/src/types/notification.ts`, `frontend/src/Services/notificationService.ts` (`list`, `unreadCount`, `markRead`), `frontend/src/Contexts/NotificationContext.tsx` (`items`, `nextBeforeId`, `loadFirstPage`, `loadMore`), `frontend/src/hooks/useNotification.ts`; registrar `NotificationProvider` em `frontend/src/main.tsx` → frontend-react-developer
- [X] T030 [US2] Criar `frontend/src/components/notification/NotificationItem.tsx` e `frontend/src/pages/NotificationsPage.tsx` (rota `/notificacoes` em `frontend/src/routes.tsx`, lazy, com voltar) exibindo convites recebidos com Aceitar/Recusar e estados finais, seguindo `docs/design/mockups/notifications.html`; após aceitar, `loadGroups()` e `refreshWallets()` → frontend-react-developer
- [X] T031 [US2] Adicionar ao `frontend/src/i18n/pt-BR.json` os textos de convites e da tela de notificações → frontend-react-developer

**Checkpoint**: US1 + US2 entregam o fluxo completo de inclusão com consentimento.

---

## Phase 5: User Story 3 - Área de notificações (Priority: P2)

**Goal**: sino com contador em todas as telas principais, avisos de resposta ao responsável, marcar como lidas, paginação.

**Independent Test**: com um convite pendente, Bruno vê o sino com "1" nas três abas; ao abrir as notificações, o contador zera; Ana recebe "Bruno Lima aceitou o convite para Família Silva" e o toque leva à família (quickstart 8, 11).

### Tests for User Story 3

- [X] T032 [P] [US3] Testes em `backend/Finami.Tests/Domain/NotificationServiceTests.cs`: ordem decrescente, paginação por `beforeId` e `nextBeforeId`, `limit` fora de 1–50 → 400, contador de não lidas, `MarkReadAsync` ignora ids de outros usuários, estado atual do convite refletido na notificação → dotnet-senior-developer
- [X] T033 [P] [US3] Testes `frontend/src/components/notification/NotificationBell.test.tsx` (sem número quando 0, "3", "9+", `aria-label` com a quantidade, link para `/notificacoes`) e casos novos em `NotificationsPage.test.tsx` (abrir marca as exibidas como lidas e zera o contador; aceito/recusado para o responsável com toque levando a `/familias/:id`; "Carregar mais"; estado vazio "Nenhuma notificação por enquanto") → frontend-react-developer

### Implementation for User Story 3

- [X] T034 [US3] Completar `backend/Finami.Domain/Services/NotificationService.cs` com `CountUnreadAsync` e `MarkReadAsync`, e `NotificationsController` com `GET api/notifications/unread-count` e `POST api/notifications/read` (204); rodar `dotnet test` → dotnet-senior-developer
- [X] T035 [US3] Completar `frontend/src/Contexts/NotificationContext.tsx` com `unread`, `refreshUnread` (no login, a cada troca de rota com intervalo mínimo de 10 s, em `visibilitychange` e a cada 60 s com a aba visível — research R-06) e `markRead(ids)`; limpar ao trocar de usuário (`useOnUserChange`) → frontend-react-developer
- [X] T036 [US3] Criar `frontend/src/components/notification/NotificationBell.tsx` conforme `docs/design/components.md` e incluí-lo no cabeçalho de `frontend/src/pages/HomePage.tsx`, `WalletsPage.tsx`, `AccountPage.tsx` (via ação do `LargeTitleHeader` ou do cabeçalho existente) e no topo de `frontend/src/components/layout/Sidebar.tsx` → frontend-react-developer
- [X] T037 [US3] Completar `frontend/src/pages/NotificationsPage.tsx`: tipos aceito/recusado com toque para a família, marcar como lidas as exibidas ao abrir e após "Carregar mais", estado vazio, erro com "Tentar novamente" → frontend-react-developer
- [X] T038 [US3] Adicionar ao `frontend/src/i18n/pt-BR.json` os textos do sino e das notificações de resposta → frontend-react-developer

**Checkpoint**: todas as histórias funcionando de forma independente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T039 [P] Documentar as rotas novas em `specs/001-finami-backend-core/contracts/api.md` (apontando para `specs/003-family-member-invites/contracts/api.md`), em `backend/Finami.API/Finami.API.http` e em `backend/README.md` → dotnet-senior-developer
- [X] T040 [P] Revisão visual das telas novas contra os mockups em 320, 390 e 1440 px, registrando ajustes em `docs/design/REVIEW-003.md` → ux-designer
- [X] T041 Aplicar os ajustes de `docs/design/REVIEW-003.md` e passada de acessibilidade (teclado, foco, `aria-live` nos toasts, rótulos dos botões Aceitar/Recusar com o nome da família) em `frontend/src/` → frontend-react-developer
- [X] T042 Rodar `npm run lint`, `npm test` e `npm run build` em `frontend/` e `dotnet build`/`dotnet test` em `backend/`; corrigir falhas → frontend-react-developer
- [X] T043 Subir homolog (`wsl --cd /mnt/c/repos/finami -e docker compose up -d --build`) e executar o roteiro de `specs/003-family-member-invites/quickstart.md` (passos 1–15) com duas contas, registrando o resultado → dotnet-senior-developer

---

## Dependencies & Execution Order

- **Setup (T001–T003)**: sem dependências; antes das tarefas de interface de cada história.
- **Foundational (T004–T011)**: bloqueia as tarefas de backend de todas as histórias. T006 → T007; T008 → T009.
- **US1**: backend T012–T016 depois da Fase 2; frontend T017–T020 depois de T001 e do contrato (pode usar `fetch` simulado antes do backend pronto).
- **US2**: depende da US1 no frontend (T018 → T027) e da Fase 2 no backend; T026 é a base mínima de notificações para o convidado aceitar.
- **US3**: depende de T026/T029/T030 (notificações básicas).
- **Polish**: depois das histórias.

```text
Setup ─┐
       ├─▶ US1 ─▶ US2 ─▶ US3 ─▶ Polish
Found ─┘
```

## Parallel Opportunities

- T001–T003 (ux-designer) em paralelo com toda a Fase 2 (dotnet-senior-developer).
- Na Fase 2: T004, T005, T008, T010, T011 em paralelo.
- Testes de cada história ([P]) em paralelo entre si; backend e frontend de uma mesma história em paralelo, pois o contrato já está fechado.

### Exemplo — US2

```text
dotnet-senior-developer: T021 → T024 → T025 → T026
frontend-react-developer (em paralelo, com fetch simulado): T022, T023 → T027, T028, T029 → T030 → T031
```

## Implementation Strategy

1. **MVP = US1 + US2**: inclusão visível, email único e convite com aceite — resolve o problema relatado e garante consentimento.
2. **US3**: sino com contador, avisos ao responsável e marcar como lidas.
3. **Polish**: revisão visual, acessibilidade, validação ponta a ponta em homolog.

## Notes

- Nunca `any`, `alert()` ou `window.confirm()` no frontend.
- Commits no formato do GitVersion (`feat(groups): …`, `feat(notifications): …`) somente quando o usuário pedir.
