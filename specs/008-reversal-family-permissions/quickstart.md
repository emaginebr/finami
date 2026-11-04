# Quickstart: validação da feature 008

Ambiente: homolog (Docker local via WSL) ou Development.

## Preparação

1. Família **Silva** com a responsável **Ana**, a membro **Bruno** (com login) e o membro **Caio**
   (com login).
2. Carteiras:
   - Ana: Nubank (BRL, Silva) e Ledger (BTC, Silva);
   - Bruno: Mesada (BRL, Silva) e Pessoal (BRL, sem família);
   - Caio: Cofrinho (BRL, Silva).
3. Visibilidade do extrato da família: "Todos os membros".

## Roteiro

| # | Passo | Esperado | Spec |
|---|---|---|---|
| 1 | Aplicar a migration; abrir a família como Ana | Bruno e Caio com "Pode lançar" ligado e "Pode estornar" desligado | FR-014, Q2 |
| 2 | Bruno lança despesa de R$ 80,00 na Mesada | Registrada | SC-006 |
| 3 | Bruno abre a despesa | Sem "Estornar"; pela API, 403 "…estornar lançamentos na família Silva." | US3-1/2 |
| 4 | Bruno estorna uma despesa da carteira Pessoal | Registrado (carteira sem família) | Assumptions |
| 5 | Ana liga "Pode estornar" de Bruno | Toast; Bruno recebe a notificação "Ana mudou suas permissões…" | FR-016/017 |
| 6 | Bruno estorna a despesa do passo 2 | Confirmação "R$ 80,00 voltam para Mesada."; original "Estornado", estorno ligado | US1-1, FR-005/006 |
| 7 | Caio lança R$ 20,00 no Cofrinho; Bruno estorna | Registrado; Caio recebe "Bruno estornou um lançamento da sua carteira Cofrinho." | Q1 B |
| 8 | Ana desliga "Pode lançar" de Caio | Caio: Depositar, Sacar e Transferir sem o Cofrinho; estado vazio "Você só pode consultar a família Silva." | US2-1 |
| 9 | Caio tenta `POST /api/transactions/expense` no Cofrinho | 403 "…criar lançamentos na família Silva." | US2-2 |
| 10 | Ana transfere (Pagamento) R$ 10,00 para o Cofrinho | Registrado | US2-4 |
| 11 | Caio abre a Home, as carteiras e o extrato | Vê tudo como antes | US2-3, FR-011 |
| 12 | Bruno tenta `PUT …/members/3/permissions` | 403 | US4-3 |
| 13 | Ana tenta mudar as próprias permissões pela API | 422 | FR-009 |
| 14 | Estornar um empréstimo, uma quitação, uma compra de BTC e uma receita | Saldos e dívidas voltam exatamente | US1-2/3, SC-001 |
| 15 | Estornar de novo, e estornar um estorno | 409 e 422 | US1-4/5 |
| 16 | Mudar a visibilidade para "Só o responsável"; Bruno tenta estornar o lançamento do Cofrinho | 403 (não pode ver) | R-05 |
| 17 | MCP: `alterar_permissoes_membro` como Ana e como Bruno | Ok / recusado | FR-019 |

## Testes automatizados

- **Backend**:
  - `AccessPolicy`: criar e estornar, com e sem família, responsável e visibilidade;
  - `Group.SetMemberPermissions`;
  - `LedgerService`: recusas e notificações;
  - `GroupService` (histórico e notificação);
  - integração: migration (padrões nos membros atuais) e o PUT;
  - MCP: catálogo com 41 ferramentas e a ferramenta nova.
- **Frontend**:
  - `MemberManager` (interruptores, resumo, acessibilidade);
  - `TransactionPage` (filtro e estado vazio);
  - `TransactionDetailSheet` (`canReverse` e o efeito na confirmação);
  - notificações novas;
  - `npm run lint`, `npm test` e `npm run build`.
