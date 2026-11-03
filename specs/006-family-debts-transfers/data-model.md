# Data Model: Dívidas entre pessoas e transferências dentro da família

**Feature**: `006-family-debts-transfers` · **Data**: 2026-11-03

Nenhuma tabela nova. A única mudança de esquema são dois índices (R-11). As entidades novas são
**derivadas** (calculadas na leitura) e existem só como DTOs.

## Esquema (PostgreSQL)

### `transactions` (existente) — novos índices

| Índice | Colunas | Motivo |
|---|---|---|
| `ix_transactions_source_account_id` | `source_account_id` | Cálculo de dívidas e destinos (R-11) |
| `ix_transactions_destination_account_id` | `destination_account_id` | Idem |

Migration: `AddTransactionAccountIndexes` (via `dotnet ef migrations add`, skill
`dotnet-architecture`). Sem alteração de colunas nem de dados.

Colunas já existentes reaproveitadas:

- `btc_quote_id`, `quote_price_brl` — passam a ser preenchidas também em `Transfer` BTC → BTC quando
  o valor foi informado em reais pelo MCP (R-07). Hoje só são usadas em conversões.

## Entidades derivadas

### Dívida entre pessoas (`PersonDebt`)

Calculada por pessoa P (titular) a partir de `transactions` ⨝ `accounts` (origem) ⨝ `accounts`
(destino):

```
movimentos de P = transações t onde
    origem.kind = Wallet  e  destino.kind = Wallet
    origem.currency = destino.currency
    origem.user_id <> destino.user_id
    (origem.user_id = P  ou  destino.user_id = P)

para cada contraparte Q e moeda M:
    recebido = Σ t.destination_amount  onde destino.user_id = P e origem.user_id = Q
    enviado  = Σ t.source_amount       onde origem.user_id  = P e destino.user_id = Q
    saldo    = recebido − enviado            (> 0: P deve a Q;  < 0: Q deve a P)
```

| Campo | Tipo | Regra |
|---|---|---|
| `counterpartUserId` | long | Titular do outro lado |
| `counterpartName` | string | Nome completo da contraparte |
| `counterpartFirstName` | string | Primeiro nome |
| `currency` | `BRL` \| `BTC` | Uma linha por moeda (FR-004) |
| `amount` | decimal > 0 | `abs(saldo)`; escala 2 (BRL) ou 8 (BTC) |
| `direction` | `owes` \| `owed` | `owes` = a pessoa da página deve à contraparte; `owed` = a contraparte deve a ela |

- Pares com `saldo = 0` não são devolvidos (FR-007).
- Ordenação: por nome da contraparte (pt-BR), depois BRL antes de BTC.
- Mesma moeda dos dois lados ⇒ `source_amount = destination_amount`; o cálculo usa o lado
  correspondente por clareza.

### Destino de transferência (`TransferDestination`)

| Campo | Tipo | Regra |
|---|---|---|
| `walletId` | long | |
| `name` | string | Nome da carteira |
| `currency` | `BRL` \| `BTC` | |
| `ownerUserId` | long | Titular |
| `ownerFirstName` | string | Primeiro nome do titular |
| `isOwn` | bool | `ownerUserId == titular da origem` |
| `balance` | decimal? | `null` quando quem consulta não pode ver o extrato da carteira (FR-018) |

Grupos devolvidos para uma origem O (titular T):

- `sameCurrency`: carteiras ativas com `currency = O.currency`, `id <> O.id`, cujo titular é T ou
  divide ao menos uma família com T. Ordenação: as do próprio T primeiro, depois por primeiro nome
  e nome da carteira.
- `conversion`: carteiras ativas de T com `currency <> O.currency`.

## Alterações em DTOs existentes

### `WalletInfo`

| Campo novo | Tipo | Regra |
|---|---|---|
| `ownerFirstName` | string | Primeiro nome do titular (campo `first_name` do usuário) |

### `TransferInfo`

| Campo | Tipo | Regra |
|---|---|---|
| `amount` | decimal? (era obrigatório) | Valor na moeda da origem |
| `amountBrl` | decimal? (novo) | Valor em reais; só com origem e destino em BTC |

Validação (`TransferInfoValidator`):

- exatamente um entre `amount` e `amountBrl` (> 0); mensagem "Informe o valor em bitcoin ou em
  reais.";
- `amountBrl` com no máximo 2 casas;
- `amountBrl` com origem/destino que não sejam ambos BTC → 400 "Valor em reais só vale para
  transferência entre carteiras de bitcoin.".

### `TransferPreviewResult`

Sem campos novos: `sourceAmount` passa a refletir o valor em BTC calculado a partir de `amountBrl`,
e `quote` vem preenchido nesse caso.

## Regras de validação de transferência (ordem em `PlanTransferAsync`)

1. Validação do DTO (incluindo `amount`/`amountBrl`).
2. Carregar origem; `EnsureCanControlWalletAsync` (existente).
3. Carregar destino; origem e destino ativos (existente).
4. **Novo** — titulares diferentes e moedas diferentes → 422 conversão só no mesmo titular (R-04).
5. **Novo** — titulares diferentes e sem família em comum → 422 só para a família (R-03).
6. Se `amountBrl`: cotação → `amount = trunc8(amountBrl / preço)`; 0 → 422 "Valor pequeno demais
   para conversão.".
7. Conversão (moedas diferentes, mesmo titular) segue como hoje.

## Transições de estado

Nenhuma. Dívidas mudam só como efeito de transações e estornos.
