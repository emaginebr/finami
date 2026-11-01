# Implementation Plan: Inclusão de membros na família com convites e notificações

**Branch**: `003-family-member-invites` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-family-member-invites/spec.md`

## Summary

Tornar visível "Adicionar membro" na tela da família, com fluxo que começa pelo email: email novo →
cria a pessoa e inclui; sem email → cria e inclui; email existente → **convite** que só vira
participação após o aceite. Nova área de **Notificações** (sino com contador em todas as telas
principais) onde o convidado aceita ou recusa e o responsável recebe a resposta.

Abordagem: backend ganha as entidades `GroupInvitation` e `Notification` (migration
`AddInvitationsAndNotifications`), rotas de lookup, criação atômica de membro, convites e
notificações, e restringe a inclusão direta a pessoas cadastradas pelo próprio responsável.
Frontend ganha as entidades Invitation/Notification, a folha "Adicionar membro", a seção de
convites pendentes, o sino e a tela `/notificacoes`. Decisões em [research.md](./research.md).

## Technical Context

**Language/Version**: C# 12 / .NET 8 (backend) · TypeScript 5.8 / React 18.3 (frontend)
**Primary Dependencies**: existentes — EF Core 9 + Npgsql, FluentValidation, ASP.NET Core JwtBearer; Vite 6, Tailwind 4, React Router 6, i18next, sonner, Radix Dialog, lucide-react. Nenhuma dependência nova.
**Storage**: PostgreSQL — tabelas novas `group_invitations` e `notifications`
**Testing**: xUnit + Moq + FluentAssertions · Vitest + Testing Library + vitest-axe · validação manual em homolog (Docker/WSL)
**Target Platform**: igual à 002 (navegadores móveis e desktop; API em container Linux)
**Project Type**: web application (alteração de backend e frontend existentes)
**Performance Goals**: contador de notificações atualizado ao trocar de tela/voltar ao app (SC-005); listas de notificações paginadas de 20 em 20
**Constraints**: aceite obrigatório para quem tem conta (SC-004); email único (SC-003); no máximo 1 convite pendente por pessoa/família; sem email/push
**Scale/Scope**: 2 tabelas, ~11 rotas novas, 1 rota com regra alterada, 1 tela nova, 1 folha, 2 componentes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* — Constituição v2.0.0

| # | Princípio | Atendimento | Status |
|---|---|---|---|
| I | Skills | `dotnet-architecture` (modelos, repositórios genéricos, serviços, DI, migration); `react-architecture` (Invitation, Notification), `react-modal`, `react-alert` | ✅ (mesma adaptação de resposta da 002, já justificada) |
| II | Stack | Sem dependências novas; Context API; Fetch; EF Core | ✅ |
| III | Casing | `Contexts/`, `Services/`, `hooks/`, `types/` | ✅ |
| IV | Código | DTOs com `[JsonPropertyName]`; `interface`, arrow functions no frontend | ✅ |
| V | Banco | `group_invitations`/`notifications` snake_case plural, PKs `{entidade}_id`, `*_pkey`, FKs `fk_{pai}_{filho}` `ClientSetNull`, timestamps sem fuso, enums `integer` | ✅ |
| VI | Segurança | Todas as rotas com `[Authorize]`; convidado só responde o próprio convite; notificações só do próprio usuário; lookup só para o responsável e devolve apenas nome | ✅ |
| VII | Erros | Controllers via `FinamiControllerBase.Execute` | ✅ |
| VIII | Agentes | `ux-designer` (mockups) → `dotnet-senior-developer` (API) e `frontend-react-developer` (UI) com o contrato `contracts/api.md` definido antes | ✅ |
| IX | Acessibilidade | Sino com `aria-label` e contador anunciado; folha Radix; botões Aceitar/Recusar com nome da família no rótulo; testes axe | ✅ |

**Pós-design**: aprovado; nenhuma violação nova.

## Project Structure

### Documentation (this feature)

```text
specs/003-family-member-invites/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ (api.md, ui.md)
├── checklists/requirements.md
└── tasks.md            # /speckit.tasks
```

### Source Code

```text
backend/                                              # dotnet-senior-developer
├── Finami.Domain/Enums/ (GroupInvitationStatus.cs, NotificationType.cs, MemberLookupStatus.cs)
├── Finami.Domain/Models/ (GroupInvitation.cs, Notification.cs)
├── Finami.DTO/Invitations/InvitationDtos.cs           # MemberLookup*, NewMemberInfo, GroupInvitation*
├── Finami.DTO/Notifications/NotificationDtos.cs       # NotificationInfo, NotificationPage, UnreadCountResult, MarkReadInfo
├── Finami.Infra.Interfaces/Repository/ (IGroupInvitationRepository.cs, INotificationRepository.cs)
├── Finami.Infra/Repository/ (GroupInvitationRepository.cs, NotificationRepository.cs)
├── Finami.Infra/Context/FinamiContext.cs              # configuração das tabelas
├── Finami.Infra/Migrations/*_AddInvitationsAndNotifications.cs
├── Finami.Domain/Interfaces/ (IInvitationService.cs, INotificationService.cs)
├── Finami.Domain/Services/ (InvitationService.cs, NotificationService.cs, GroupService.cs*)
├── Finami.Domain/Validators/InvitationValidators.cs
├── Finami.Application/Startup.cs                      # DI
├── Finami.API/Controllers/ (GroupsController.cs*, InvitationsController.cs, NotificationsController.cs)
└── Finami.Tests/Domain/ (InvitationServiceTests.cs, NotificationServiceTests.cs, GroupServiceTests.cs*)

frontend/src/                                         # frontend-react-developer
├── types/ (invitation.ts, notification.ts)
├── Services/ (invitationService.ts, notificationService.ts)
├── Contexts/ (InvitationContext.tsx, NotificationContext.tsx)
├── hooks/ (useInvitation.ts, useNotification.ts)
├── components/group/ (AddMemberSheet.tsx, PendingInvitations.tsx, MemberManager.tsx*)
├── components/notification/ (NotificationBell.tsx, NotificationItem.tsx)
├── components/layout/ (LargeTitleHeader.tsx*, Sidebar.tsx*)
├── pages/ (NotificationsPage.tsx, GroupPage.tsx*, HomePage.tsx*, WalletsPage.tsx*, AccountPage.tsx*)
├── routes.tsx* · main.tsx* · i18n/pt-BR.json*
└── testes *.test.tsx correspondentes

docs/design/mockups/ (add-member-sheet.html, notifications.html, group.html*)   # ux-designer
```
`*` = arquivo existente alterado.

**Structure Decision**: mesma estrutura web (backend + frontend) das features 001/002.

## Complexity Tracking

Nenhuma violação nova. (A adaptação "Services devolvem o DTO direto" da skill `react-architecture`
continua valendo, justificada no plano da 002.)
