# Implementation Plan: Dívidas entre pessoas e transferências dentro da família

**Branch**: `006-family-debts-transfers` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-family-debts-transfers/spec.md`

## Summary

O que a feature entrega:

- Transferências entre titulares diferentes passam a gerar **dívidas** de quem recebeu com quem
  enviou. As dívidas são calculadas na leitura a partir do razão (sem tabela nova), por contraparte
  e moeda, e os estornos as compensam sozinhos.
- O `LedgerService` passa a recusar duas operações, em todos os canais (app, API e MCP):
  - transferências para quem não divide família com o titular da origem;
  - conversões real ↔ bitcoin entre titulares diferentes.
- Endpoints novos:
  - `GET /api/users/{id}/debts`, consumido pela nova seção "Dívidas" da página da pessoa;
  - `GET /api/wallets/{id}/transfer-destinations`, que alimenta o campo Para: grupos "Família" e
    "Converter", com primeiro nome e saldo (ou saldo oculto).
- O `WalletInfo` ganha `ownerFirstName`, para o campo De.
- O `TransferInfo` aceita `amountBrl` em transferências BTC → BTC. No app, o fluxo é:
  1. o preview converte o valor em reais;
  2. o registro envia o valor em BTC confirmado no preview.
- O Fab aparece em todas as telas do shell, exceto as de lançamento.
- A transferência por código público sai do app.

## Technical Context

**Language/Version**: C# 12 / .NET 8 (backend) · TypeScript 5.8 / React 18.3 (frontend)
**Primary Dependencies**: as já existentes, sem dependências novas.
- Backend: EF Core 9 + Npgsql, FluentValidation, ModelContextProtocol.AspNetCore.
- Frontend: Vite 6, Tailwind 4, React Router 6, i18next, Radix Dialog, lucide-react.
**Storage**: PostgreSQL. Sem tabelas novas; a migration `AddTransactionAccountIndexes` cria
índices em `transactions(source_account_id)` e `transactions(destination_account_id)`.
**Testing**: xUnit + Moq + FluentAssertions (backend) · Vitest + Testing Library + vitest-axe (frontend)
**Target Platform**: API em Linux (Docker, `finami-api`) · PWA em navegadores móveis e desktop
**Project Type**: web application (backend + frontend)
**Performance Goals**:
- dívidas da pessoa e destinos de transferência em < 200 ms p95 na escala de uma família
  (milhares de transações);
- Para carregado em < 1 s após escolher o De.
**Constraints**:
- regras validadas no servidor (um ponto só: `LedgerService.PlanTransferAsync`);
- saldo negativo continua permitido;
- valor registrado em BTC igual ao confirmado (SC-005);
- WCAG 2.1 AA.
**Scale/Scope**:
- 2 endpoints novos, 2 alterados e 2 ferramentas MCP novas (mais 2 alteradas);
- telas alteradas: Transferir e Pessoa, além do AppShell.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Situação |
|---|---|
| I. Skills de arquitetura | ✅ `dotnet-architecture` para `DebtService`, a consulta no repositório, os DTOs e a migration; `react-architecture` para os tipos e services e para estender os contexts (`BalanceContext`, `WalletContext`, `TransactionContext`). |
| II. Stack fixa | ✅ Sem dependências novas; Fetch API nos services novos; Context API. Docker só via WSL, conforme a skill `wsl-docker` da máquina. |
| III. Casing de diretórios | ✅ Arquivos novos em `Services/`, `Contexts/`, `hooks/`, `types/` existentes. |
| IV. Convenções de código | ✅ DTOs com `[JsonPropertyName]` camelCase; `interface` no TS; arrow functions. |
| V. Banco | ✅ Só índices novos, com nome `ix_transactions_*` em snake_case; nenhuma FK ou cascade novos. |
| VI. Autenticação | ✅ Rotas novas com `[Authorize]`. As dívidas respeitam `CanViewUserAsync` e os destinos exigem controle da origem. O saldo de terceiros respeita `CanViewWalletStatementAsync`. |
| VII. Erros no backend | ✅ Controllers usam o `Execute` existente (regra → 422, validação → 400, 500 com mensagem). |
| VIII. Agentes | ✅ Tarefas divididas: `dotnet-senior-developer` (backend e MCP), `ux-designer` (seção Dívidas, campos De/Para, alternador Bitcoin/Reais) **antes** de `frontend-react-developer`. O contrato da API está definido antes das tarefas (contracts/api.md). |
| IX. Acessibilidade | ✅ `contracts/ui.md` define nomes acessíveis das opções, grupos com cabeçalho, alternador com `aria-pressed`, saldo oculto com texto e débito/crédito sem depender de cor. |

**Resultado**: passa, sem violações. *Re-check pós-design (Phase 1)*: passa; o desenho não
introduziu tabela, dependência ou padrão novo.

## Project Structure

### Documentation (this feature)

```text
specs/006-family-debts-transfers/
├── plan.md              # Este arquivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── api.md           # Endpoints novos/alterados
│   ├── mcp.md           # Ferramentas MCP
│   └── ui.md            # Telas, Fab e i18n
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── Finami.DTO/
│   ├── Debts/DebtDtos.cs                     # novo: PersonDebtInfo, PersonDebtsResult
│   ├── Wallets/WalletDtos.cs                 # + OwnerFirstName; novo TransferDestinationInfo/Result
│   └── Transactions/TransferDtos.cs          # Amount opcional + AmountBrl
├── Finami.Domain/
│   ├── Services/LedgerService.cs             # regras família/conversão, amountBrl
│   ├── Services/DebtService.cs               # novo: dívidas por pessoa
│   ├── Services/WalletService.cs             # destinos de transferência, OwnerFirstName
│   └── Validators/TransferInfoValidator.cs   # amount xor amountBrl
├── Finami.Infra.Interfaces/Repository/
│   ├── ITransactionRepository.cs             # + GetPersonDebtsAsync
│   └── IAccountRepository.cs                 # + ListTransferDestinationsAsync
├── Finami.Infra/
│   ├── Repository/TransactionRepository.cs
│   ├── Repository/AccountRepository.cs
│   ├── Context/FinamiContext.cs              # índices novos
│   └── Migrations/*_AddTransactionAccountIndexes.cs
├── Finami.Application/                       # DI do DebtService
├── Finami.API/
│   ├── Controllers/UsersController.cs        # GET {userId}/debts
│   ├── Controllers/WalletsController.cs      # GET {id}/transfer-destinations
│   ├── Mcp/Tools/DebtTools.cs                # novo: dividas_da_pessoa
│   ├── Mcp/Tools/WalletReadTools.cs          # + destinos_de_transferencia
│   ├── Mcp/Tools/TransactionTools.cs         # valor_em_reais + descrições
│   └── Mcp/Prompts/FinamiPrompts.cs
└── Finami.Tests/                             # Domain (LedgerService, DebtService, validador), API, MCP

frontend/src/
├── types/                                    # debt.ts (novo), wallet.ts (+ownerFirstName, destinos), transaction.ts (amountBrl)
├── Services/                                 # balanceService (getUserDebts), walletService (getTransferDestinations), transactionService
├── Contexts/                                 # BalanceContext, WalletContext, TransactionContext
├── components/
│   ├── layout/AppShell.tsx                   # Fab por exclusão de rotas
│   ├── transaction/FormStep.tsx              # De/Para novos, grupos, alternador Bitcoin/Reais
│   ├── transaction/PreviewStep.tsx           # mostra valor em reais + BTC + cotação
│   ├── transaction/WalletOption.tsx          # novo: ícone, primeiro nome, nome, saldo
│   └── debt/DebtList.tsx                     # novo (pasta nova): seção Dívidas
├── pages/TransactionPage.tsx                 # remove modo código; fluxo amountBrl
├── pages/MemberPage.tsx                      # seção Dívidas
└── i18n/pt-BR.json
```

**Structure Decision**: aplicação web existente (`backend/` em Clean Architecture + `frontend/` React).
A feature só acrescenta arquivos nas camadas que já existem.

## Riscos e decisões de implementação

- **Mudança de comportamento em produção**: transferências já usadas para fora da família passam a
  falhar. Isso é intencional (FR-010). Ninguém é avisado de antemão; a mensagem de erro explica.
- **Dívidas históricas** aparecem já na primeira versão (FR-005), inclusive transferências antigas
  feitas pelo código público.
- **Testes existentes** que transferem para "carteira de outra pessoa" sem família em comum
  (`LedgerServiceTransferTests`, testes MCP e de integração) precisam passar a configurar a
  família em comum, ou a esperar a nova recusa.
- **`amount` opcional** no DTO: os clientes atuais continuam válidos (enviam `amount`).

## Complexity Tracking

Sem violações; seção não aplicável.
