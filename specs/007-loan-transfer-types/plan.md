# Implementation Plan: Tipos de transferência — empréstimo, quitação e pagamento

**Branch**: `007-loan-transfer-types` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-loan-transfer-types/spec.md`

## Summary

Hoje toda transferência entre titulares diferentes vira dívida. Com esta feature, a transferência entre
pessoas passa a ter um **tipo**:

- **Empréstimo**: aumenta a dívida de quem recebe com quem envia;
- **Quitação**: abate a dívida de quem envia com quem recebe, total ou parcialmente, também na outra
  moeda pela cotação atual;
- **Pagamento**: não mexe em dívida.

Abordagem técnica:

- **Colunas novas** em `transactions` (R-01): `transfer_kind`, `debt_currency` e `debt_amount`. A
  dívida continua derivada, agora somando só esses efeitos. Os estornos copiam o efeito e o desfazem.
- **Backfill na migration**: marca as transferências antigas entre pessoas como Empréstimo, sem mudar
  nenhuma dívida exibida (R-02).
- **Regras centralizadas** em `LedgerService.PlanTransferAsync`, para app, API, prévia e MCP:
  - dívida existente;
  - teto do abatimento;
  - conversão;
  - "quitar tudo" calculado no servidor (R-04).
- **Concorrência**: lock consultivo por par de titulares no registro (R-03).
- **Frontend**:
  - seletor de tipo;
  - painel de quitação (dívida atual, moeda da dívida, "Quitar tudo");
  - bloco "Efeito na dívida" na confirmação;
  - rótulos de tipo no extrato.
- **MCP**: parâmetros `tipo`, `moeda_da_divida` e `quitar_tudo`.

## Technical Context

**Language/Version**: C# 12 / .NET 8 (backend) · TypeScript 5.8 / React 18.3 (frontend)
**Primary Dependencies**: as já existentes, sem dependências novas.
**Storage**: PostgreSQL. Sem tabelas novas; a migration `AddTransferKindAndDebt` traz 3 colunas
anuláveis em `transactions`, uma check constraint e o backfill.
**Testing**: xUnit + Moq + FluentAssertions; integração com PostgreSQL real (banco temporário no
container de homolog) · Vitest + Testing Library + vitest-axe.
**Target Platform**: API em Linux (Docker, `finami-api`) · PWA em navegadores móveis e desktop.
**Project Type**: web application (backend + frontend).
**Performance Goals**: dívidas e prévia em < 200 ms p95 na escala de uma família; a validação da
quitação acrescenta 1 consulta agregada por par.
**Constraints**:
- regras validadas no servidor, num ponto só;
- dívidas exibidas hoje inalteradas após a migration (SC-002);
- "quitar tudo" zera a dívida exatamente (SC-004);
- nenhuma quitação acima da dívida, mesmo com concorrência (SC-005);
- contrato aditivo (clientes antigos funcionam);
- WCAG 2.1 AA.
**Scale/Scope**:
- 2 endpoints alterados (transfer e preview) e 3 respostas com campos novos (prévia, transação,
  extrato);
- 2 ferramentas MCP alteradas;
- tela Transferir, prévia, extrato e detalhe.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Situação |
|---|---|
| I. Skills de arquitetura | ✅ `dotnet-architecture`: enum `TransferKind`, colunas, migration, repositório e DTOs. `react-architecture`: tipos e services; o contexto existente (`TransactionContext`, `BalanceContext`) é estendido. |
| II. Stack fixa | ✅ Sem dependências novas; Fetch API; Context API. Docker só via WSL. |
| III. Casing de diretórios | ✅ Arquivos novos nas pastas existentes (`Enums/`, `components/transaction/`). |
| IV. Convenções de código | ✅ DTOs com `[JsonPropertyName]` camelCase e valores de enum em string minúscula no contrato; `interface` no TS; arrow functions. |
| V. Banco | ✅ Colunas snake_case; constraint `ck_transactions_debt_effect`; nenhuma FK nem cascade nova; dívida continua derivada. |
| VI. Autenticação | ✅ Endpoints existentes já `[Authorize]`; o painel de quitação usa `GET /api/users/{id}/debts` com `CanViewUserAsync`. |
| VII. Erros no backend | ✅ `Execute` existente: validação 400, regra 422, cotação 503. |
| VIII. Agentes | ✅ `dotnet-senior-developer` (backend, migration, MCP); `ux-designer` (seletor de tipo, painel de quitação, efeito na prévia, rótulos do extrato) **antes** de `frontend-react-developer`. Contrato da API definido antes das tarefas. |
| IX. Acessibilidade | ✅ `contracts/ui.md`: `radiogroup` com rótulo e ajuda ligada, erro focável, `aria-disabled` com explicação, efeito na dívida em texto (não só cor). |

**Resultado**: passa, sem violações. *Re-check pós-design (Phase 1)*: passa. O desenho só acrescenta
colunas e campos, sem tabela, dependência ou padrão novo.

## Project Structure

### Documentation (this feature)

```text
specs/007-loan-transfer-types/
├── plan.md              # Este arquivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── api.md
│   ├── mcp.md
│   └── ui.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── Finami.Domain/
│   ├── Enums/TransferKind.cs                       # novo
│   ├── Models/Transaction.cs                       # + TransferKind?, DebtCurrency?, DebtAmount?
│   ├── Services/LedgerService.cs                   # tipo, quitação, conversão, quitar tudo, lock do par, estorno copia efeito
│   ├── Services/DebtService.cs                     # (consulta nova via repositório; formato igual)
│   └── Validators/TransferInfoValidator.cs         # kind/debtCurrency/settleAll
├── Finami.DTO/
│   ├── Transactions/TransferDtos.cs                # TransferInfo (+3), TransferPreviewResult (+kind, debt), TransferDebtEffect
│   ├── Transactions/TransactionDtos.cs             # TransactionInfo (+3)
│   └── Statements/StatementDtos.cs                 # StatementEntryInfo (+3)
├── Finami.Infra.Interfaces/
│   ├── Repository/ITransactionRepository.cs        # GetPersonDebtsAsync (nova regra), + GetPairDebtAsync
│   └── Repository/IUnitOfWork.cs                   # + LockDebtPairAsync
├── Finami.Infra/
│   ├── Context/FinamiContext.cs                    # colunas + check constraint
│   ├── Repository/TransactionRepository.cs
│   ├── Repository/UnitOfWork.cs                    # pg_advisory_xact_lock
│   ├── Repository/StatementRepository.cs (ou equivalente)  # projeta os campos novos
│   └── Migrations/*_AddTransferKindAndDebt.cs      # colunas + backfill
├── Finami.API/
│   ├── Mcp/Tools/TransactionTools.cs               # tipo, moeda_da_divida, quitar_tudo, textos
│   ├── Mcp/Tools/DebtTools.cs                      # descrição
│   └── Mcp/Prompts/FinamiPrompts.cs, McpServerSetup.cs  # texto da regra
└── Finami.Tests/                                   # Domain, Integration (backfill, pares, concorrência), API, MCP

frontend/src/
├── types/transaction.ts, types/statement.ts        # TransferKind, debt effect, campos novos
├── components/transaction/
│   ├── TransferKindPicker.tsx                      # novo (radiogroup)
│   ├── SettlementPanel.tsx                         # novo (dívida atual, moeda, Quitar tudo)
│   ├── FormStep.tsx, PreviewStep.tsx, sheetModel.ts
├── components/statement/StatementEntryRow.tsx, TransactionDetailSheet.tsx  # rótulos/linha Tipo
├── pages/TransactionPage.tsx                       # estado do tipo, quitação, corpo da prévia/registro, toasts
└── i18n/pt-BR.json
```

**Structure Decision**: aplicação web existente (`backend/` em Clean Architecture + `frontend/` React).
A feature só acrescenta arquivos nas camadas que já existem.

## Riscos e decisões de implementação

- **Mudança de comportamento para clientes antigos**: sem `kind`, entre pessoas, continua empréstimo,
  então não há mudança. O app novo sempre envia `kind`.
- **Backfill**: o `UPDATE` precisa reproduzir exatamente o filtro de hoje. O teste de integração
  compara as dívidas antes e depois da migration num banco semeado (SC-002).
- **Estornos antigos**: estornos de transferências entre pessoas também passam pelo backfill (mesmo
  filtro), então continuam compensando.
- **`IsConversion`**: considera `Reversal` com `QuotePriceBrl` como conversão. Uma quitação em outra
  moeda grava cotação sem câmbio e o estorno dela herdaria esse critério. A implementação deve trocar
  o critério para comparar moedas de origem e destino (ou `Type` do original), com teste.
- **Lock consultivo**: a chave do par assume ids em 32 bits, documentado em `UnitOfWork`. Ids maiores
  usariam `hashtextextended`.
- **Arredondamento**: "quitar tudo" em outra moeda arredonda para cima o valor enviado, então o
  credor pode receber até 1 centavo ou 1 satoshi a mais que o valor exato convertido. Isso é aceito e
  aparece na prévia.

## Complexity Tracking

Sem violações; seção não aplicável.
