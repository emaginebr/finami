# Quickstart: validação da feature 006

Ambiente: homolog (Docker local) ou Development, com o frontend apontando para a API.

## Preparação

1. Usuárias **Ana** e **Bruno** na família "Silva"; **Carla** em outra família, sem família em
   comum com Ana.
2. Ana: "Nubank" (BRL, R$ 1.000,00) e "Ledger" (BTC, ₿ 0,01). Bruno: "Mesada" (BRL) e "Cofre"
   (BTC). Carla: "Conta" (BRL).
3. Cotação do bitcoin disponível (ex.: R$ 500.000,00).

## Roteiro

| # | Passo | Esperado | Spec |
|---|---|---|---|
| 1 | Abrir Transferir e o campo De | Nubank e Ledger com ícone do tipo, "Ana" e saldo | US2-1, FR-014 |
| 2 | De = Nubank; abrir Para | Grupo "Família": carteiras BRL de Ana e Bruno, sem Nubank e sem Carla. Grupo "Converter": Ledger | US2-2, FR-016/017 |
| 3 | Trocar De para Ledger | Para mostra só BTC (Cofre) + "Converter": Nubank; destino anterior limpo | US2-3, FR-019 |
| 4 | Nubank → Mesada R$ 100,00 | Registrado; página de Bruno: "Bruno deve R$ 100,00 a Ana"; página de Ana: "Bruno deve a você R$ 100,00" | US1-1 |
| 5 | Bruno: Mesada → Nubank R$ 30,00 | Dívida passa a R$ 70,00 | US1-2 |
| 6 | Estornar a transferência do passo 4 | Agora "Ana deve a Bruno R$ 30,00" | US1-4, FR-006 |
| 7 | Ana: Nubank → Poupança (dela) | Nenhuma dívida nova | US1-5 |
| 8 | `POST /api/transactions/transfer` de Nubank para a Conta de Carla | 422 "Só é possível transferir para pessoas da sua família." | US2-4, FR-010 |
| 9 | `POST /api/transactions/transfer` de Nubank para Cofre (BTC de Bruno) | 422 "Conversão entre real e bitcoin só entre carteiras da mesma pessoa." | US3-2, FR-011 |
| 10 | Nubank → Ledger R$ 500,00 | Compra de BTC registrada com cotação; sem dívida | US3-1/3 |
| 11 | Ledger → Cofre, alternador "Reais", R$ 200,00 | Confirmação: ₿ 0,00040000 e cotação; após confirmar, Ledger −₿ 0,0004 e Cofre +₿ 0,0004; dívida BTC de Bruno com Ana | US4-1/2, FR-020..022 |
| 12 | Igual ao 11 com R$ 0,0001 | "Valor pequeno demais para conversão." | US4-4 |
| 13 | Navegar Família, pessoa, Conta, Notificações | Botão flutuante visível; ausente em Depositar/Sacar/Transferir | US5, FR-024 |
| 14 | Extrato da Ledger → botão → Transferir | De pré-selecionado na Ledger | FR-025 |
| 15 | MCP: `dividas_da_pessoa` sem parâmetro (conectado como Ana) | Mesmas dívidas da página de Ana | FR-009 |
| 16 | MCP: `registrar_transferencia` com `valor_em_reais` para carteira BRL | Erro de validação "Valor em reais só vale…" | FR-012 |

## Testes automatizados

- Backend: `dotnet test` (unitários do `LedgerService`, `DebtService`, validador, controllers e
  ferramentas MCP).
- Frontend: `npm test` (TransactionPage: De/Para, grupos, alternador; MemberPage: dívidas; AppShell:
  Fab) e `npm run lint`, `npm run build`.
