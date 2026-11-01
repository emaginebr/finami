# UI Contract — Rotas, telas e chamadas à API

Rotas do React Router (todas em português). Rotas internas exigem sessão válida (FR-003); sem
sessão, redirecionam para `/entrar` guardando `state.from`.

| Rota | Tela | Navegação | Chamadas à API | Histórias |
|---|---|---|---|---|
| `/entrar` | Entrar (email/senha + Google) | pública | `POST /api/auth/login`, `POST /api/auth/google` | US1 |
| `/cadastro` | Criar conta | pública | `POST /api/auth/register` | US1 |
| `/` | **Home** — saldo total + carteiras por família e avulsas + cotação | aba Home | `GET /api/wallets`, `GET /api/groups`, `GET /api/quotes/btc` | US1 |
| `/carteiras` | **Carteiras** — famílias, carteiras, inativas; criar carteira e família | aba Carteiras | `GET /api/groups`, `GET /api/wallets?includeInactive=true`, `POST /api/wallets`, `POST /api/groups` | US4 |
| `/carteiras/:walletId` | Extrato da carteira + editar/desativar/excluir/vincular | push | `GET /api/wallets/{id}`, `GET /api/statements/wallets/{id}?start&end`, `PUT /api/wallets/{id}`, `PUT /api/wallets/{id}/group`, `POST /api/wallets/{id}/deactivate`, `DELETE /api/wallets/{id}`, `POST /api/transactions/{id}/reverse` | US3, US4 |
| `/familias/:groupId` | Família — total, saldo por membro; gestão (responsável) | push | `GET /api/groups/{id}`, `GET /api/groups/{id}/balances`, `PUT /api/groups/{id}`, `POST/DELETE /api/groups/{id}/members`, `POST /api/users`, `GET /api/users/search?email=` | US4, US5 |
| `/pessoas/:userId` | Membro — saldo e carteiras por família | push | `GET /api/users/{id}/group-balances` | US5 |
| `/conta` | Conta — dados, senha, Google, pessoas cadastradas, sair | aba Conta | `GET /api/auth/me`, `PUT /api/users/{id}`, `PUT /api/users/{id}/password`, `GET /api/users/created-by-me` | US6 |
| `*` | Página não encontrada | — | — | — |

"push" = tela de detalhe com botão "voltar" no cabeçalho (estilo iOS); a aba de origem continua
destacada na barra.

## Folha de transação (botão flutuante)

Disponível em `/`, `/carteiras` e `/carteiras/:walletId` (FR-009). No extrato, a carteira aberta
vem pré-selecionada.

| Passo | Conteúdo | Chamadas |
|---|---|---|
| 1. Tipo | Entrada · Saída · Transferência | — |
| 2. Formulário | carteira(s), valor, descrição | `GET /api/wallets` (já em memória); destino por código → `GET /api/wallets/{id}/public` |
| 3. Prévia (só transferência entre moedas ou para terceiro) | valores, cotação, titular do destino | `POST /api/transactions/transfer/preview` |
| 4. Envio | botão bloqueado durante o envio | `POST /api/transactions/income` · `/expense` · `/transfer` |
| 5. Resultado | toast de sucesso e saldos atualizados, ou erro na própria folha | — |

## Mapeamento de erros → interface

| Status | Exibição |
|---|---|
| 400 | Mensagem e erros do envelope junto aos campos / no topo do formulário |
| 401 | Sessão encerrada → `/entrar` com "Sua sessão expirou" |
| 403 | Estado "Sem permissão" na tela (não toast) |
| 404 | "Não encontrado" com botão voltar |
| 409 / 422 | Mensagem do servidor na folha/formulário (ex.: "Saldo insuficiente…") |
| 503 | Aviso de cotação indisponível; conversão bloqueada |
| 500 / rede | "Não foi possível conectar" + "Tentar novamente"; formulário preservado |

## Componentes de layout (especificados pelo `ux-designer`)

`AppShell` (TabBar no celular, Sidebar a partir de 768 px), `LargeTitleHeader`, `Fab`,
`Sheet`/`Modal`/`ConfirmModal` (Radix Dialog), `WalletCard`, `WalletSection`, `BalanceHero`,
`MemberRow`, `StatementTotals`, `StatementEntryRow`, `PeriodPicker`, `MoneyInput`,
`SegmentedControl`, `EmptyState`, `ErrorState`, `Skeleton`, `AppIcon`, `Logo`.
