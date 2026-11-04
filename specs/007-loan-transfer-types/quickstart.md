# Quickstart: validação da feature 007

Ambiente: homolog (Docker local) ou Development, com o frontend apontando para a API.

## Preparação

1. **Ana** e **Bruno** na família "Silva".
2. Ana: "Nubank" (BRL) e "Ledger" (BTC). Bruno: "Mesada" (BRL) e "Cofre" (BTC).
3. Cotação disponível, por exemplo ₿ 1 = R$ 500.000,00.
4. Antes de aplicar a migration, anotar as dívidas exibidas hoje (Home e página de cada pessoa).

## Roteiro

| # | Passo | Esperado | Spec |
|---|---|---|---|
| 1 | Aplicar a migration e reabrir as dívidas | Mesmos valores anotados na preparação | FR-016, SC-002 |
| 2 | Ana: Nubank → Poupança (dela) | Sem seletor de tipo; nenhuma dívida | FR-002, US1-2 |
| 3 | Ana: Nubank → Mesada, sem escolher tipo, Continuar | "Escolha o tipo da transferência." | FR-003, US1-1 |
| 4 | Ana: Nubank → Mesada, Empréstimo, R$ 100,00 | Prévia: "Bruno vai dever R$ 100,00 a Ana"; após registrar, dívida de Bruno R$ 100,00 | US1-3, FR-006 |
| 5 | Ana: Nubank → Mesada, Pagamento, R$ 50,00 | Dívida continua R$ 100,00 | US1-4, FR-007 |
| 6 | Bruno: Mesada → Nubank, Quitação | Painel "Você deve R$ 100,00 a Ana" + "Quitar tudo" | US2-1 |
| 7 | Quitação R$ 30,00 | Prévia R$ 100,00 → R$ 70,00; dívida R$ 70,00 | US2-2 |
| 8 | Quitação R$ 80,00 | 422 "O valor é maior que a dívida (R$ 70,00)." | US2-4, FR-009 |
| 9 | Bruno: Cofre → Ledger, Quitação, dívida em Real, "Quitar tudo" | Prévia: ₿ 0,00014000 enviados, R$ 70,00 abatidos, cotação; após registrar, dívida some | US3-1, FR-014/015 |
| 10 | Ana: Ledger → Cofre, Empréstimo ₿ 0,00100000; Bruno: Mesada → Nubank, Quitação, dívida em Bitcoin, R$ 250,00 | Abatido ₿ 0,00050000; dívida BTC ₿ 0,00050000 | US3-3 |
| 11 | Bruno → Ana Quitação sem dívida (BRL) | Aviso "Você não tem dívida com Ana." e Continuar desabilitado; pela API 422 | US2-5 |
| 12 | Estornar a quitação do passo 7 | Dívida volta a subir R$ 30,00 | Edge: estorno |
| 13 | Estornar a quitação do passo 9 com outra cotação vigente | Dívida volta R$ 70,00 (valor gravado, sem nova cotação) | US3-5 |
| 14 | Extrato da Nubank | "Empréstimo para Bruno", "Pagamento para Bruno", "Quitação de Bruno" | FR-004 |
| 15 | `POST /api/transactions/transfer` entre titulares diferentes sem `kind` | Registrado como empréstimo | Assumptions |
| 16 | `POST …/transfer` entre carteiras de Ana com `kind: "payment"` | 400 "O tipo só vale para transferência entre pessoas diferentes." | R-05 |
| 17 | MCP `previa_transferencia` com `tipo: quitacao`, `quitar_tudo: true` | Texto com o efeito na dívida | FR-018 |
| 18 | Duas quitações simultâneas que somadas passam da dívida | Uma registrada, outra 422 | R-03, SC-005 |

## Testes automatizados

- Backend (`dotnet test`):
  - `LedgerService`: tipo, quitação, conversão, "quitar tudo" e estornos;
  - `DebtService` e validador;
  - integração: migration, dívida por pares e concorrência de quitação;
  - controllers e MCP.
- Frontend (`npm test`):
  - TransactionPage: seletor de tipo, painel de quitação, "Quitar tudo" e prévia com efeito;
  - extrato: rótulos;
  - `npm run lint` e `npm run build`.
