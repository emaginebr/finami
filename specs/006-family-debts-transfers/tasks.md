---

description: "Tarefas da feature 006 — dívidas entre pessoas e transferências dentro da família"
---

# Tasks: Dívidas entre pessoas e transferências dentro da família

**Input**: `specs/006-family-debts-transfers/` — plan.md, spec.md, research.md, data-model.md,
contracts/ (api.md, mcp.md, ui.md), quickstart.md

**Tests**: incluídos. O projeto mantém testes junto de cada mudança (xUnit no backend, Vitest +
Testing Library + vitest-axe no frontend), e o quickstart prevê validação automatizada.

**Organization**: por história de usuário. O agente responsável aparece ao fim de cada tarefa
(Princípio VIII).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: história da spec (US1…US5)
- Caminhos relativos à raiz do repositório (`backend/`, `frontend/src/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: direção visual das telas alteradas, antes de qualquer `.tsx` (Princípio VIII)

- [X] T001 Especificar layout e estados (carregando, vazio, erro, offline) da seção "Dívidas" da página da pessoa, das opções dos campos De/Para (ícone do tipo, primeiro nome, nome da carteira, saldo ou saldo oculto, cabeçalhos "Família"/"Converter", aviso sem destinos) e do alternador "Bitcoin | Reais" com a confirmação (valor em reais, BTC e cotação), seguindo `specs/006-family-debts-transfers/contracts/ui.md` e os tokens de `docs/design/tokens.css`; registrar em `docs/design/components.md` (nova seção "Feature 006") e mockup em `docs/design/mockups/family-debts-transfers.html` → ux-designer

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: base de backend compartilhada pelas histórias (DTOs, consulta de famílias, índices)

**⚠️ CRITICAL**: as histórias dependem desta fase

- [X] T002 Adicionar os índices `ix_transactions_source_account_id` e `ix_transactions_destination_account_id` na configuração da entidade `Transaction` em `backend/Finami.Infra/Context/FinamiContext.cs` e gerar a migration `AddTransactionAccountIndexes` com `dotnet ef migrations add` em `backend/Finami.Infra/Migrations/` (skill `dotnet-architecture`) → dotnet-senior-developer
- [X] T003 [P] Adicionar `OwnerFirstName` (`[JsonPropertyName("ownerFirstName")]`) a `WalletInfo` em `backend/Finami.DTO/Wallets/WalletDtos.cs` e preenchê-lo (primeiro nome do titular, `users.first_name`) no mapeamento de `backend/Finami.Domain/Services/WalletService.cs` (`ToInfoListAsync`/`GetAsync`); cobrir em `backend/Finami.Tests/Domain/` (teste do `WalletService` existente ou novo `WalletServiceTests.cs`) → dotnet-senior-developer
- [X] T004 [P] Criar helper de domínio "titulares são da mesma família" reutilizável: método `Task<bool> AreFamilyAsync(long ownerUserId, long otherUserId)` em `backend/Finami.Domain/Interfaces/IAccessPolicy.cs` + `backend/Finami.Domain/Services/AccessPolicy.cs` (verdadeiro se mesmo usuário ou `IGroupRepository.ShareGroupAsync`), com testes em `backend/Finami.Tests/Domain/AccessPolicyTests.cs` → dotnet-senior-developer
- [X] T005 [P] Adicionar `ownerFirstName: string` à interface `WalletInfo` em `frontend/src/types/wallet.ts` e ajustar fixtures de teste em `frontend/src/test/fixtures.ts` → frontend-react-developer

**Checkpoint**: migration gerada, `dotnet test` e `npm test` verdes

---

## Phase 3: User Story 1 — Saber quem deve a quem (Priority: P1) 🎯 MVP

**Goal**: dívidas líquidas por contraparte e moeda, calculadas do razão, na página da pessoa e no MCP

**Independent Test**: transferências nos dois sentidos entre duas pessoas da mesma família e um
estorno; conferir a dívida líquida na página de cada uma (quickstart passos 4–7, 15)

### Backend (US1)

- [X] T006 [P] [US1] Criar `PersonDebtInfo` (counterpartUserId, counterpartName, counterpartFirstName, currency, amount, direction) e `PersonDebtsResult` (userId, debts) com `[JsonPropertyName]` em `backend/Finami.DTO/Debts/DebtDtos.cs`, conforme `contracts/api.md` → dotnet-senior-developer
- [X] T007 [US1] Adicionar `GetPersonDebtsAsync(long userId)` em `backend/Finami.Infra.Interfaces/Repository/ITransactionRepository.cs` e implementar em `backend/Finami.Infra/Repository/TransactionRepository.cs`: uma consulta agrupada por contraparte e moeda sobre `transactions` ⨝ `accounts` (origem e destino) com origem e destino `Wallet`, mesma moeda, titulares diferentes e a pessoa em um dos lados, retornando `saldo = recebido − enviado` (regra em `data-model.md`) → dotnet-senior-developer
- [X] T008 [US1] Criar `DebtService` em `backend/Finami.Domain/Services/DebtService.cs` (interface em `backend/Finami.Domain/Interfaces/`): autoriza com `IAccessPolicy.CanViewUserAsync` (senão `NotFoundException`), descarta saldo zero, define `direction` (`owes`/`owed`), arredonda pela escala da moeda, ordena por nome (pt-BR) e BRL antes de BTC; registrar no DI em `backend/Finami.Application/` → dotnet-senior-developer
- [X] T009 [P] [US1] Testes do `DebtService` em `backend/Finami.Tests/Domain/DebtServiceTests.cs`: transferência gera dívida; sentido contrário compensa; troca de sentido; estorno desfaz; mesma pessoa não gera; responsável lançando pelo dependente usa titulares; BRL e BTC separados; pessoa sem permissão → 404 → dotnet-senior-developer
- [X] T010 [US1] Endpoint `GET /api/users/{userId}/debts` em `backend/Finami.API/Controllers/UsersController.cs` usando o `Execute` existente e `[Authorize]` → dotnet-senior-developer
- [X] T011 [P] [US1] Teste de integração do cálculo com PostgreSQL (transferências, estorno e conversão ignorada) em `backend/Finami.Tests/Integration/PersonDebtsQueryTests.cs` com `[IntegrationFact]` → dotnet-senior-developer
- [X] T012 [US1] Ferramenta MCP `dividas_da_pessoa` (somente leitura, `pessoa_id` opcional) em `backend/Finami.API/Mcp/Tools/DebtTools.cs`, conforme `contracts/mcp.md`; testes em `backend/Finami.Tests/API/McpReadToolsTests.cs` e atualizar a contagem/lista em `backend/Finami.Tests/API/McpToolsCatalogTests.cs` → dotnet-senior-developer

### Frontend (US1)

- [X] T013 [P] [US1] Tipos `PersonDebt`, `PersonDebtsResult` e enum `DebtDirection` em `frontend/src/types/debt.ts` → frontend-react-developer
- [X] T014 [US1] `getUserDebts(userId)` em `frontend/src/Services/balanceService.ts` e exposição no `frontend/src/Contexts/BalanceContext.tsx` / `frontend/src/hooks/useBalance.ts` (skill `react-architecture`, Fetch API, cache de sessão da feature 005 como nas demais leituras) → frontend-react-developer
- [X] T015 [US1] Componente `DebtList` em `frontend/src/components/debt/DebtList.tsx` conforme T001 e `contracts/ui.md` (frases "deve a você"/"Você deve a"/"X deve a Y", valor com `formatMoney`, sinal/texto além da cor, link para `/pessoas/:id` com `NavState`, estados vazio/carregando/erro) e chaves `debts.*` em `frontend/src/i18n/pt-BR.json` → frontend-react-developer
- [X] T016 [US1] Seção "Dívidas" em `frontend/src/pages/MemberPage.tsx` depois do total e antes das famílias, recarregando com `ledgerVersion` → frontend-react-developer
- [X] T017 [P] [US1] Testes em `frontend/src/components/debt/DebtList.test.tsx` e `frontend/src/pages/MemberPage.test.tsx`: frases para a própria pessoa e para outra, BRL e BTC, vazio, erro sem derrubar a página, axe → frontend-react-developer

**Checkpoint**: US1 funcional e demonstrável sozinha (dívidas aparecem para transferências já existentes)

---

## Phase 4: User Story 2 — Transferir só dentro da família, com destino claro (Priority: P1)

**Goal**: regra de família no servidor; campos De e Para novos; remoção do destino por código

**Independent Test**: quickstart passos 1–3 e 8

### Backend (US2)

- [X] T018 [US2] Regra de família em `PlanTransferAsync` de `backend/Finami.Domain/Services/LedgerService.cs`: titulares diferentes e `AreFamilyAsync` falso → `BusinessRuleException("Só é possível transferir para pessoas da sua família.")` (vale para transfer e preview) → dotnet-senior-developer
- [X] T019 [US2] Ajustar testes existentes que transferem entre pessoas sem família em comum em `backend/Finami.Tests/Domain/LedgerServiceTransferTests.cs`, `backend/Finami.Tests/Domain/LedgerTestContext.cs` (suporte a famílias em comum no mock de `IGroupRepository`/`IAccessPolicy`), `backend/Finami.Tests/API/McpTransactionToolsTests.cs` e `backend/Finami.Tests/Integration/ConcurrentTransferTests.cs`; adicionar casos: fora da família → 422 sem gravar; família em comum → ok; responsável lançando pelo dependente avalia o titular → dotnet-senior-developer
- [X] T020 [P] [US2] DTOs `TransferDestinationInfo` e `TransferDestinationsResult` (sourceWalletId, sameCurrency, conversion) em `backend/Finami.DTO/Wallets/WalletDtos.cs` → dotnet-senior-developer
- [X] T021 [US2] `ListTransferDestinationsAsync` em `backend/Finami.Infra.Interfaces/Repository/IAccountRepository.cs` + `backend/Finami.Infra/Repository/AccountRepository.cs` (carteiras ativas do titular e de quem divide família com ele, com nome do titular e saldo) e `GetTransferDestinationsAsync(userId, walletId)` em `backend/Finami.Domain/Services/WalletService.cs`: exige controle da origem, origem ativa, separa `sameCurrency` (sem a origem; próprias primeiro, depois primeiro nome e nome) e `conversion` (só do titular, outra moeda), `balance` nulo quando `CanViewWalletStatementAsync` é falso → dotnet-senior-developer
- [X] T022 [US2] Endpoint `GET /api/wallets/{id}/transfer-destinations` em `backend/Finami.API/Controllers/WalletsController.cs` → dotnet-senior-developer
- [X] T023 [P] [US2] Testes de destinos em `backend/Finami.Tests/Domain/WalletServiceTransferDestinationsTests.cs`: sem origem na lista, só mesma moeda em `sameCurrency`, pessoas de várias famílias sem repetir, inativas fora, fora da família fora, saldo oculto, sem controle → 403 → dotnet-senior-developer
- [X] T024 [US2] Ferramenta MCP `destinos_de_transferencia` em `backend/Finami.API/Mcp/Tools/WalletReadTools.cs` e novas descrições de `previa_transferencia`/`registrar_transferencia` em `backend/Finami.API/Mcp/Tools/TransactionTools.cs` (destino "da própria pessoa ou de alguém da família"); testes em `backend/Finami.Tests/API/McpWalletToolsTests.cs` e catálogo em `McpToolsCatalogTests.cs` → dotnet-senior-developer

### Frontend (US2)

- [X] T025 [P] [US2] Tipos `TransferDestination`/`TransferDestinationsResult` em `frontend/src/types/wallet.ts` e `getTransferDestinations(walletId)` em `frontend/src/Services/walletService.ts` + `frontend/src/Contexts/WalletContext.tsx` (cache de sessão para uso offline) → frontend-react-developer
- [X] T026 [US2] Componente `WalletOption` em `frontend/src/components/transaction/WalletOption.tsx` (ícone do tipo `aria-hidden`, primeiro nome, nome da carteira, saldo ou "—" + "saldo oculto"; nome acessível `transaction.walletOption`) conforme T001 → frontend-react-developer
- [X] T027 [US2] Campo De e campo Para em `frontend/src/components/transaction/FormStep.tsx` e `frontend/src/components/transaction/sheetModel.ts`: De com `WalletOption`; Para carregado de `getTransferDestinations` ao escolher o De, grupos "Família"/"Converter" com cabeçalho, aviso sem destinos e Continuar desabilitado, limpeza do destino ao trocar o De (FR-019) → frontend-react-developer
- [X] T028 [US2] Remover o modo "código da carteira" (`DestinationMode.Code`, lookup público e confirmação de titular) de `frontend/src/pages/TransactionPage.tsx`, `frontend/src/components/transaction/FormStep.tsx` e `frontend/src/components/transaction/sheetModel.ts`; remover chaves i18n sem uso e adicionar as novas `transaction.*` em `frontend/src/i18n/pt-BR.json` → frontend-react-developer
- [X] T029 [P] [US2] Atualizar `frontend/src/pages/TransactionPage.test.tsx`: opções do De com tipo/nome/saldo; Para sem a origem e só mesma moeda; grupo Converter; troca do De limpa destino; sem destinos; erro 422 "Só é possível transferir…" exibido; axe → frontend-react-developer

**Checkpoint**: US1 + US2 entregam o núcleo da feature (P1)

---

## Phase 5: User Story 3 — Converter real ↔ bitcoin só nas próprias carteiras (Priority: P2)

**Goal**: conversão recusada entre titulares diferentes em todos os canais

**Independent Test**: quickstart passos 9–10

- [X] T030 [US3] Regra em `PlanTransferAsync` de `backend/Finami.Domain/Services/LedgerService.cs`: moedas diferentes e titulares diferentes → `BusinessRuleException("Conversão entre real e bitcoin só entre carteiras da mesma pessoa.")`, verificada antes de buscar a cotação e antes da regra de família → dotnet-senior-developer
- [X] T031 [P] [US3] Testes em `backend/Finami.Tests/Domain/LedgerServiceTransferTests.cs`: compra/venda entre titulares diferentes → 422 sem consultar cotação nem gravar; entre carteiras do mesmo titular → registra com cotação e sem dívida; ajustar casos existentes de compra para outra pessoa → dotnet-senior-developer
- [X] T032 [P] [US3] Incluir a regra de conversão nas descrições de `previa_transferencia`/`registrar_transferencia` em `backend/Finami.API/Mcp/Tools/TransactionTools.cs` e no texto de `backend/Finami.API/Mcp/Prompts/FinamiPrompts.cs` (dívidas, só família, conversão só na mesma pessoa) → dotnet-senior-developer

**Checkpoint**: nenhuma conversão entre pessoas possível por API, app ou MCP

---

## Phase 6: User Story 4 — Transferir bitcoin informando o valor em reais (Priority: P2)

**Goal**: `amountBrl` em transferências BTC → BTC; no app, preview em reais e registro em BTC

**Independent Test**: quickstart passos 11–12 e 16

### Backend (US4)

- [X] T033 [US4] `TransferInfo.Amount` vira `decimal?` e novo `AmountBrl` (`[JsonPropertyName("amountBrl")]`) em `backend/Finami.DTO/Transactions/TransferDtos.cs`; regras em `backend/Finami.Domain/Validators/TransferInfoValidator.cs` (exatamente um dos dois, > 0, `amountBrl` com até 2 casas, mensagens de `contracts/api.md`) → dotnet-senior-developer
- [X] T034 [US4] Em `backend/Finami.Domain/Services/LedgerService.cs`: com `AmountBrl`, exigir origem e destino BTC (senão `ValidationException` "Valor em reais só vale para transferência entre carteiras de bitcoin."), obter a cotação, `amount = Money.Truncate(amountBrl / preço, BTC)`, zero → "Valor pequeno demais para conversão.", e gravar `BtcQuoteId`/`QuotePriceBrl` na transação; preview devolve `sourceAmount`/`destinationAmount` em BTC e `quote`; ajustar os usos de `info.Amount` (agora anulável) → dotnet-senior-developer
- [X] T035 [P] [US4] Testes em `backend/Finami.Tests/Domain/LedgerServiceTransferTests.cs` e validador: conversão correta e truncada; cotação gravada; BRL fora de BTC → 400; nenhum/ambos os valores → 400; valor pequeno → 422; cotação indisponível → 503 → dotnet-senior-developer
- [X] T036 [US4] Parâmetro `valor_em_reais` (e `valor` opcional) em `previa_transferencia`/`registrar_transferencia` de `backend/Finami.API/Mcp/Tools/TransactionTools.cs`; testes em `backend/Finami.Tests/API/McpTransactionToolsTests.cs` → dotnet-senior-developer

### Frontend (US4)

- [X] T037 [P] [US4] `amountBrl?: string` e `amount?: string` em `TransferInfo` de `frontend/src/types/transaction.ts` e envio em `frontend/src/Services/transactionService.ts` → frontend-react-developer
- [X] T038 [US4] Alternador "Bitcoin | Reais" (`aria-pressed`, visível só com De e Para em BTC) e campo em R$ em `frontend/src/components/transaction/FormStep.tsx`; no `frontend/src/pages/TransactionPage.tsx`, preview com `amountBrl` e registro com `amount = preview.sourceAmount`; cotação indisponível mostra a mensagem e "Informar em bitcoin"; trocar De/Para para algo que não seja BTC → BTC volta para bitcoin → frontend-react-developer
- [X] T039 [US4] Confirmação em `frontend/src/components/transaction/PreviewStep.tsx`: valor em reais informado, valor em BTC (8 casas no detalhe da confirmação), cotação e horário → frontend-react-developer
- [X] T040 [P] [US4] Testes em `frontend/src/pages/TransactionPage.test.tsx`: alternador só em BTC → BTC; preview com `amountBrl`; POST de registro com `amount` em BTC igual ao preview; 503 com volta para bitcoin; valor pequeno; axe → frontend-react-developer

**Checkpoint**: transferência de bitcoin em reais ponta a ponta

---

## Phase 7: User Story 5 — Botão de lançamento em todas as telas (Priority: P3)

**Goal**: Fab em todas as rotas do shell, exceto as de lançamento

**Independent Test**: quickstart passos 13–14

- [X] T041 [US5] Em `frontend/src/components/layout/AppShell.tsx`, trocar `FAB_ROUTES` por lista de exclusão (`/depositar`, `/sacar`, `/transferir`), mantendo a pré-seleção de `/carteiras/:walletId` e o padding inferior de `<main>` sempre que o Fab aparece → frontend-react-developer
- [X] T042 [P] [US5] Testes em `frontend/src/components/layout/AppShell.test.tsx` (novo): Fab visível em `/familias`, `/pessoas/:id`, `/conta`, `/notificacoes`; ausente em `/depositar`, `/sacar`, `/transferir`; `walletId` repassado no extrato → frontend-react-developer

**Checkpoint**: todas as histórias entregues

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T043 [P] Atualizar `backend/README.md` (endpoints novos, regras de família/conversão, `amountBrl`, ferramentas MCP novas) e `backend/Finami.API/Finami.API.http` (dívidas, destinos, transferência fora da família → 422, BTC em reais) → dotnet-senior-developer
- [X] T044 [P] Atualizar `frontend/README.md` (Para por família, dívidas na página da pessoa, Fab em todas as telas, transferência por código removida) → frontend-react-developer
- [X] T045 Revisão visual e de acessibilidade das telas implementadas contra T001 (contraste, alvos de 44 px, foco, leitores de tela) registrada em `docs/design/REVIEW-006.md` → ux-designer
- [X] T046 Rodar `dotnet test` em `backend/` e `npm run lint`, `npm test`, `npm run build`, `npm run check:pwa` em `frontend/`; corrigir falhas → dotnet-senior-developer / frontend-react-developer (cada um na sua área)
- [X] T047 Executar o roteiro de `specs/006-family-debts-transfers/quickstart.md` no ambiente de homolog (Docker via WSL) e registrar o resultado no próprio quickstart → dotnet-senior-developer (executado em 2026-11-03 via API de homolog: passos 1–12 e 16 ok; telas cobertas pelos testes de frontend)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sem dependências; bloqueia só as tarefas de frontend com interface nova (T015, T026, T027, T038, T039).
- **Foundational (T002–T005)**: bloqueia todas as histórias.
- **US1 (P1)** e **US2 (P1)**: independentes entre si após a Phase 2 (US1 não altera o `LedgerService`).
- **US3 (P2)**: depende de T018 (mesmo método `PlanTransferAsync`; a ordem das checagens importa).
- **US4 (P2)**: depende de US2 no frontend (T027, campo Para) e de T030 no backend (mesmo método).
- **US5 (P3)**: independente; pode ser feita a qualquer momento após a Phase 2.
- **Polish**: após as histórias desejadas.

### Within Each User Story

- DTOs → repositório → serviço → controller/MCP → testes do backend.
- Contrato da API pronto (contracts/api.md) → tipos/services do frontend → componentes → páginas → testes.
- Arquivos compartilhados em sequência: `LedgerService.cs` (T018 → T030 → T034),
  `TransactionTools.cs` (T024 → T032 → T036), `FormStep.tsx` (T027 → T028 → T038),
  `TransactionPage.test.tsx` (T029 → T040), `WalletDtos.cs` (T003 → T020).

### Parallel Opportunities

- Phase 2: T003, T004, T005 em paralelo (T002 também, arquivo próprio).
- US1: T006, T013 em paralelo; T009, T011, T017 em paralelo depois das implementações.
- US1 (backend, `dotnet-senior-developer`) e US5 (frontend, `frontend-react-developer`) podem correr ao mesmo tempo.
- US2: T020 e T025 em paralelo; T023 e T029 em paralelo.

## Parallel Example: User Story 1

```text
# Depois da Phase 2:
Task: "T006 DTOs de dívida em backend/Finami.DTO/Debts/DebtDtos.cs"       → dotnet-senior-developer
Task: "T013 Tipos de dívida em frontend/src/types/debt.ts"                → frontend-react-developer

# Depois de T007–T010 e T014–T016:
Task: "T009 DebtServiceTests"                                              → dotnet-senior-developer
Task: "T011 PersonDebtsQueryTests (integração)"                            → dotnet-senior-developer
Task: "T017 DebtList.test.tsx e MemberPage.test.tsx"                       → frontend-react-developer
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (T001) + Phase 2.
2. US1 completa → validar quickstart 4–7 e 15. As dívidas já aparecem, inclusive as históricas.
3. Deploy possível sem mudar nenhuma regra de transferência.

### Incremental Delivery

1. US1 → deploy (só leitura, sem risco para lançamentos).
2. US2 → deploy. **Mudança de comportamento**: transferências para fora da família passam a falhar.
3. US3 + US4 → deploy (regras de conversão e bitcoin em reais).
4. US5 → deploy (pode entrar junto de qualquer etapa).

### Commits

- Todo commit usa `fix(<escopo>): …` (CLAUDE.md), ex.: `fix(debts): dívidas entre pessoas na página da pessoa`.
