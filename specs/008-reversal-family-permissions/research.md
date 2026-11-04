# Research: Estorno e permissões dos membros na família

**Feature**: `008-reversal-family-permissions` · **Data**: 2026-11-03

Ponto de partida (código atual):

- **Estorno** (`LedgerService.ReverseAsync`):
  - já cobre todos os tipos: receita, despesa, transferência, compra e venda de bitcoin, e empréstimo,
    quitação e pagamento (feature 007);
  - grava um lançamento `Reversal` ligado ao original (`reversed_transaction_id`, índice único) e
    copia valores, cotação e efeito na dívida;
  - recusa estornar um estorno ou estornar duas vezes;
  - a regra de acesso é `EnsureCanControlWalletAsync` sobre uma das contas.
- **Controle de carteira** (`AccessPolicy.CanControlWalletAsync`): o titular ou o responsável pela
  família da carteira.
- **Detalhe de lançamento** (`LedgerService.EnsureCanViewAsync`): exige controlar uma das carteiras.
- **Família**:
  - `groups.user_id` é o responsável, que também está em `group_members`;
  - `Group.EnsureResponsible` já protege adicionar, convidar, criar membro, remover membro, renomear
    e mudar a visibilidade;
  - as carteiras têm `group_id` opcional.
- **Notificações**: `notifications`, com os tipos de convite (feature 003).

## R-01 — Onde guardar as permissões

**Decision**: duas colunas em `group_members`:

| Coluna | Tipo | Padrão |
|---|---|---|
| `can_create_transactions` | `boolean NOT NULL` | `true` |
| `can_reverse` | `boolean NOT NULL` | `false` |

A migration `AddMemberPermissions` cria as colunas com esses padrões. Assim todos os membros atuais
ficam com "Criar lançamentos" ligada e "Estornar" desligada (Q2), e quem entra depois também.

**Responsável**: a linha dele em `group_members` existe, mas é ignorada. `Group.CanCreateTransactions`
e `Group.CanReverse` devolvem sempre `true` para o responsável (FR-009).

**Rationale**:

- A permissão é por membro e por família, que é exatamente a linha de `group_members`.
- Não precisa de tabela nova nem de join extra.
- Remover e readicionar recria a linha, então os padrões voltam (edge case da spec).

**Alternatives considered**:

- **Tabela `group_member_permissions` (1:N por permissão)**: flexível, mas são só duas permissões
  fixas; a feature não pede papéis configuráveis.
- **Papéis (enum)**: "somente leitura / lança / lança e estorna" não cobre "estorna sem lançar", que
  a spec permite (permissões independentes, FR-007).

## R-02 — Histórico das mudanças (FR-020)

**Decision**: tabela nova `group_member_permission_changes`, que só recebe inserções:

- `group_id`, `member_user_id`, `changed_by_user_id`, `changed_at`;
- `before_can_create`, `before_can_reverse`, `after_can_create`, `after_can_reverse`.

Ela é gravada na mesma transação da mudança. Uma chamada que não muda nada não gera linha nem
notificação.

**Rationale**: auditoria simples e consultável. A notificação (R-06) aponta para a linha, então o
texto mostra o estado daquela mudança, não o atual.

**Alternatives considered**: logar só em arquivo (não consultável nem ligável à notificação).

## R-03 — Regra de "criar lançamentos" (FR-010, FR-011)

**Decision**: novo `AccessPolicy.CanCreateTransactionsAsync(userId, wallet)`:

1. `CanControlWalletAsync(userId, wallet)` precisa ser verdadeiro (regra de hoje);
2. carteira sem família: verdadeiro;
3. carteira de família: o responsável sempre pode; o titular-membro só se
   `group_members.can_create_transactions` dele naquela família for verdadeiro.

**Onde se aplica**: `EnsureCanCreateTransactionsAsync` substitui `EnsureCanControlWalletAsync` em:

- `IncomeAsync` (carteira);
- `ExpenseAsync` (carteira);
- `PlanTransferAsync` (carteira de origem), que cobre transferência, prévia, conversão, empréstimo,
  quitação e pagamento.

Mensagem (403): "Você não tem permissão para criar lançamentos na família {nome}.".

**O que não muda**:

- **Destino**: a carteira de destino não é verificada, então receber nunca depende de permissão
  (US2-4).
- **Consultas**: saldos, extratos e dívidas continuam usando as regras de hoje (FR-011).

**Rationale**:

- **Ponto único**: a regra fica no domínio, o que cobre app, API e MCP de uma vez (SC-003).
- **Momento da verificação**: é feita a cada envio, então vale na hora (FR-018).

## R-04 — Regra de estorno (FR-012, FR-013, Q1 B)

**Decision**: novo `AccessPolicy.CanReverseAsync(userId, transaction, accounts)`. O usuário pode
estornar se, para **pelo menos uma** carteira do lançamento:

- é **carteira sem família**: `CanControlWalletAsync` (titular, como hoje; a spec diz que carteiras
  pessoais não são afetadas);
- é **carteira de família**:
  - o usuário é o responsável por aquela família; ou
  - é membro com `can_reverse = true` e pode ver o lançamento (R-05).

Mensagem (403): "Você não tem permissão para estornar lançamentos na família {nome}.". `{nome}` é a
família da primeira carteira de família do lançamento.

**Rationale**:

- **Q1 B**: quem tem "Estornar" desfaz qualquer lançamento das carteiras da família, inclusive de
  outros membros.
- **Transferências entre pessoas**: basta a permissão na família de uma das carteiras (edge case da
  spec).
- **Q2**: membros perdem o estorno das próprias carteiras de família até a liberação. Isso foi
  aceito na spec.

**Alternatives considered**: exigir permissão nas duas famílias de uma transferência (bloquearia o
caso comum, em que só uma das famílias é a dele).

## R-05 — Ver o lançamento para estornar

**Problema**: hoje o detalhe (`GET /api/transactions/{id}`) só abre para quem controla uma das
carteiras. Um membro com "Estornar" não conseguiria abrir o lançamento de outro membro.

**Decision**: `EnsureCanViewAsync` passa a aceitar também quem **pode ver o extrato** de uma das
carteiras (`CanViewWalletStatementAsync`): quem controla a carteira, ou o membro quando a família
mostra os extratos a todos (`AllMembers`).

O estorno por membro exige também essa visibilidade. Assim a visibilidade do extrato, que o
responsável já controla (feature 003), limita o alcance:

- com `ResponsibleOnly` ou `MembersSummary`, o membro só vê e estorna lançamentos das carteiras que
  controla;
- com `AllMembers`, ele vê e estorna qualquer lançamento das carteiras da família.

**Rationale**:

- Não deixa estornar "às cegas" por id um lançamento que a pessoa não pode ver.
- Mantém a decisão Q1 B: o responsável combina "Estornar" com a visibilidade.
- Alinha o detalhe com o extrato, que já mostra essas entradas.

**Alternatives considered**: "Estornar" dar visibilidade automática. Foi descartada porque mudaria a
privacidade definida pelo responsável sem ele perceber.

## R-06 — Notificações (FR-017 e edge case "estorno feito por outro membro")

**Decision**: dois tipos novos em `NotificationType` e duas colunas anuláveis em `notifications`:

| Tipo | Valor | Quem recebe | Colunas | Texto (app) |
|---|---|---|---|---|
| `MemberPermissionsChanged` | 4 | o membro | `permission_change_id` → `group_member_permission_changes` | "Ana mudou suas permissões na família Silva: pode lançar · não pode estornar." |
| `TransactionReversed` | 5 | cada titular de carteira do lançamento, exceto quem estornou | `transaction_id` → o estorno | "Bruno estornou um lançamento da sua carteira Mesada." |

As duas colunas usam FK com `ON DELETE SET NULL`. A notificação é gravada na mesma transação da
ação.

**Rationale**: reaproveita a lista, a contagem de não lidas e a marcação de lidas da feature 003. O
dependente sem login também recebe a notificação, mas só a vê se um dia passar a entrar.

## R-07 — Contratos e app

**Decision**:

- **`GroupMemberInfo`** ganha `canCreateTransactions` e `canReverse`. Para o responsável, os dois vêm
  sempre `true`.
- **`GroupInfo`** ganha `myPermissions` { `canCreateTransactions`, `canReverse` }.
- **Endpoint novo**: `PUT /api/groups/{groupId}/members/{userId}/permissions`, com corpo
  `{ canCreateTransactions, canReverse }` e resposta `GroupInfo`.
  - Só o responsável (`EnsureResponsible`).
  - Alvo é o responsável: 422 "As permissões do responsável não podem ser alteradas.".
  - Alvo não é membro: 404.
- **`WalletInfo`** ganha `canCreateTransactions`. O app filtra as carteiras de origem com ele, no
  lugar de `canControl`.
- **`TransactionInfo`** ganha `canReverse`, calculado para quem consulta, falso se já foi estornado
  ou se é um estorno. O `TransactionDetailSheet` passa a usar `transaction.canReverse` no lugar de
  `canControl`.
- **Confirmação do estorno (FR-006)**: o `ConfirmModal` atual ganha o resumo do efeito:
  - quanto volta para cada carteira;
  - o efeito na dívida quando houver.

  É calculado no app a partir do `TransactionInfo` (valores invertidos), sem endpoint de prévia.

**Rationale**: o app decide o que mostrar sem regras duplicadas (FR-015), e o servidor continua
sendo a autoridade.

## R-08 — MCP (FR-019)

**Decision**:

- `obter_familia` passa a incluir as permissões dos membros.
- Ferramenta nova `alterar_permissoes_membro` (`familia_id`, `pessoa_id`, `pode_lancar`,
  `pode_estornar`), que não é destrutiva e é idempotente.
- `registrar_*` e `estornar_lancamento` passam a devolver as mensagens novas de permissão.
- O catálogo passa de 40 para 41 ferramentas, e o teste do catálogo é atualizado.

## R-09 — Interface (ux-designer antes do frontend)

**Decision**: o `ux-designer` especifica, antes da implementação:

- **Na página da família**, para o responsável: dois interruptores por membro (`role="switch"` com
  rótulo "Pode lançar" / "Pode estornar").
- **Para o membro**: resumo "Somente leitura" ou "Pode lançar · Pode estornar".
- **Nas telas Receita, Despesa e Transferir sem carteira de origem permitida**: estado vazio "Você só
  pode consultar a família {nome}.".
- **Confirmação do estorno**: com o efeito.
- **Textos das duas notificações novas**.

Tudo segue o Princípio IX (WCAG 2.1 AA).
