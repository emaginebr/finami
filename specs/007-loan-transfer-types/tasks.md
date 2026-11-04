---

description: "Tarefas da feature 007 — tipos de transferência: empréstimo, quitação e pagamento"
---

# Tasks: Tipos de transferência — empréstimo, quitação e pagamento

**Input**: `specs/007-loan-transfer-types/` — plan.md, spec.md, research.md, data-model.md, contracts/
(api.md, mcp.md, ui.md), quickstart.md

**Tests**: incluídos. O projeto mantém testes junto de cada mudança (xUnit no backend; Vitest +
Testing Library + vitest-axe no frontend), e o quickstart prevê validação automatizada.

**Organization**: por história de usuário. O agente responsável aparece ao fim de cada tarefa
(Princípio VIII).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: história da spec (US1…US4)
- Caminhos relativos à raiz do repositório (`backend/`, `frontend/src/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: direção visual das telas alteradas, antes de qualquer `.tsx` (Princípio VIII).

- [X] T001 Especificar, seguindo `specs/007-loan-transfer-types/contracts/ui.md` e os tokens de `docs/design/tokens.css`:
  - o seletor "Tipo": `radiogroup` segmentado com 3 opções, ajuda por tipo e estado de erro;
  - o painel de quitação: dívida atual, skeleton, grupo "Quitar dívida em", ação "Quitar tudo", modo "Valor calculado na confirmação", aviso sem dívida e `aria-disabled` do Continuar;
  - o bloco "Efeito na dívida" e a linha "Tipo" da confirmação;
  - os rótulos de tipo no extrato e a linha "Tipo" no detalhe.

  Registrar em `docs/design/components.md` (nova seção "Feature 007") e no mockup `docs/design/mockups/loan-transfer-types.html` → ux-designer

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: modelo, colunas, migração com backfill, novo cálculo de dívida e contratos (DTOs/tipos), compartilhados por todas as histórias.

**⚠️ CRITICAL**: as histórias dependem desta fase.

- [X] T002 Criar o enum `TransferKind { Loan = 1, Settlement = 2, Payment = 3 }` em `backend/Finami.Domain/Enums/TransferKind.cs`, com extensão de código `loan`/`settlement`/`payment` (parse e `ToCode`) no mesmo arquivo. Adicionar `TransferKind?`, `DebtCurrency` (`Currency?`) e `DebtAmount` (`decimal?`) a `backend/Finami.Domain/Models/Transaction.cs` → dotnet-senior-developer
- [X] T003 Mapear as colunas `transfer_kind` (smallint), `debt_currency` (smallint) e `debt_amount` (numeric(20,8)), mais a check constraint `ck_transactions_debt_effect`, em `ConfigureTransactions` de `backend/Finami.Infra/Context/FinamiContext.cs`. Gerar a migration `AddTransferKindAndDebt` com `dotnet ef migrations add` em `backend/Finami.Infra/Migrations/` e acrescentar ao `Up` o `UPDATE` de backfill de `data-model.md` (carteira→carteira, mesma moeda, titulares diferentes → Loan, `debt_currency = source.currency`, `debt_amount = source_amount`). Skill `dotnet-architecture` → dotnet-senior-developer
- [X] T004 Reescrever `GetPersonDebtsAsync` em `backend/Finami.Infra/Repository/TransactionRepository.cs`:
  - somar só transações com `DebtAmount != null`, agrupando por `DebtCurrency` e contraparte (sinal: destino deve à origem);
  - acrescentar `GetPairDebtAsync(long debtorUserId, long creditorUserId, Currency currency)`, que devolve o saldo "devedor deve a credor";
  - declarar o método novo em `backend/Finami.Infra.Interfaces/Repository/ITransactionRepository.cs`.

  → dotnet-senior-developer
- [X] T005 [P] Adicionar `LockDebtPairAsync(long userA, long userB)` com `pg_advisory_xact_lock` e chave `(min << 32) | max` (R-03) em `backend/Finami.Infra/Repository/UnitOfWork.cs` e na interface `IUnitOfWork` em `backend/Finami.Infra.Interfaces/Repository/` → dotnet-senior-developer
- [X] T006 [P] Estender os DTOs:
  - `TransferInfo` (+`Kind`, `DebtCurrency`, `SettleAll`), `TransferPreviewResult` (+`Kind`, `Debt`) e a classe nova `TransferDebtEffect` (`currency`, `amount`, `before`, `after`, `debtorUserId`, `creditorUserId`) em `backend/Finami.DTO/Transactions/TransferDtos.cs`;
  - `TransactionInfo` (+`TransferKind`, `DebtCurrency`, `DebtAmount`) em `backend/Finami.DTO/Transactions/TransactionDtos.cs`;
  - `StatementEntryInfo` (+ os mesmos três) em `backend/Finami.DTO/Statements/StatementDtos.cs`.

  Todos com `[JsonPropertyName]` camelCase → dotnet-senior-developer
- [X] T007 Preencher `transferKind`, `debtCurrency` e `debtAmount`:
  - em `ToInfoAsync` de `backend/Finami.Domain/Services/LedgerService.cs`;
  - na projeção do extrato (`backend/Finami.Domain/Services/StatementService.cs` e a consulta correspondente em `backend/Finami.Infra/Repository/LedgerRepository.cs`).

  → dotnet-senior-developer
- [X] T008 Fazer `ReverseAsync` em `backend/Finami.Domain/Services/LedgerService.cs` copiar `TransferKind`, `DebtCurrency` e `DebtAmount` do original para o estorno (via `PostingRequest`, ganhando os 3 campos). Trocar `Transaction.IsConversion` em `backend/Finami.Domain/Models/Transaction.cs` para não tratar como conversão o estorno de uma transferência com cotação sem câmbio (comparar as moedas das contas, ou o tipo do original) → dotnet-senior-developer
- [X] T009 [P] Teste de integração em `backend/Finami.Tests/Integration/TransferKindBackfillTests.cs`:
  - semear transferências e estornos entre pessoas, conversões e transferências do mesmo titular no esquema anterior;
  - aplicar a migration e conferir que `GetPersonDebtsAsync` devolve os mesmos saldos do cálculo antigo (SC-002).

  Ajustar `backend/Finami.Tests/Integration/PersonDebtsQueryTests.cs` à nova regra → dotnet-senior-developer
- [X] T010 [P] Tipos no frontend:
  - `TransferKind` (`"loan" | "settlement" | "payment"`), `TransferDebtEffect`, `kind`/`debtCurrency`/`settleAll` em `TransferInfo` e `kind`/`debt` em `TransferPreviewResult`, em `frontend/src/types/transaction.ts`;
  - `transferKind`/`debtCurrency`/`debtAmount` em `TransactionInfo` (no mesmo arquivo) e em `frontend/src/types/statement.ts`.

  → frontend-react-developer

**Checkpoint**: o backend compila; dívidas e extrato têm o mesmo resultado de antes; todos os testes existentes passam.

---

## Phase 3: User Story 1 - Escolher o tipo ao transferir para outra pessoa (Priority: P1) 🎯 MVP

**Goal**: transferência entre pessoas com tipo obrigatório no app. Empréstimo cria dívida, Pagamento não. O tipo aparece no extrato e no detalhe.

**Independent Test**: Ana → Bruno uma vez como Empréstimo e outra como Pagamento; só o empréstimo aparece nas dívidas, e o extrato mostra os dois tipos.

### Tests for User Story 1

- [X] T011 [P] [US1] Testes em `backend/Finami.Tests/Domain/LedgerServiceTransferKindTests.cs`:
  - titulares diferentes sem `kind` → Loan com efeito (moeda, valor);
  - `payment` sem efeito;
  - mesmo titular com `kind`/`debtCurrency`/`settleAll` → 400 "O tipo só vale para transferência entre pessoas diferentes.";
  - conversão própria sem efeito;
  - estorno de empréstimo grava efeito invertido;
  - prévia devolve `kind` e `debt` (`before`/`after`).

  → dotnet-senior-developer
- [X] T012 [P] [US1] Testes em `backend/Finami.Tests/Domain/TransferInfoValidatorTests.cs`:
  - `kind` inválido → "Tipo de transferência inválido.";
  - `debtCurrency`/`settleAll` sem `settlement` → "Moeda da dívida e quitar tudo só valem para quitação.";
  - combinações de `amount`/`amountBrl`/`settleAll` → "Informe o valor em bitcoin ou em reais, ou quite tudo.".

  → dotnet-senior-developer
- [X] T013 [P] [US1] Testes em `frontend/src/pages/TransactionPage.test.tsx`:
  - seletor "Tipo" ausente com destino próprio e presente com destino de outra pessoa (`radiogroup`, sem seleção, axe);
  - Continuar sem tipo mostra "Escolha o tipo da transferência." e foca o grupo;
  - trocar o Para limpa o tipo;
  - prévia e registro enviam `kind`;
  - prévia mostra "Tipo" e "Bruno vai dever R$ 100,00 a Ana";
  - botão "Registrar empréstimo"/"Registrar pagamento";
  - toasts por tipo.

  → frontend-react-developer
- [X] T014 [P] [US1] Testes dos rótulos de tipo no extrato e da linha "Tipo" no detalhe em `frontend/src/components/statement/StatementEntryRow.test.tsx` (ou no teste da página de extrato existente) → frontend-react-developer

### Implementation for User Story 1

- [X] T015 [US1] Validação de `Kind`, `DebtCurrency`, `SettleAll` e da combinação de valores em `backend/Finami.Domain/Validators/TransferInfoValidator.cs`, com as mensagens de `contracts/api.md`. Adaptar a checagem antecipada de valor em `PlanTransferAsync` (que hoje exige `amount` xor `amountBrl`) → dotnet-senior-developer
- [X] T016 [US1] Em `PlanTransferAsync` de `backend/Finami.Domain/Services/LedgerService.cs`:
  - recusar campos de tipo entre carteiras do mesmo titular;
  - entre titulares diferentes, resolver `kind` (padrão Loan);
  - incluir no `TransferPlan` o efeito na dívida (Loan: moeda e valor enviado; Payment: nenhum);
  - `TransferAsync` grava o efeito;
  - `PostAsync` toma `LockDebtPairAsync` quando há efeito;
  - `PreviewTransferAsync` devolve `kind` e `debt` (`before`/`after` via `GetPairDebtAsync`).

  → dotnet-senior-developer
- [X] T017 [P] [US1] Criar `frontend/src/components/transaction/TransferKindPicker.tsx`: `radiogroup` com rótulo "Tipo", 3 opções, setas, ajuda ligada por `aria-describedby`, erro e `data-autofocus`, conforme T001 e `contracts/ui.md` → frontend-react-developer
- [X] T018 [US1] Integrar o tipo em `frontend/src/pages/TransactionPage.tsx` e `frontend/src/components/transaction/FormStep.tsx`:
  - estado `transferKind` limpo ao trocar o Para;
  - seletor só com `destination.isOwn === false`;
  - validação "Escolha o tipo";
  - `kind` no corpo da prévia e do registro;
  - rótulo do botão e mensagem de sucesso por tipo.

  → frontend-react-developer
- [X] T019 [US1] Mostrar a linha "Tipo" e o bloco "Efeito na dívida" (empréstimo) em `frontend/src/components/transaction/PreviewStep.tsx` → frontend-react-developer
- [X] T020 [P] [US1] Rótulos por tipo ("Empréstimo para/de {nome}", "Pagamento para/de {nome}", "Quitação para/de {nome}", "Estorno de …"):
  - em `frontend/src/components/statement/StatementEntryRow.tsx` e `frontend/src/components/statement/transactionVisuals.ts`;
  - linha "Tipo" em `frontend/src/components/statement/TransactionDetailSheet.tsx`.

  → frontend-react-developer
- [X] T021 [P] [US1] Chaves de i18n de `contracts/ui.md` (`transaction.kind.*`, `transaction.validation.kindRequired`, `transaction.preview.kind/debtEffect/loanEffect`, `transaction.submit.loan/payment/settlement`, toasts e `statement.kind.*`) em `frontend/src/i18n/pt-BR.json` → frontend-react-developer

**Checkpoint**: US1 funciona sozinha: empréstimo e pagamento pelo app, dívidas corretas e extrato com tipo.

---

## Phase 4: User Story 2 - Quitar um empréstimo, total ou parcialmente, na mesma moeda (Priority: P1)

**Goal**: Quitação na moeda das carteiras, com dívida atual na tela, "Quitar tudo", teto e recusa sem dívida, segura sob concorrência.

**Independent Test**: empréstimo de R$ 100,00 de Ana para Bruno; Bruno quita R$ 30,00 e depois "Quitar tudo"; dívida R$ 70,00 → some; quitação de R$ 80,00 é recusada.

### Tests for User Story 2

- [X] T022 [P] [US2] Testes em `backend/Finami.Tests/Domain/LedgerServiceSettlementTests.cs`:
  - quitação parcial abate;
  - `settleAll` na mesma moeda envia e abate a dívida exata;
  - sem dívida → 422 "Você não tem dívida com {nome} nesta moeda.";
  - acima → 422 "O valor é maior que a dívida (R$ 70,00).";
  - estorno da quitação devolve o abatido;
  - prévia com `before`/`after`.

  → dotnet-senior-developer
- [X] T023 [P] [US2] Teste de concorrência em `backend/Finami.Tests/Integration/ConcurrentSettlementTests.cs`: duas quitações paralelas, de carteiras diferentes do mesmo devedor, cuja soma passa da dívida → uma registrada e outra 422; a dívida nunca fica negativa por quitação (SC-005) → dotnet-senior-developer
- [X] T024 [P] [US2] Testes em `frontend/src/pages/TransactionPage.test.tsx`:
  - Quitação carrega `GET /api/users/{titular}/debts` e mostra "Você deve R$ 100,00 a Ana" (ou "Caio deve…" com origem de dependente);
  - "Quitar tudo" preenche o valor e envia `settleAll: true`;
  - digitar desliga o modo;
  - sem dívida mostra o aviso e o Continuar fica `aria-disabled`;
  - prévia "R$ 100,00 → R$ 70,00";
  - erro 422 aparece no banner;
  - axe.

  → frontend-react-developer

### Implementation for User Story 2

- [X] T025 [US2] Quitação na mesma moeda em `PlanTransferAsync` de `backend/Finami.Domain/Services/LedgerService.cs` (passo 8 de `data-model.md`):
  - `GetPairDebtAsync`;
  - mensagens de sem dívida e de teto (valor formatado na moeda);
  - `settleAll` = dívida atual;
  - revalidar dentro do lock em `PostAsync` antes de inserir.

  → dotnet-senior-developer
- [X] T026 [P] [US2] Criar `frontend/src/components/transaction/SettlementPanel.tsx` conforme T001:
  - linha da dívida, com skeleton;
  - ação "Quitar tudo";
  - aviso sem dívida, com `id` para `aria-describedby`;
  - `role="status"` no carregamento.

  → frontend-react-developer
- [X] T027 [US2] Integrar a quitação em `frontend/src/pages/TransactionPage.tsx` e `frontend/src/components/transaction/FormStep.tsx`:
  - carregar as dívidas do titular da origem via `useBalance().getUserDebts`, recarregando com `ledgerVersion`;
  - estado `settleAll`;
  - Continuar bloqueado sem dívida;
  - corpo com `kind: "settlement"`, `settleAll` e sem `amount` quando ligado;
  - toast "Quitação de … registrada.".

  → frontend-react-developer
- [X] T028 [US2] Bloco "Efeito na dívida" para quitação ("Dívida de Bruno com Ana: R$ 100,00 → R$ 70,00", "quitada" no zero) em `frontend/src/components/transaction/PreviewStep.tsx`. Chaves `transaction.settlement.*` e `transaction.preview.settlementEffect` em `frontend/src/i18n/pt-BR.json` → frontend-react-developer

**Checkpoint**: US1 + US2 entregam empréstimo, pagamento e quitação na mesma moeda de ponta a ponta.

---

## Phase 5: User Story 3 - Quitar na outra moeda, com conversão pela cotação (Priority: P2)

**Goal**: dívida em real quitada com bitcoin e vice-versa, convertida pela cotação atual, com cotação gravada e "Quitar tudo" que zera a dívida.

**Independent Test**: dívida de R$ 100,00, com ₿ 1 = R$ 500.000,00; quitar ₿ 0,00010000 abate R$ 50,00; "Quitar tudo" envia ₿ 0,00010000 e zera a dívida.

### Tests for User Story 3

- [X] T029 [P] [US3] Testes em `backend/Finami.Tests/Domain/LedgerServiceSettlementConversionTests.cs`:
  - BRL pago em BTC: `trunc2(btc × preço)`;
  - BTC pago em BRL: `trunc8(brl ÷ preço)`;
  - `settleAll` com `ceil8`/`ceil2` e abatido = dívida;
  - abatido zero → "Valor pequeno demais para conversão.";
  - acima da dívida após a conversão → 422;
  - cotação gravada (`BtcQuoteId`/`QuotePriceBrl`) e tipo contábil `Transfer`;
  - estorno devolve o abatido sem nova cotação e não é tratado como conversão;
  - `amountBrl` em quitação de dívida BTC;
  - cotação indisponível → 503.

  → dotnet-senior-developer
- [X] T030 [P] [US3] Testes em `frontend/src/pages/TransactionPage.test.tsx`:
  - grupo "Quitar dívida em" aparece com dívidas nas duas moedas, ou só na outra moeda, com a sugestão inicial correta;
  - nota "Convertido pela cotação atual na confirmação.";
  - "Quitar tudo" na outra moeda deixa o Valor como "Valor calculado na confirmação";
  - prévia mostra enviado, "Abatido da dívida", cotação e horário;
  - `debtCurrency` enviado;
  - 503 mostra o aviso de cotação.

  → frontend-react-developer

### Implementation for User Story 3

- [X] T031 [US3] Conversão da quitação (tabela de R-04) em `PlanTransferAsync` de `backend/Finami.Domain/Services/LedgerService.cs`:
  - funções de arredondamento para cima por moeda em `backend/Finami.Domain/Services/Money.cs` (`Ceiling`), com casos em `backend/Finami.Tests/Domain/MoneyTests.cs`;
  - a prévia devolve `quote`.

  → dotnet-senior-developer
- [X] T032 [US3] Escolha da moeda da dívida no `frontend/src/components/transaction/SettlementPanel.tsx` (grupo Real | Bitcoin, sugestão inicial, nota de conversão) e modo "quitar tudo" em outra moeda no campo Valor, em `frontend/src/components/transaction/FormStep.tsx` e `frontend/src/pages/TransactionPage.tsx` (envia `debtCurrency`) → frontend-react-developer
- [X] T033 [US3] Linhas "Abatido da dívida", cotação e horário na prévia de quitação em outra moeda, e na linha "Abatido da dívida" do detalhe, em `frontend/src/components/transaction/PreviewStep.tsx` e `frontend/src/components/statement/TransactionDetailSheet.tsx` → frontend-react-developer

**Checkpoint**: quitação em qualquer moeda pelo app, com valores iguais aos da confirmação.

---

## Phase 6: User Story 4 - Ver empréstimos e quitações nas dívidas, inclusive pelo assistente (Priority: P3)

**Goal**: as dívidas (Home, página da pessoa, MCP) refletem empréstimos menos quitações, e o assistente registra transferências com tipo.

**Independent Test**: empréstimo de R$ 100,00, pagamento de R$ 50,00 e quitação de R$ 30,00 entre Ana e Bruno → "Bruno deve R$ 70,00 a Ana" no app e pelo `dividas_da_pessoa`; `registrar_transferencia` com `tipo: pagamento` não cria dívida.

### Tests for User Story 4

- [X] T034 [P] [US4] Ajustar `backend/Finami.Tests/Domain/DebtServiceTests.cs` e `backend/Finami.Tests/API/FamilyDebtsApiTests.cs` ao novo cálculo (empréstimo − quitação; pagamento ignorado; quitação em outra moeda pela `debt_currency`) → dotnet-senior-developer
- [X] T035 [P] [US4] Testes em `backend/Finami.Tests/API/McpTransactionToolsTests.cs`:
  - `tipo` (`emprestimo`/`quitacao`/`pagamento`), `moeda_da_divida` e `quitar_tudo` mapeados para o `TransferInfo`;
  - valor inválido de `tipo`;
  - texto da prévia com o efeito na dívida.

  Conferir que `backend/Finami.Tests/API/McpToolsCatalogTests.cs` continua com 40 ferramentas → dotnet-senior-developer

### Implementation for User Story 4

- [X] T036 [US4] Parâmetros `tipo`, `moeda_da_divida` e `quitar_tudo` em `previa_transferencia` e `registrar_transferencia`, com o novo `TRANSFER_RULES` e o texto da prévia com tipo e efeito (`contracts/mcp.md`), em `backend/Finami.API/Mcp/Tools/TransactionTools.cs` → dotnet-senior-developer
- [X] T037 [P] [US4] Atualizar a descrição de `dividas_da_pessoa` em `backend/Finami.API/Mcp/Tools/DebtTools.cs` e o texto da regra em `backend/Finami.API/Mcp/Prompts/FinamiPrompts.cs` e nas instruções de `backend/Finami.API/Mcp/McpServerSetup.cs` → dotnet-senior-developer

**Checkpoint**: todas as histórias funcionam de forma independente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T038 [P] Atualizar o README do backend (seção de transferências/dívidas) e o `.http` de exemplos com `kind`, `debtCurrency` e `settleAll` em `backend/README.md` e `backend/Finami.API/Finami.API.http` → dotnet-senior-developer
- [X] T039 [P] Revisão de UX/acessibilidade das telas implementadas contra T001 (contraste, foco, leitores de tela em 320 px e zoom 200 %) e registro em `docs/design/REVIEW-007.md` → ux-designer
- [X] T040 Rodar `dotnet test` em `backend/` e `npm test`, `npm run lint` e `npm run build` em `frontend/`, e os testes de integração em banco temporário no container de homolog (skill `wsl-docker`) → dotnet-senior-developer / frontend-react-developer (backend concluído em 2026-11-03: `dotnet test` 462/462, inclusive integração em banco temporário; falta a parte do frontend)
- [X] T041 Executar o roteiro de `specs/007-loan-transfer-types/quickstart.md` em homolog (Docker via WSL), incluindo a migração sobre dados existentes (passo 1) e a concorrência (passo 18)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 bloqueia as tarefas `.tsx` (T017–T020, T026–T028, T032–T033).
- **Foundational (Phase 2)**: depende de nada e bloqueia todas as histórias. Ordem: T002 → T003 → T004 → T007/T008; T005, T006, T009 e T010 em paralelo onde marcados.
- **US1 (Phase 3)**: depende da Phase 2. É o MVP.
- **US2 (Phase 4)**: depende da Phase 2 e de T015/T016 (o tipo precisa existir); o frontend depende de T018.
- **US3 (Phase 5)**: depende de US2 (quitação na mesma moeda).
- **US4 (Phase 6)**: depende da Phase 2 e de T016 (o MCP usa o mesmo `TransferInfo`); pode correr em paralelo com US2/US3 no backend.
- **Polish (Phase 7)**: depois das histórias desejadas.

### Within Each User Story

- Testes primeiro (devem falhar), depois o backend (validador → `LedgerService`), depois o frontend (componente → página → prévia → i18n).
- Tarefas no mesmo arquivo (`LedgerService.cs`, `TransactionPage.tsx`, `PreviewStep.tsx`) são sequenciais entre histórias.

### Parallel Opportunities

- Phase 2: T005, T006, T009 e T010 em paralelo, depois de T002–T003.
- US1: os testes T011–T014 em paralelo; T017, T020 e T021 em paralelo com o backend T015/T016.
- US2: T022, T023 e T024 em paralelo; T026 em paralelo com T025.
- US3: T029 e T030 em paralelo.
- US4: T034, T035 e T037 em paralelo; o backend de US4 pode rodar junto com o frontend de US2/US3.

---

## Parallel Example: User Story 1

```text
Agente dotnet-senior-developer: T011 (LedgerServiceTransferKindTests) + T012 (validador)
Agente frontend-react-developer: T013 (TransactionPage.test) + T014 (extrato) + T017 (TransferKindPicker) + T021 (i18n)
Depois: T015 → T016 (backend); T018 → T019 → T020 (frontend)
```

## Parallel Example: User Story 2

```text
Agente dotnet-senior-developer: T022 + T023 → T025
Agente frontend-react-developer: T024 + T026 → T027 → T028
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (UX) e Phase 2 (colunas, backfill, cálculo, DTOs). Validar que as dívidas não mudaram (T009).
2. Phase 3 (US1): empréstimo e pagamento com tipo.
3. **Parar e validar**: passos 1–5 e 14–16 do quickstart. A partir daqui já dá para publicar: o
   pagamento deixa de gerar dívida falsa.

### Incremental Delivery

1. US1 → publicar (MVP).
2. US2 → quitação na mesma moeda → publicar.
3. US3 → quitação em outra moeda → publicar.
4. US4 → assistente e textos → publicar.

### Parallel Team Strategy

- `dotnet-senior-developer`: Phase 2, depois o backend de US1 → US2 → US3, e US4 em paralelo ao frontend.
- `ux-designer`: T001 no início e T039 no fim.
- `frontend-react-developer`: T010, depois o frontend de US1 → US2 → US3.

---

## Notes

- Toda transferência nova pelo app envia `kind`; sem ele, a API assume empréstimo (compatibilidade).
- Commits sempre `fix:` (CLAUDE.md), e só quando o usuário pedir.
- Migration aplicada em produção pelo `MigrateOnStartup`: validar o backfill em homolog antes do deploy.
