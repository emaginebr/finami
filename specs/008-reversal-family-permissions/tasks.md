---

description: "Tarefas da feature 008 — estorno e permissões dos membros na família"
---

# Tasks: Estorno e permissões dos membros na família

**Input**: `specs/008-reversal-family-permissions/` — plan.md, spec.md, research.md, data-model.md,
contracts/ (api.md, mcp.md, ui.md), quickstart.md

**Tests**: incluídos. O projeto mantém testes junto de cada mudança (xUnit no backend; Vitest +
Testing Library + vitest-axe no frontend), e o quickstart prevê validação automatizada.

**Organization**: por história de usuário. O agente responsável aparece ao fim de cada tarefa
(Princípio VIII).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: história da spec (US1…US5)
- Caminhos relativos à raiz do repositório (`backend/`, `frontend/src/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: direção visual das telas alteradas, antes de qualquer `.tsx` (Princípio VIII).

- [X] T001 Especificar, seguindo `specs/008-reversal-family-permissions/contracts/ui.md` e os tokens de `docs/design/tokens.css`:
  - os interruptores "Pode lançar" e "Pode estornar" por membro (`role="switch"`, ajuda, estado ocupado, erro com retorno ao estado anterior, desabilitado offline);
  - a linha do responsável ("Todas as permissões") e o resumo para membros ("Somente leitura", "Pode lançar · Pode estornar");
  - o estado vazio "Você só pode consultar a família {nome}." em Depositar, Sacar e Transferir;
  - a confirmação do estorno com o efeito (saldos e dívida) e as ligações "Estornado por #id" / "Estorno de #id";
  - os cartões das notificações `MemberPermissionsChanged` e `TransactionReversed`.

  Registrar em `docs/design/components.md` (nova seção "Feature 008") e no mockup `docs/design/mockups/family-permissions.html` → ux-designer

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: dados, modelo e regras centrais usados por todas as histórias.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase.

- [X] T002 Adicionar `MemberPermissionsChanged = 4` e `TransactionReversed = 5` em `backend/Finami.Domain/Enums/NotificationType.cs` → dotnet-senior-developer
- [X] T003 Em `backend/Finami.Domain/Models/Group.cs`, fazer as mudanças de data-model.md → dotnet-senior-developer
  - `GroupMember` ganha `CanCreateTransactions` (padrão `true`) e `CanReverse` (padrão `false`).
  - `Group` ganha:
    - `FindMember(userId)`;
    - `CanCreateTransactions(userId)` e `CanReverse(userId)`, sempre `true` para o responsável;
    - `SetMemberPermissions(actorId, memberId, canCreate, canReverse)`, que devolve um `GroupMemberPermissionChange?`.
  - Erros de `SetMemberPermissions`:
    - quem chama não é o responsável: `ForbiddenException`, via `EnsureResponsible`;
    - o alvo é o responsável: `BusinessRuleException` "As permissões do responsável não podem ser alteradas.";
    - o alvo não é membro: `NotFoundException` "Membro não encontrado.".
  - Sem mudança, devolve `null`.
- [X] T004 [P] Criar `backend/Finami.Domain/Models/GroupMemberPermissionChange.cs` com os campos da tabela `group_member_permission_changes` → dotnet-senior-developer
- [X] T005 [P] Adicionar `PermissionChangeId`, `TransactionId` e as navegações `PermissionChange`/`Transaction` em `backend/Finami.Domain/Models/Notification.cs` → dotnet-senior-developer
- [X] T006 Mapear tudo em `backend/Finami.Infra/Context/FinamiContext.cs` → dotnet-senior-developer
  - Colunas `can_create_transactions` (default `true`) e `can_reverse` (default `false`) em `group_members`.
  - Tabela `group_member_permission_changes`:
    - PK `group_member_permission_changes_pkey`;
    - FKs `fk_group_member_permission_changes_group` (CASCADE), `_member` e `_changed_by` (RESTRICT);
    - índice `ix_group_member_permission_changes_group_member`.
  - FKs `permission_change_id` e `transaction_id` em `notifications`, com SET NULL.
- [X] T007 Gerar a migration `AddMemberPermissions` em `backend/Finami.Infra/Migrations/` (via `dotnet ef migrations add`) e conferir que o `Up` aplica os padrões às linhas existentes de `group_members` e que o `Down` remove tudo → dotnet-senior-developer
- [X] T008 Expor a gravação do histórico no repositório de grupos → dotnet-senior-developer
  - Adicionar `InsertPermissionChangeAsync` em `backend/Finami.Infra.Interfaces/Repository/IGroupRepository.cs` e implementar em `backend/Finami.Infra/Repository/GroupRepository.cs`.
  - Garantir que `GetByIdAsync` traga as colunas novas de `Members` e que `UpdateAsync` as persista.
- [X] T009 Implementar em `backend/Finami.Domain/Services/AccessPolicy.cs` e em `backend/Finami.Domain/Interfaces/IAccessPolicy.cs` as regras de data-model.md, carregando cada grupo uma vez por requisição (cache em dicionário) → dotnet-senior-developer
  - `CanCreateTransactionsAsync` e `EnsureCanCreateTransactionsAsync`, com a mensagem "Você não tem permissão para criar lançamentos na família {nome}.".
  - `CanViewTransactionAsync`.
  - `CanReverseAsync` e `EnsureCanReverseAsync`, com a mensagem "Você não tem permissão para estornar lançamentos na família {nome}.".
- [X] T010 [P] Testes de `Group` (permissões do responsável e do membro, `SetMemberPermissions` com os 3 erros e o caso sem mudança) em `backend/Finami.Tests/Domain/GroupPermissionsTests.cs` → dotnet-senior-developer
- [X] T011 [P] Testes de `AccessPolicy` em `backend/Finami.Tests/Domain/AccessPolicyPermissionsTests.cs`. Casos: → dotnet-senior-developer
  - carteira sem família;
  - responsável;
  - membro com e sem cada permissão;
  - membro removido;
  - estorno com uma das carteiras na família;
  - visibilidade `AllMembers` × `ResponsibleOnly` (R-05).
- [X] T012 Rodar a migration num banco temporário do container de homolog (`finami-homolog-db`, via WSL) e conferir que os membros atuais ficam com `true`/`false`, em `backend/Finami.Tests/Integration/MemberPermissionsMigrationTests.cs` → dotnet-senior-developer

**Checkpoint**: modelo, migration e política prontos; `dotnet test` verde.

---

## Phase 3: User Story 1 - Estornar qualquer tipo de lançamento, mantendo o histórico (Priority: P1) 🎯 MVP

**Goal**: estorno de todos os tipos, com `canReverse` calculado no servidor, confirmação com o
efeito e ligação nos dois sentidos.

**Independent Test**: estornar um lançamento de cada tipo (receita, despesa, transferência da mesma
pessoa, empréstimo, quitação, pagamento, compra e venda de BTC) como responsável. Saldos e dívidas
devem voltar exatamente, e o extrato deve mostrar original e estorno ligados.

### Tests for User Story 1

- [X] T013 [P] [US1] Testes em `backend/Finami.Tests/Domain/LedgerServiceReversalAllTypesTests.cs` → dotnet-senior-developer
  - Estorno de cada `TransactionType`, inclusive cada `TransferKind`, com valores invertidos e sem nova cotação.
  - Recusa de estornar um estorno e de estornar duas vezes.
  - `TransactionInfo.CanReverse`:
    - verdadeiro para o responsável;
    - falso se já foi estornado;
    - falso se é um estorno.
- [X] T014 [P] [US1] Testes em `frontend/src/components/statement/TransactionDetailSheet.test.tsx` → frontend-react-developer
  - "Estornar" guiado por `transaction.canReverse`.
  - Confirmação com o efeito: despesa, conversão e empréstimo/quitação com dívida.
  - Link "Estorno de #id" para o original.
  - Sem violações do axe.

### Implementation for User Story 1

- [X] T015 [US1] Adicionar `canReverse` (`[JsonPropertyName("canReverse")]`) em `TransactionInfo` de `backend/Finami.DTO/Transactions/TransactionDtos.cs` → dotnet-senior-developer
- [X] T016 [US1] Em `backend/Finami.Domain/Services/LedgerService.cs`, fazer `ToInfoAsync` receber o `viewerUserId` e calcular `CanReverse` com `AccessPolicy.CanReverseAsync`. Atualizar os chamadores no próprio serviço (Income, Expense, Transfer, Reverse, Get) e a interface `ILedgerService` → dotnet-senior-developer
- [X] T017 [US1] Em `LedgerService.EnsureCanViewAsync` (`backend/Finami.Domain/Services/LedgerService.cs`), usar `AccessPolicy.CanViewTransactionAsync` (R-05), mantendo a mensagem "Você não tem permissão sobre esta transação." → dotnet-senior-developer
- [X] T018 [P] [US1] Adicionar `canReverse: boolean` em `TransactionInfo` de `frontend/src/types/transaction.ts` → frontend-react-developer
- [X] T019 [US1] Atualizar `frontend/src/components/statement/TransactionDetailSheet.tsx` → frontend-react-developer
  - Usar `transaction.canReverse`; remover a dependência de `canControl` para o estorno e manter a prop só se outra coisa a usar.
  - Montar a mensagem do `ConfirmModal` com o efeito, a partir de `sourceAmount`/`destinationAmount`, dos nomes das carteiras e de `debtAmount`/`debtCurrency`.
  - Mostrar "Estorno de #{{id}}", que abre o original.
- [X] T020 [P] [US1] Adicionar ao `frontend/src/i18n/pt-BR.json` as chaves `statement.reverseEffect.*` e `statement.reversalOf` (contracts/ui.md) → frontend-react-developer

**Checkpoint**: estorno completo e testável sozinho; o responsável estorna tudo.

---

## Phase 4: User Story 2 - Responsável define quem pode lançar na família (Priority: P1)

**Goal**: com "Pode lançar" desligada, o membro não lança nas carteiras da família por nenhum
caminho. O responsável liga e desliga a permissão na página da família.

**Independent Test**: desligar "Pode lançar" de um membro. Lançar como ele pelo app, pela API e pelo
MCP deve ser recusado, e a consulta deve continuar igual. Ao religar, o lançamento funciona.

### Tests for User Story 2

- [X] T021 [P] [US2] Testes em `backend/Finami.Tests/Domain/LedgerServiceCreatePermissionTests.cs`. Cenário: membro sem "Pode lançar". → dotnet-senior-developer
  - `IncomeAsync`, `ExpenseAsync`, `TransferAsync` e `PreviewTransferAsync` dão 403 com a mensagem da família.
  - Transferência **para** a carteira dele funciona.
  - A carteira pessoal dele funciona.
  - O responsável lança na carteira do membro.
- [X] T022 [P] [US2] Testes de `GroupService.SetMemberPermissionsAsync` em `backend/Finami.Tests/Domain/GroupServicePermissionsTests.cs` → dotnet-senior-developer
  - Grava o histórico.
  - Notifica o membro (`MemberPermissionsChanged` com `PermissionChangeId`).
  - Sem mudança, não gera histórico nem notificação.
  - Erros 403, 404 e 422.
  - `GroupInfo` traz as permissões dos membros e `myPermissions`.
- [X] T023 [P] [US2] Testes de `frontend/src/components/group/MemberPermissions.test.tsx` (novo) → frontend-react-developer
  - Os interruptores enviam o PUT com os dois valores.
  - Estado ocupado; erro com retorno ao estado anterior; desabilitados offline.
  - A linha do responsável não tem interruptores.
  - Sem violações do axe.
- [X] T024 [P] [US2] Testes em `frontend/src/pages/TransactionPage.test.tsx` → frontend-react-developer
  - Carteiras sem `canCreateTransactions` não aparecem na origem.
  - Estado vazio "Você só pode consultar a família Silva.".
  - 403 no envio mostra um toast e recarrega as carteiras.

### Implementation for User Story 2

- [X] T025 [US2] Em `backend/Finami.Domain/Services/LedgerService.cs`, trocar `EnsureCanControlWalletAsync` por `EnsureCanCreateTransactionsAsync` em `IncomeAsync`, `ExpenseAsync` e na origem de `PlanTransferAsync` (R-03) → dotnet-senior-developer
- [X] T026 [P] [US2] DTOs → dotnet-senior-developer
  - Em `backend/Finami.DTO/Groups/GroupDtos.cs`:
    - `GroupMemberInfo` ganha `canCreateTransactions` e `canReverse`;
    - `GroupInfo` ganha `myPermissions` (classe `MemberPermissionsResult`);
    - classe nova `MemberPermissionsInfo` (corpo do PUT).
  - Em `backend/Finami.DTO/Wallets/WalletDtos.cs`: `WalletInfo` ganha `canCreateTransactions`.
- [X] T027 [P] [US2] Criar `backend/Finami.Domain/Validators/MemberPermissionsInfoValidator.cs` (os dois campos obrigatórios: "Informe as duas permissões.") e registrar no DI → dotnet-senior-developer
- [X] T028 [US2] Em `backend/Finami.Domain/Services/GroupService.cs` e em `IGroupService` → dotnet-senior-developer
  - `SetMemberPermissionsAsync(userId, groupId, memberUserId, info)`:
    - valida;
    - chama `group.SetMemberPermissions`;
    - persiste;
    - grava o histórico;
    - insere a notificação, tudo numa transação;
    - devolve `GroupInfo`.
  - `ToInfoAsync` preenche as permissões e `myPermissions`.
- [X] T029 [US2] Em `backend/Finami.Domain/Services/WalletService.cs`, preencher `CanCreateTransactions` com `AccessPolicy.CanCreateTransactionsAsync` em todas as projeções de `WalletInfo` → dotnet-senior-developer
- [X] T030 [US2] Adicionar `[HttpPut("{groupId:long}/members/{userId:long}/permissions")]` em `backend/Finami.API/Controllers/GroupsController.cs` (mesmo padrão `Execute` dos outros endpoints) e um exemplo em `backend/Finami.API/Finami.API.http` → dotnet-senior-developer
- [X] T031 [P] [US2] Atualizar os tipos do frontend → frontend-react-developer
  - Em `frontend/src/types/group.ts`: `GroupMemberInfo` ganha `canCreateTransactions` e `canReverse`; `GroupInfo` ganha `myPermissions`; tipo novo `MemberPermissionsInfo`.
  - Em `frontend/src/types/wallet.ts`: `WalletInfo` ganha `canCreateTransactions`.
- [X] T032 [US2] Adicionar `setMemberPermissions(groupId, userId, info)` em `frontend/src/Services/groupService.ts` e expor em `frontend/src/Contexts/GroupContext.tsx`, atualizando o grupo em memória → frontend-react-developer
- [X] T033 [US2] Criar `frontend/src/components/group/MemberPermissions.tsx` (interruptores do responsável, conforme T001) e usar em `frontend/src/components/group/MemberRow.tsx`/`MemberManager.tsx` só quando `group.isResponsible` e o membro não é o responsável → frontend-react-developer
- [X] T034 [US2] Telas de lançar → frontend-react-developer
  - Em `frontend/src/pages/TransactionPage.tsx`:
    - filtrar as carteiras de origem por `canCreateTransactions`;
    - mostrar o estado vazio com o nome da família (`transaction.readOnlyFamily` ou `transaction.noWritableWallet`);
    - em 403 de permissão, mostrar um toast e recarregar as carteiras.
  - Em `frontend/src/pages/HomePage.tsx` e `frontend/src/pages/WalletStatementPage.tsx`: esconder os atalhos Depositar, Sacar e Transferir das carteiras sem `canCreateTransactions`.
- [X] T035 [P] [US2] Adicionar ao `frontend/src/i18n/pt-BR.json` as chaves `group.permissions.*`, `transaction.readOnlyFamily` e `transaction.noWritableWallet` → frontend-react-developer

**Checkpoint**: o responsável controla quem lança; US1 e US2 funcionam juntas.

---

## Phase 5: User Story 3 - Responsável define quem pode estornar (Priority: P2)

**Goal**: o estorno passa a exigir "Pode estornar" (ou ser o responsável, ou ser o titular de uma
carteira pessoal). Quem tem a permissão estorna lançamentos de outros membros que pode ver, e o
titular é notificado.

**Independent Test**: com "Pode estornar" desligada, o membro não estorna por nenhum caminho. Ligada
e com a visibilidade "Todos os membros", ele estorna o lançamento de outro membro, e esse membro é
notificado.

### Tests for User Story 3

- [X] T036 [P] [US3] Testes em `backend/Finami.Tests/Domain/LedgerServiceReversePermissionTests.cs` → dotnet-senior-developer
  - Recusas e aceites:
    - membro sem permissão é recusado (403, mensagem da família);
    - membro com permissão estorna o lançamento de outro membro (com `AllMembers`);
    - com `ResponsibleOnly`, recusado no lançamento de outro membro;
    - carteira pessoal do titular é aceita.
  - Transferência entre famílias: basta a permissão em uma.
  - Notificação `TransactionReversed` aos titulares diferentes do autor, com `TransactionId` do estorno.

### Implementation for User Story 3

- [X] T037 [US3] Em `LedgerService.ReverseAsync` (`backend/Finami.Domain/Services/LedgerService.cs`) → dotnet-senior-developer
  - Trocar `EnsureCanControlWalletAsync(accountToControl)` por `EnsureCanReverseAsync(userId, original, accounts)`.
  - Depois do registro, inserir `Notification { Type = TransactionReversed, TransactionId = estorno, ActorUserId, GroupId }` para cada titular de carteira do original ≠ `userId`, na mesma transação (injetar `INotificationRepository<Notification>`).
- [X] T038 [US3] Em `backend/Finami.Tests/Domain/LedgerTestContext.cs` e nos testes existentes de `LedgerService*Tests.cs`, ajustar o mock de `IAccessPolicy` para `CanReverseAsync`/`EnsureCanReverseAsync`, sem mudar o comportamento esperado do responsável → dotnet-senior-developer

**Checkpoint**: permissões de estorno valem em app, API e MCP.

---

## Phase 6: User Story 4 - Só o responsável adiciona membros (Priority: P2)

**Goal**: as regras de membros e permissões ficam explícitas para todos os caminhos, inclusive o
MCP. Membros não veem controles de gestão.

**Independent Test**: como membro, tentar adicionar, convidar, remover ou mudar permissões pelo app,
pela API e pelo MCP; tudo deve ser recusado. Como responsável, mudar permissões pelo MCP.

### Tests for User Story 4

- [X] T039 [P] [US4] Testes em `backend/Finami.Tests/Domain/GroupServiceResponsibleOnlyTests.cs`: membro recebe 403 em `AddMemberAsync`, `CreateMemberAsync`, `RemoveMemberAsync`, `InviteAsync` e `SetMemberPermissionsAsync` → dotnet-senior-developer
- [X] T040 [P] [US4] Testes MCP em `backend/Finami.Tests/API/McpGroupToolsTests.cs` e `McpToolsCatalogTests.cs` → dotnet-senior-developer
  - O catálogo tem 41 ferramentas.
  - `alterar_permissoes_membro`: ok para o responsável; recusada para membro.
  - `obter_familia` traz `pode_lancar`, `pode_estornar` e `minhas_permissoes`.
- [X] T041 [P] [US4] Teste em `frontend/src/components/group/MemberManager.test.tsx`: o membro não vê adicionar, convidar, remover nem os interruptores → frontend-react-developer

### Implementation for User Story 4

- [X] T042 [US4] Criar a ferramenta `alterar_permissoes_membro` em `backend/Finami.API/Mcp/Tools/GroupWriteTools.cs` (contracts/mcp.md) → dotnet-senior-developer
- [X] T043 [US4] Atualizar as descrições e saídas MCP → dotnet-senior-developer
  - Incluir as permissões na saída de `obter_familia` em `backend/Finami.API/Mcp/Tools/GroupReadTools.cs`.
  - Ajustar as descrições de `registrar_receita`, `registrar_despesa`, `registrar_transferencia`, `previa_transferencia` e `estornar_lancamento` em `backend/Finami.API/Mcp/Tools/TransactionTools.cs`.
  - Ajustar a orientação em `backend/Finami.API/Mcp/Prompts/FinamiPrompts.cs`.
- [X] T044 [US4] Atualizar o teste do catálogo (40 → 41) em `backend/Finami.Tests/API/McpToolsCatalogTests.cs` e a lista de ferramentas no `README.md` → dotnet-senior-developer

**Checkpoint**: gestão de membros e permissões só pelo responsável, em todos os caminhos.

---

## Phase 7: User Story 5 - Membro sabe o que pode fazer (Priority: P3)

**Goal**: resumo das permissões na página da família e notificações das mudanças e dos estornos.

**Independent Test**: mudar a permissão de um membro. Ele deve ver a notificação e o resumo novo; um
estorno feito por outra pessoa deve gerar a notificação para o titular.

### Tests for User Story 5

- [X] T045 [P] [US5] Testes de `NotificationService` em `backend/Finami.Tests/Domain/NotificationServicePermissionsTests.cs` → dotnet-senior-developer
  - Mapeamento de `MemberPermissionsChanged`: `permissions` vem do histórico, não do estado atual.
  - Mapeamento de `TransactionReversed`: `transactionId`, `walletId` e `walletName`.
- [X] T046 [P] [US5] Testes em `frontend/src/pages/NotificationsPage.test.tsx` → frontend-react-developer
  - Textos das duas notificações novas.
  - O toque em `TransactionReversed` abre a carteira.
- [X] T047 [P] [US5] Teste em `frontend/src/components/group/MemberManager.test.tsx`: resumo "Somente leitura" / "Pode lançar · Pode estornar" para membros; "Todas as permissões" no responsável → frontend-react-developer

### Implementation for User Story 5

- [X] T048 [US5] Notificações no backend → dotnet-senior-developer
  - Em `backend/Finami.DTO/Notifications/NotificationDtos.cs`: `NotificationInfo` ganha `permissions`, `transactionId`, `walletId` e `walletName`.
  - Em `backend/Finami.Domain/Services/NotificationService.cs` e no `NotificationRepository` (`backend/Finami.Infra/Repository/`): incluir `PermissionChange` e `Transaction` (com as contas) na leitura e mapear.
- [X] T049 [P] [US5] Adicionar os tipos novos e os campos em `frontend/src/types/notification.ts` → frontend-react-developer
- [X] T050 [US5] Renderizar `MemberPermissionsChanged` e `TransactionReversed` em `frontend/src/pages/NotificationsPage.tsx` (e no componente de item de notificação, se houver), com as chaves `notifications.memberPermissionsChanged`/`transactionReversed` em `frontend/src/i18n/pt-BR.json` → frontend-react-developer
- [X] T051 [US5] Mostrar o resumo das permissões (`group.permissions.readOnly`/`all` e a combinação) em `frontend/src/components/group/MemberRow.tsx` para quem não é o responsável → frontend-react-developer

**Checkpoint**: todas as histórias funcionam juntas.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T052 Revisar as telas implementadas contra `docs/design/components.md` §Feature 008 e WCAG 2.1 AA, registrando os achados em `docs/design/REVIEW-008.md` → ux-designer
- [X] T053 Corrigir os achados da revisão (T052) nos componentes do frontend → frontend-react-developer
- [X] T054 [P] Documentar o endpoint novo, as permissões e as mensagens em `README.md` e `backend/Finami.API/Finami.API.http` → dotnet-senior-developer
- [X] T055 Rodar `dotnet test` em `backend/` e `npm run lint`, `npm test` e `npm run build` em `frontend/`; tudo verde
- [X] T056 Validar o roteiro de `specs/008-reversal-family-permissions/quickstart.md` em homolog (Docker via WSL, `docker compose up --build -d`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sem dependências. Bloqueia as tarefas `.tsx` (T019, T033, T034, T050, T051).
- **Foundational (T002–T012)**: bloqueia todas as histórias.
  - Ordem: T002/T004/T005 → T003 → T006 → T007 → T008 → T009 → T010–T012.
- **US1 (Phase 3)**: depende só de Foundational. É o MVP.
- **US2 (Phase 4)**: depende de Foundational. T016 (`ToInfoAsync` com o viewer) facilita, mas não bloqueia.
- **US3 (Phase 5)**: depende de US1 (`canReverse` e o estorno no app).
- **US4 (Phase 6)**: depende de US2 (endpoint e serviço de permissões).
- **US5 (Phase 7)**: depende de US2 (notificação de permissão) e de US3 (notificação de estorno).
- **Polish**: depois das histórias desejadas.

### Within Each User Story

- Testes primeiro (devem falhar), depois DTOs e modelos, depois serviços, endpoints e UI.
- Backend antes do frontend da mesma história (contrato estável).

### Parallel Opportunities

- **Foundational**: T004 e T005 em paralelo; T010 e T011 em paralelo.
- **US1**: T013, T014, T018 e T020 em paralelo.
- **US2**: T021–T024 em paralelo; T026, T027, T031 e T035 em paralelo.
- **Entre histórias**: depois de Foundational, US1 (backend) e US2 (backend) podem andar com agentes separados; o frontend de cada uma, em seguida.

---

## Parallel Example: User Story 2

```text
# Testes juntos:
T021 LedgerServiceCreatePermissionTests.cs   (dotnet-senior-developer)
T022 GroupServicePermissionsTests.cs          (dotnet-senior-developer)
T023 MemberPermissions.test.tsx               (frontend-react-developer)
T024 TransactionPage.test.tsx                 (frontend-react-developer)

# DTOs, validador e tipos juntos:
T026 GroupDtos.cs / WalletDtos.cs
T027 MemberPermissionsInfoValidator.cs
T031 types/group.ts, types/wallet.ts
T035 pt-BR.json
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Setup (T001) e Foundational (T002–T012).
2. US1: estorno completo com `canReverse` e confirmação com o efeito.
3. Validar os passos 6, 14 e 15 do quickstart.

### Incremental Delivery

1. Com **US2** vem a permissão de lançar, com interruptores (quickstart 1, 2, 8–11). Entregável.
2. Com **US3** vem a permissão de estornar (3–7, 16).
3. Com **US4** vêm a gestão só pelo responsável e o MCP (12, 13, 17).
4. Com **US5** vêm as notificações e o resumo.

### Notas

- Commits com `fix:` (escopo opcional), só quando o usuário pedir.
- A migration roda no startup em produção (`MigrateOnStartup`); antes do deploy, validar o `Up` num
  banco com dados reais copiados para homolog.
