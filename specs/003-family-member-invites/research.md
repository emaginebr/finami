# Research: Inclusão de membros com convites e notificações

**Feature**: `003-family-member-invites` · **Data**: 2026-11-01

Formato: **Decisão / Racional / Alternativas**. Nenhum item "NEEDS CLARIFICATION" restante.

---

## R-01 — Verificação do email numa única chamada ("lookup")

**Decisão**: rota nova `POST /api/groups/{groupId}/member-lookup` com `{ email }`, só para o
responsável, que devolve um `status`:

| `status` | Significado | Próximo passo na interface |
|---|---|---|
| `Available` | email não cadastrado | formulário nome + sobrenome → criar e incluir |
| `Registered` | pertence a alguém que não é membro | mostrar nome → "Convidar para a família" |
| `AlreadyMember` | já é membro (inclui o próprio responsável) | aviso, sem ação |
| `PendingInvite` | já existe convite pendente | aviso, com opção de cancelar o convite |

Quando o email existe, devolve só `userId`, `firstName`, `lastName` (FR-008). Email normalizado
com o `User.NormalizeEmail` já existente (trim + minúsculas).

**Racional**: a interface precisa saber membro/pendente além de "existe ou não"; uma chamada só
evita corridas entre buscas. Restringir ao responsável de uma família reduz a enumeração de emails
em relação ao `GET /api/users/search` (que continua existindo).

**Alternativas**: reutilizar `GET /api/users/search?email=` + consultas extras (3 chamadas, sem
status de convite); validar só no envio (pior UX, contra US1-4).

## R-02 — Criar pessoa e incluir na família de forma atômica

**Decisão**: rota nova `POST /api/groups/{groupId}/members/new` com `{ firstName, lastName,
email? }`: numa transação, cria o usuário (`createdByUserId` = responsável, mesmas validações do
`POST /api/users`, inclusive email único → 409) e o inclui como membro.

**Racional**: sem atomicidade, uma falha entre "criar" e "incluir" deixaria uma pessoa órfã; o
índice único `ix_users_email` garante FR-004 mesmo em corrida (dois responsáveis cadastrando o
mesmo email ao mesmo tempo → um recebe 409 e o fluxo cai em "Registered").

## R-03 — Compatibilidade de `POST /api/groups/{id}/members`

**Decisão**: a rota continua, mas só inclui diretamente usuários **cadastrados pelo próprio
responsável** (`createdByUserId == chamador`). Para qualquer outro usuário devolve `422` com a
mensagem "Essa pessoa precisa ser convidada e aceitar o convite.".

**Racional**: cumpre FR-012/SC-004 (ninguém com conta própria entra sem aceitar) sem quebrar o caso
legítimo de pessoas criadas pelo responsável. Membros incluídos antes continuam membros.

**Alternativas**: remover a rota (quebraria clientes e testes da 001); manter como está (viola a
spec).

## R-04 — Modelo do convite e concorrência

**Decisão**: tabela `group_invitations` com `status` (`Pending=1`, `Accepted=2`, `Declined=3`,
`Canceled=4`) e índice único parcial `(group_id, invited_user_id) WHERE status = 1` (FR-010).
Aceitar/recusar/cancelar rodam em transação (`IUnitOfWork`) com `SELECT … FOR UPDATE` na linha do
convite, conferem `status = Pending` e, ao aceitar, conferem que o grupo existe e que
`invited_by_user_id` ainda é o responsável (FR-016); então incluem o membro (índice único
`ix_group_members_group_user` já existe) e geram a notificação ao responsável.

**Racional**: o bloqueio da linha + checagem de estado torna aceitar/recusar idempotentes contra
toque duplo e contra "cancelar e aceitar ao mesmo tempo". O índice parcial impede convites
pendentes duplicados mesmo em corrida (violação → 409).

**Alternativas**: coluna `is_active` booleana (não guarda o histórico de respostas); token de
convite por link (não há envio de email nesta versão).

## R-05 — Notificações

**Decisão**: tabela `notifications` (destinatário, `type`, referências opcionais a família, convite
e "ator", `created_at`, `read_at`). Tipos: `GroupInvitationReceived=1`,
`GroupInvitationAccepted=2`, `GroupInvitationDeclined=3`. A notificação de convite **não copia o
estado**: a resposta da API junta o estado atual do convite, de modo que, após aceitar/recusar/
cancelar, a mesma notificação mostra o estado final (FR-019) sem atualizar linhas antigas.
Cancelar um convite não gera notificação nova (a do convidado passa a mostrar "Convite cancelado").

Rotas: `GET /api/notifications?beforeId=&limit=` (paginação por cursor, mais recentes primeiro,
FR-020), `GET /api/notifications/unread-count`, `POST /api/notifications/read` com
`{ notificationIds }` (FR-021; só marca as do próprio usuário, FR-024).

**Racional**: modelo genérico pronto para outros tipos (Assumptions), consultas simples com índice
`(user_id, notification_id DESC)` e índice parcial `user_id WHERE read_at IS NULL` para o contador.

**Alternativas**: derivar notificações só dos convites (não serve para outros tipos nem para
"lida/não lida"); WebSocket/SignalR para tempo real (fora do escopo; SC-005 aceita atualização ao
trocar de tela).

## R-06 — Atualização do contador (SC-005)

**Decisão**: `NotificationContext` no frontend busca `unread-count` ao entrar no app, a cada troca
de rota (no máximo 1 vez a cada 10 s), ao voltar a aba para visível (`visibilitychange`) e a cada
60 s com a aba visível — mesmo padrão do `QuoteContext`. Após aceitar um convite, recarrega
famílias e carteiras (`GroupContext`/`WalletContext`).

**Racional**: atende "ao trocar de tela ou voltar ao app" sem infraestrutura de push.

## R-07 — Onde fica o sino (FR-017)

**Decisão**: componente `NotificationBell` (botão com `aria-label` "Notificações, N não lidas" e
selo numérico) no cabeçalho das três telas de aba (Home, Carteiras, Conta) no celular e no topo da
`Sidebar` no desktop; rota `/notificacoes` (tela de detalhe com "voltar"). Selo mostra "9+" acima
de 9. O `ux-designer` define posição e estados.

**Alternativas**: quarta aba na barra inferior (o pedido original fixou três abas); sino só na
Home (não atende "todas as telas principais").

## R-08 — Fluxo "Adicionar membro" na interface

**Decisão**: botão "Adicionar membro" no topo da seção Membros da tela da família (só responsável,
FR-001), abrindo uma folha com passos:

```text
email ──(Continuar → lookup)──▶ Available ──▶ nome/sobrenome ──▶ criar e incluir ──▶ fechado + toast
   │                          ├▶ Registered ──▶ "Convidar Ana Souza" ──▶ convite ──▶ fechado + toast
   │                          ├▶ AlreadyMember ──▶ aviso (voltar)
   │                          └▶ PendingInvite ──▶ aviso + "Cancelar convite"
   └─("Adicionar sem email")──▶ nome/sobrenome ──▶ criar e incluir
```

Seção "Convites pendentes" abaixo de Membros (só responsável, FR-015) com "Cancelar" via
`ConfirmModal`. A gestão antiga de membros dentro de "Gerenciar família" passa a ter só "Retirar
membro"; incluir sai de lá.

**Racional**: no máximo 3 passos para criar (SC-002) e 2 toques para aceitar (sino → Aceitar,
SC-006).

## R-09 — Testes

**Decisão**: backend — xUnit para `InvitationService` (convidar, duplicado, já membro, aceitar,
recusar, cancelar, resposta repetida, responsável trocado, permissões), `NotificationService`
(paginação, contador, marcar como lidas só as próprias), lookup e `members/new` (409 de email,
atomicidade com mock), regra nova do `POST members`. Frontend — Vitest + Testing Library + axe para
a folha de adicionar (4 status), seção de pendentes, sino (contador e "9+") e tela de notificações
(aceitar/recusar, estados finais, marcar como lidas). Validação manual no ambiente homolog (Docker),
agora disponível.

## R-10 — Distribuição entre agentes (Princípio VIII)

- `ux-designer`: mockups `add-member-sheet.html`, `notifications.html`, atualização de `group.html`
  (botão + convites pendentes) e do cabeçalho/sidebar com o sino.
- `dotnet-senior-developer`: entidades, migration `AddInvitationsAndNotifications`, serviços, rotas,
  regra do `POST members`, testes.
- `frontend-react-developer`: entidades Invitation/Notification (skill `react-architecture`),
  `NotificationContext`, sino, rota `/notificacoes`, folha de adicionar, seção de pendentes, testes.
