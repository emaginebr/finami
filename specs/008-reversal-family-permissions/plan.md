# Implementation Plan: Estorno e permissões dos membros na família

**Branch**: `008-reversal-family-permissions` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-reversal-family-permissions/spec.md`

## Summary

O estorno já existe para todos os tipos de lançamento e preserva o original e o estorno. Esta
feature fecha o que falta e cria **permissões por membro, por família**, que só o responsável muda:

- **Pode lançar** (`can_create_transactions`): padrão ligada. Sem ela, o membro só consulta aquela
  família.
- **Pode estornar** (`can_reverse`): padrão desligada (Q2). Com ela, o membro estorna qualquer
  lançamento das carteiras da família que ele pode ver (Q1 B, R-05).

Abordagem técnica:

- **Banco**: colunas em `group_members`, tabela de histórico `group_member_permission_changes` e duas
  colunas em `notifications` (migration `AddMemberPermissions`).
- **Regras**: centralizadas no `AccessPolicy`:
  - `CanCreateTransactionsAsync`, aplicada a depósito, saque e à origem de toda transferência;
  - `CanReverseAsync`, que substitui a regra de controle no estorno.

  Assim app, API e MCP ficam cobertos de uma vez.
- **Endpoint novo**: `PUT /api/groups/{groupId}/members/{userId}/permissions`.
- **Campos novos**: `canCreateTransactions` nas carteiras e `canReverse` no lançamento, para o app
  não duplicar regras.
- **Notificações**: permissões alteradas, e estorno feito por outra pessoa.
- **Frontend**:
  - interruptores de permissão na página da família;
  - filtro de carteiras e estado "somente leitura" nas telas de lançar;
  - "Estornar" guiado por `canReverse`;
  - confirmação do estorno com o efeito.
- **MCP**: ferramenta `alterar_permissoes_membro` (41 ferramentas).

## Technical Context

**Language/Version**: C# 12 / .NET 8 (backend) · TypeScript 5.8 / React 18.3 (frontend)
**Primary Dependencies**: as já existentes, sem dependências novas.
**Storage**: PostgreSQL. Migration `AddMemberPermissions`:
- 2 colunas em `group_members`;
- tabela `group_member_permission_changes`;
- 2 colunas com FK em `notifications`.

**Testing**: xUnit + Moq + FluentAssertions; integração com PostgreSQL real (homolog) · Vitest +
Testing Library + vitest-axe.
**Target Platform**: API em Linux (Docker) · PWA em navegadores móveis e desktop.
**Project Type**: web application (backend + frontend).
**Performance Goals**: verificar a permissão acrescenta no máximo 1 leitura de grupo por lançamento.
Listar carteiras carrega os grupos uma vez por requisição, sem N+1.
**Constraints**:
- regras só no servidor, num ponto (`AccessPolicy`);
- permissão vale no próximo envio, sem novo login (FR-018);
- nenhum membro perde consulta nem lançamento na migração (SC-006);
- histórico imutável;
- contrato aditivo;
- WCAG 2.1 AA.

**Scale/Scope**:
- 1 endpoint novo e 6 alterados (income, expense, transfer, preview, reverse, transaction GET);
- respostas `GroupInfo`, `WalletInfo`, `TransactionInfo` e `NotificationInfo`;
- MCP: 1 ferramenta nova e 6 alteradas;
- telas: família, Depositar/Sacar/Transferir, detalhe do lançamento e notificações.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Situação |
|---|---|
| I. Skills de arquitetura | ✅ `dotnet-architecture`: modelo `GroupMemberPermissionChange`, repositório, DTOs, migration. `react-architecture`: tipos e service de grupo (`setMemberPermissions`) no contexto existente `GroupContext`. |
| II. Stack fixa | ✅ Sem dependências novas. Docker só via WSL. |
| III. Casing de diretórios | ✅ Arquivos novos nas pastas existentes. |
| IV. Convenções de código | ✅ DTOs com `[JsonPropertyName]` camelCase; `interface` no TS; arrow functions. |
| V. Banco | ✅ snake_case; PK `_pkey`; FKs nomeadas `fk_…` com `ON DELETE` explícito; índices `ix_…`; padrões no banco para a migração dos dados. |
| VI. Autenticação | ✅ Endpoint novo `[Authorize]`; a autorização fica no domínio (`EnsureResponsible`, `AccessPolicy`). |
| VII. Erros no backend | ✅ `ForbiddenException` → 403, `BusinessRuleException` → 422, `NotFoundException` → 404, validação → 400. |
| VIII. Agentes | ✅ `dotnet-senior-developer` (backend, migration, MCP); `ux-designer` (interruptores, estado somente leitura, confirmação do estorno, notificações) **antes** do `frontend-react-developer`. |
| IX. Acessibilidade | ✅ `role="switch"` com rótulo e ajuda; estado ocupado anunciado; estado vazio com texto; confirmação com o efeito em texto. |

**Resultado**: passa, sem violações. *Re-check pós-design*: passa. O desenho acrescenta colunas, uma
tabela de histórico e um endpoint, sem padrão novo.

## Project Structure

### Documentation (this feature)

```text
specs/008-reversal-family-permissions/
├── plan.md
├── research.md          # R-01..R-09
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   ├── mcp.md
│   └── ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
backend/
├── Finami.Domain/
│   ├── Enums/NotificationType.cs                  # + MemberPermissionsChanged, TransactionReversed
│   ├── Models/Group.cs                            # GroupMember (+2), CanCreateTransactions/CanReverse/SetMemberPermissions
│   ├── Models/GroupMemberPermissionChange.cs      # novo
│   ├── Models/Notification.cs                     # + PermissionChangeId, TransactionId
│   ├── Interfaces/IAccessPolicy.cs, IGroupService.cs
│   ├── Services/AccessPolicy.cs                   # CanCreateTransactions, CanViewTransaction, CanReverse
│   ├── Services/LedgerService.cs                  # novas verificações; notificação de estorno; canReverse no Info
│   ├── Services/GroupService.cs                   # SetMemberPermissionsAsync; permissões no GroupInfo
│   ├── Services/WalletService.cs                  # canCreateTransactions
│   ├── Services/NotificationService.cs            # mapeia os tipos novos
│   └── Validators/MemberPermissionsInfoValidator.cs
├── Finami.DTO/ Groups, Wallets, Transactions, Notifications   # campos novos
├── Finami.Infra.Interfaces/Repository/IGroupRepository.cs     # + histórico (ou repositório próprio)
├── Finami.Infra/
│   ├── Context/FinamiContext.cs
│   ├── Repository/GroupRepository.cs, NotificationRepository.cs
│   └── Migrations/*_AddMemberPermissions.cs
├── Finami.API/
│   ├── Controllers/GroupsController.cs            # PUT …/members/{userId}/permissions
│   └── Mcp/Tools/GroupWriteTools.cs, GroupReadTools.cs, TransactionTools.cs, Prompts
└── Finami.Tests/

frontend/src/
├── types/group.ts, wallet.ts, transaction.ts, notification.ts
├── Services/groupService.ts                       # setMemberPermissions
├── Contexts/GroupContext.tsx
├── components/group/MemberManager.tsx, MemberRow.tsx, MemberPermissions.tsx (novo)
├── components/statement/TransactionDetailSheet.tsx  # canReverse, efeito, ligação ao original
├── pages/TransactionPage.tsx, HomePage.tsx, WalletStatementPage.tsx, NotificationsPage.tsx
└── i18n/pt-BR.json
```

**Structure Decision**: aplicação web existente; só acrescenta arquivos nas camadas atuais.

## Riscos e decisões de implementação

- **Mudança de comportamento (Q2)**: membros que hoje estornam nas próprias carteiras de família
  deixam de poder. Isso foi aceito na spec. A resposta da API e o app explicam o motivo, e o
  responsável libera em um toque.
- **Membro removido com carteiras na família**: a carteira continua com `group_id` e ele não tem
  linha em `group_members`. Então `CanCreateTransactions` é falso e ele não lança nela. Hoje ele
  ainda controlaria a carteira, então isso também muda; é o comportamento esperado de "não é mais da
  família".
- **Visibilidade × estorno (R-05)**: com "Só o responsável", "Pode estornar" na prática vale só para
  as carteiras do membro. A ajuda do interruptor e o quickstart (passo 16) documentam isso.
- **N+1 nas listas**: `WalletService` e `ToInfoAsync` devem carregar os grupos envolvidos uma vez
  (cache por requisição no `AccessPolicy` ou carga em lote).
- **Concorrência**: uma permissão retirada durante um envio vale para o envio seguinte. Lançamentos
  já validados naquele instante são aceitos, o que é aceitável (FR-018 fala em "no momento do
  registro").

## Complexity Tracking

Sem violações; seção não aplicável.
