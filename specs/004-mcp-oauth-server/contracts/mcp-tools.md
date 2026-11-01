# Contrato — Ferramentas, recursos e prompts do MCP (feature 004)

Endpoint: `POST {base}/mcp` (Streamable HTTP, stateless). Autenticação: `Authorization: Bearer
fma_…` (ver `oauth.md`). Implementação: **dotnet-senior-developer** em `Finami.API/Mcp/`.

## Regras comuns

- Nome em snake_case português sem acento; descrição e parâmetros em português, com unidade e
  exemplo. Parâmetros de id são `long`; valores são **número decimal** na moeda da carteira
  (BRL com até 2 casas, BTC com até 8); datas `AAAA-MM-DD` (fuso America/Sao_Paulo).
- Resultado de sucesso: `structuredContent` = DTO do domínio (mesmos campos camelCase da API) e
  `content[0].text` = resumo em português (ex.: "Despesa de R$ 80,00 registrada em Nubank. Saldo:
  R$ 1.420,00.").
- Resultado de erro: `isError: true`, `content[0].text` = mesma mensagem do app,
  `structuredContent = { "codigo": "...", "mensagem": "...", "erros": [...] }`. Códigos:
  `validacao` (400), `nao_encontrado` (404), `sem_permissao` (403), `conflito` (409),
  `regra_de_negocio` (422), `cotacao_indisponivel` (503), `permissao_insuficiente` (escopo),
  `erro_interno`.
- Escopo: **R** = `finami:read`; **W** = `finami:write`. Sem W, ferramenta W →
  `permissao_insuficiente` "Esta conexão só permite consultas. Reconecte o assistente
  permitindo alterações." e nada é executado.
- Anotações: `ro` = `readOnlyHint`; `dst` = `destructiveHint`; `idem` = `idempotentHint`.
  Ferramentas W sem `dst` levam `destructiveHint: false`.
- `chave_repeticao?` (string ≤ 64): repetição segura (research R-08) nas ferramentas marcadas ⟲.
- Listas paginadas: `limite?` (1–50, padrão 20) e `cursor?`; resposta inclui `proximoCursor`
  (null no fim).

## Ferramentas de leitura (R, `ro`)

| Ferramenta | Parâmetros | Serviço de domínio |
|---|---|---|
| `obter_perfil` | — | `IAuthService.GetMeAsync` |
| `saldo_total` | — | cálculo da Home (`IWalletService.ListAsync` + `IQuoteService`) → `{ totalBrl, porMoeda: {BRL, BTC}, cotacao }` |
| `listar_carteiras` | `familia_id?`, `dono_id?`, `incluir_inativas?` | `IWalletService.ListAsync` |
| `obter_carteira` | `carteira_id` | `IWalletService.GetAsync` |
| `listar_familias` | — | `IGroupService.ListMineAsync` |
| `obter_familia` | `familia_id` | `IGroupService.GetAsync` (com membros) |
| `saldos_da_familia` | `familia_id` | `IBalanceService.GetGroupBalancesAsync` |
| `saldos_da_pessoa` | `pessoa_id` | `IBalanceService.GetUserGroupBalancesAsync` |
| `extrato_carteira` | `carteira_id`, `inicio`, `fim`, `limite?`, `cursor?` | `IStatementService.GetWalletStatementAsync` (+ paginação R-12) |
| `extrato_pessoa` | `pessoa_id`, `inicio`, `fim`, `limite?`, `cursor?` | `GetUserStatementAsync` |
| `extrato_familia` | `familia_id`, `inicio`, `fim`, `limite?`, `cursor?` | `GetGroupStatementAsync` |
| `obter_lancamento` | `lancamento_id` | `ILedgerService.GetAsync` |
| `cotacao_bitcoin` | — | `IQuoteService.GetCurrentAsync` |
| `listar_notificacoes` | `limite?`, `cursor?` | `INotificationService.ListAsync` (cursor = `beforeId`) |
| `contar_notificacoes_nao_lidas` | — | `INotificationService.CountUnreadAsync` |
| `listar_convites_da_familia` | `familia_id`, `status?` (`Pending` padrão) | `IInvitationService.ListByGroupAsync` |
| `verificar_email_para_familia` | `familia_id`, `email` | `IGroupService.LookupMemberAsync` |
| `listar_pessoas_criadas_por_mim` | — | `IUserService.ListCreatedByMeAsync` |

## Ferramentas de escrita (W)

| Ferramenta | Parâmetros | Anot. | Serviço |
|---|---|---|---|
| `registrar_receita` | `carteira_id`, `valor`, `descricao?`, `chave_repeticao?` | ⟲ | `ILedgerService.IncomeAsync` |
| `registrar_despesa` | `carteira_id`, `valor`, `descricao?`, `chave_repeticao?` | ⟲ | `ExpenseAsync` |
| `previa_transferencia` | `carteira_origem_id`, `carteira_destino_id`, `valor`, `descricao?` | `ro` (exige só R) | `PreviewTransferAsync` |
| `registrar_transferencia` | `carteira_origem_id`, `carteira_destino_id`, `valor` (na moeda da origem), `descricao?`, `chave_repeticao?` | ⟲ | `TransferAsync` |
| `estornar_lancamento` | `lancamento_id`, `motivo?` | `dst`, `idem` | `ReverseAsync` |
| `criar_carteira` | `nome`, `moeda` (`BRL`/`BTC`), `descricao?`, `familia_id?`, `dono_id?`, `virtual?`, `chave_repeticao?` | ⟲ | `IWalletService.CreateAsync` |
| `atualizar_carteira` | `carteira_id`, `nome?`, `descricao?`, `virtual?` | `idem` | `UpdateAsync` |
| `mover_carteira_de_familia` | `carteira_id`, `familia_id?` (null = pessoal) | `idem` | `SetGroupAsync` |
| `desativar_carteira` | `carteira_id` | `dst`, `idem` | `DeactivateAsync` |
| `excluir_carteira` | `carteira_id` | `dst` | mesma regra do `DELETE /api/wallets/{id}` |
| `criar_familia` | `nome`, `chave_repeticao?` | ⟲ | `IGroupService.CreateAsync` |
| `renomear_familia` | `familia_id`, `nome` | `idem` | `UpdateAsync` |
| `criar_pessoa_na_familia` | `familia_id`, `nome`, `sobrenome`, `email?`, `chave_repeticao?` | ⟲ | `CreateMemberAsync` |
| `convidar_para_familia` | `familia_id`, `email`, `chave_repeticao?` | ⟲ | `IInvitationService.InviteAsync` |
| `cancelar_convite` | `familia_id`, `convite_id` | `dst`, `idem` | `CancelAsync` |
| `retirar_membro` | `familia_id`, `pessoa_id` | `dst`, `idem` | `RemoveMemberAsync` |
| `aceitar_convite` | `convite_id` | `idem` | `AcceptAsync` |
| `recusar_convite` | `convite_id` | `dst`, `idem` | `DeclineAsync` |
| `marcar_notificacoes_como_lidas` | `notificacao_ids[]` (1–100) | `idem` | `INotificationService.MarkReadAsync` |
| `atualizar_perfil` | `nome`, `sobrenome` | `idem` | `IUserService.UpdateAsync` (self) |

Toda ferramenta W registra auditoria (research R-09). Fora do MCP (FR-020): senha, cadastro,
login, exclusão de conta, gestão de conexões.

## Recursos (R)

| URI | Conteúdo |
|---|---|
| `finami://perfil` | `obter_perfil` |
| `finami://carteiras` | carteiras ativas com saldo |
| `finami://familias` | famílias com membros |
| `finami://notificacoes/nao-lidas` | contador + 20 mais recentes não lidas |

## Prompts

| Prompt | Argumentos | Objetivo |
|---|---|---|
| `resumo_do_mes` | `mes?` (`AAAA-MM`, padrão mês atual) | Saldo total + extrato de cada carteira no mês, maiores despesas |
| `registrar_gasto` | `descricao`, `valor`, `carteira?` | Guia: achar a carteira, confirmar com a pessoa e chamar `registrar_despesa` |
| `revisar_convites` | — | Listar notificações de convite pendentes e perguntar o que fazer |

## Servidor

`serverInfo`: `{ name: "finami", title: "Finami", version: <versão do assembly> }`;
`instructions` (pt-BR): "Finami é o app de finanças da família. Valores em reais (BRL) e bitcoin
(BTC). Antes de alterar dados, confirme com a pessoa. Use `listar_carteiras` para descobrir ids."

## Testes esperados

- `tools/list` sem token → 401 com `WWW-Authenticate`; com token → as 38 ferramentas, com escopo e
  anotações.
- Cada área: chamada com sucesso devolve DTO igual ao do controller equivalente; id de outra
  pessoa → `nao_encontrado`/`sem_permissao`; ferramenta W com conexão R → `permissao_insuficiente`
  e serviço não chamado.
- `registrar_despesa` com a mesma `chave_repeticao` 100× → 1 lançamento.
- `extrato_carteira` paginado: concatenação das páginas = extrato completo.
