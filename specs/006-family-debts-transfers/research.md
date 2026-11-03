# Research: Dívidas entre pessoas e transferências dentro da família

**Feature**: `006-family-debts-transfers` · **Data**: 2026-11-03

Não havia `NEEDS CLARIFICATION` técnico no Technical Context; as decisões abaixo resolvem as
escolhas de desenho que a spec deixa em aberto.

## R-01 — Dívida derivada do razão, sem tabela nova

- **Decision**: a dívida entre duas pessoas é **calculada na leitura** a partir das transações já
  gravadas. Entra no cálculo toda transação cuja origem e destino são **carteiras** de **titulares
  diferentes** e da **mesma moeda** — na prática, `Transfer` e `Reversal` de uma `Transfer`. Para a
  pessoa P e a contraparte Q, na moeda M:
  `saldo(P, Q, M) = Σ valor(Q → P) − Σ valor(P → Q)`; positivo = **P deve a Q**.
- **Rationale**:
  - O estorno de uma transferência A→B é gravado como B→A (mesma moeda, titulares trocados), então
    ele compensa a dívida sozinho (FR-006), sem regra especial.
  - Conversões (`BtcPurchase`/`BtcSale`) e os estornos delas têm moedas diferentes na origem e no
    destino e ficam fora automaticamente (FR-003).
  - Inclui o histórico anterior à feature (FR-005) sem migração de dados.
  - Uma fonte só da verdade: não há como a dívida divergir do razão (SC-001).
- **Alternatives considered**:
  - Tabela `debts` atualizada a cada transação: duplica estado, exige backfill e cuidado com
    concorrência e estornos. Rejeitada.
  - View materializada no PostgreSQL: ganho de desempenho desnecessário na escala de uma família.

## R-02 — Titular, não quem lança

- **Decision**: a dívida usa `accounts.user_id` (titular) das duas carteiras; `created_by_user_id` da
  transação não entra.
- **Rationale**: FR-001 e cenário 6 da US1 (responsável lançando pelo dependente).

## R-03 — Regra "pessoas da família"

- **Decision**: o destino é válido se `titular(destino) == titular(origem)` **ou** os dois titulares
  têm ao menos uma família em comum (`IGroupRepository.ShareGroupAsync`, já existente). Avaliado no
  `LedgerService.PlanTransferAsync`, que atende app, API, preview e MCP (FR-012).
- **Rationale**: um único ponto de validação cobre todos os canais; reaproveita a consulta de
  famílias em comum.
- **Mensagem**: `BusinessRuleException("Só é possível transferir para pessoas da sua família.")`
  (HTTP 422, como as demais regras de negócio).
- **Alternatives considered**: usar `accounts.group_id` (carteira vinculada à família) — rejeitado:
  carteiras avulsas de membros ficariam de fora, e a spec fala de pessoas, não de carteiras.

## R-04 — Conversão só no mesmo titular

- **Decision**: se `origem.Currency != destino.Currency` e os titulares forem diferentes →
  `BusinessRuleException("Conversão entre real e bitcoin só entre carteiras da mesma pessoa.")`.
  Verificado antes de buscar a cotação (não consome a API de cotação à toa).

## R-05 — Lista do campo Para no servidor

- **Decision**: novo endpoint `GET /api/wallets/{id}/transfer-destinations` que devolve dois grupos:
  `sameCurrency` (carteiras ativas da mesma moeda do titular da origem e das pessoas da família, sem a
  origem) e `conversion` (carteiras ativas do próprio titular na outra moeda). Cada item traz
  `ownerFirstName` e `balance` (nulo quando quem consulta não pode ver o extrato daquela carteira —
  `IAccessPolicy.CanViewWalletStatementAsync`).
- **Rationale**: a mesma regra de R-03/R-04 decide a lista e a validação; o frontend não precisa
  juntar saldos de várias famílias; o saldo oculto respeita a visibilidade (FR-018).
- **Alternatives considered**: montar a lista no frontend a partir de `/api/groups/{id}/balances`
  de cada família — várias chamadas, regra duplicada no cliente e risco de divergir da validação.

## R-06 — Campo De

- **Decision**: o De continua vindo de `GET /api/wallets` (carteiras que a pessoa controla); o
  `WalletInfo` ganha `ownerFirstName`. O frontend mostra ícone pela `currency`, primeiro nome e
  `balance` (já presente).
- **Rationale**: mudança aditiva e compatível; evita quebrar o nome completo usado em outras telas.

## R-07 — Transferência de bitcoin informada em reais

- **Decision**: `TransferInfo` ganha `amountBrl` (opcional). Regras:
  - exatamente um entre `amount` e `amountBrl` (validador);
  - `amountBrl` só é aceito com origem **e** destino em bitcoin (senão 400);
  - `amount = trunc8(amountBrl / cotação)`; resultado 0 → "Valor pequeno demais para conversão.";
  - a cotação usada é gravada na transação (`btc_quote_id`, `quote_price_brl`, colunas já
    existentes) e devolvida no preview.
  - No app, o fluxo é: preview com `amountBrl` → a confirmação mostra o valor em BTC e a cotação →
    o registro envia **`amount` em BTC** igual ao do preview. Assim o valor gravado é exatamente o
    confirmado, mesmo que a cotação mude entre os dois passos (SC-005).
  - No MCP, `registrar_transferencia` aceita `valor_em_reais` e converte na hora (o preview continua
    disponível para quem quiser confirmar antes).
- **Alternatives considered**: travar a cotação do preview por um token/expiração — mais estado
  no servidor sem ganho real para o app, que já reenvia o valor em BTC.

## R-08 — Botão flutuante em todas as telas

- **Decision**: em `AppShell`, trocar a lista de rotas permitidas (`/`, `/carteiras`,
  `/carteiras/:walletId`) por uma lista de exclusão: `/depositar`, `/sacar`, `/transferir`. A tela
  `/autorizar` já fica fora do `AppShell`. A pré-seleção pelo `walletId` do extrato continua.
- **Rationale**: FR-024/025 com mudança mínima; telas novas passam a ter o botão por padrão.
- **Cuidado**: páginas com rodapé fixo ou botões no fim da tela precisam do espaço inferior já
  reservado para o Fab (o padding de `<main>` hoje só é aplicado quando `fab.show`).

## R-09 — Remoção do destino por código público

- **Decision**: o frontend remove o modo "código da carteira" do Para (FR-013). O endpoint
  `GET /api/wallets/{id}/public` fica no backend (não é mais usado pelo app) — a regra de família no
  servidor já impede transferir para fora.
- **Alternatives considered**: remover o endpoint — mudança de contrato sem benefício de
  segurança; pode ser removido numa limpeza futura.

## R-10 — Dívidas na página da pessoa e no MCP

- **Decision**:
  - `GET /api/users/{userId}/debts` (autorização: `IAccessPolicy.CanViewUserAsync`, a mesma da
    página da pessoa) devolve a lista por contraparte e moeda, sem pares quites.
  - MemberPage ganha a seção "Dívidas" (layout pelo `ux-designer`, Princípio VIII).
  - MCP: nova ferramenta `dividas_da_pessoa` (somente leitura; sem `pessoa_id` = pessoa conectada) e
    `destinos_de_transferencia`; descrições de `previa_transferencia`/`registrar_transferencia`
    atualizadas com as regras novas e o parâmetro `valor_em_reais`.
- **Rationale**: FR-007/008/009 com as regras de visibilidade já existentes.

## R-11 — Desempenho do cálculo

- **Decision**: consulta única agrupada (`GROUP BY` contraparte, moeda) sobre `transactions` com
  `JOIN` nas duas `accounts`, filtrando as transações em que a pessoa é titular da origem ou do
  destino. **Correção na implementação**: os índices em `source_account_id` e
  `destination_account_id` já existiam (criados pelo EF em `AddWalletsAndLedger` como
  `IX_transactions_*`); a migration `AddTransactionAccountIndexes` só os renomeia para o padrão
  `ix_transactions_*`. `accounts(user_id)` já tem `ix_accounts_user_id`.
- **Rationale**: sem os índices a consulta varre a tabela inteira a cada abertura da página da pessoa;
  com eles, o custo fica proporcional às transações da própria pessoa.
- **Follow-up**: se passar de ~200 ms em produção, avaliar cache por pessoa invalidado por
  `ledgerVersion`.
