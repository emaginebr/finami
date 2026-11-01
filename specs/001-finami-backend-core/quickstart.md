# Quickstart: Núcleo do Backend do Finami

Guia para rodar a API localmente e validar os fluxos principais da spec ponta a ponta.

## Pré-requisitos

- .NET SDK 8+ (o SDK 9.0.309 instalado compila `net8.0`) **e** o runtime ASP.NET Core 8.
- `dotnet-ef` (instalado globalmente).
- Um PostgreSQL acessível (instância local ou remota). **Não** usar Docker no ambiente local
  (constituição, Princípio II).
- Um OAuth Client ID do Google (tipo "Web application") para testar o login Google — opcional
  para os demais fluxos.

## Configuração

Defina as variáveis de ambiente (PowerShell):

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:ConnectionStrings__FinamiContext = "Host=localhost;Port=5432;Database=finami;Username=finami;Password=***"
$env:Jwt__Secret = "<string aleatória com 32+ caracteres>"
$env:Jwt__Issuer = "finami"
$env:Jwt__Audience = "finami"
$env:Jwt__ExpirationMinutes = "480"
$env:Google__ClientId = "<client-id>.apps.googleusercontent.com"
```

## Build, migração e execução

```powershell
cd backend
dotnet build Finami.sln
dotnet ef database update --project Finami.Infra --startup-project Finami.API
dotnet run --project Finami.API
```

Swagger em `https://localhost:<porta>/swagger` (apenas em Development).

## Testes

```powershell
cd backend
dotnet test Finami.sln --filter "Category!=Integration"
# Testes de integração (concorrência com PostgreSQL real):
$env:FINAMI_TEST_DB = "Host=...;Database=finami_test;..."
dotnet test Finami.sln --filter "Category=Integration"
```

## Roteiro de validação (via Swagger ou `.http`)

1. **Cadastro e login (US1)** — `POST /api/auth/register` com Ana; `POST /api/auth/login`
   → guarde o `token`. `GET /api/auth/me` com o Bearer → 200. Senha errada → 401 genérico.
2. **Usuário sem login (US4)** — `POST /api/users` `{ "firstName": "Pedro", "lastName": "Silva" }`
   → `canLogin: false`.
3. **Grupo (US4)** — `POST /api/groups` `{ "name": "Família Silva" }`;
   `POST /api/groups/{id}/members` `{ "userId": <Pedro> }`.
4. **Carteiras (US2)** — Ana cria "Nubank" (BRL) e "Ledger" (BTC); cria para Pedro
   "Mesada" (BRL) com `ownerUserId` = Pedro e `groupId` = grupo.
5. **Entrada externa (US2)** — `POST /api/transactions/income` R$ 5.000,00 no Nubank →
   `GET /api/wallets/{nubank}` mostra `balance: 5000`.
6. **Cotação (US5)** — `GET /api/quotes/btc` → preço e `isStale: false`.
7. **Compra de BTC (US3)** — `POST /api/transactions/transfer/preview` Nubank → Ledger
   R$ 1.000; depois `POST /api/transactions/transfer` → `type: "BtcPurchase"`,
   `destinationAmount = trunc8(1000 / priceBrl)`.
8. **Venda de BTC (US3)** — transfira todo o saldo do Ledger para o Nubank → `type: "BtcSale"`.
9. **Transferência para outro usuário (US3)** — Nubank → Mesada R$ 100 → `Transfer`;
   `GET /api/wallets/{mesada}/public` mostra só nome, moeda e titular.
10. **Saldo insuficiente (US3)** — transfira mais que o saldo → 422, saldos inalterados.
11. **Estorno (US3)** — `POST /api/transactions/{id}/reverse` → nova transação `Reversal`;
    repetir → 409.
12. **Extratos (US6)** — `GET /api/statements/wallets/{nubank}?start=…&end=…`;
    `/users/{ana}`; `/groups/{grupo}`. Confira `closing = opening + totalIn − totalOut` por
    moeda e que a transferência Nubank → Mesada aparece com `internal: true` no extrato do grupo
    apenas se as duas carteiras estiverem vinculadas a ele.
13. **Visibilidade (US4/US6)** — com Pedro sem login, valide via um terceiro membro com login:
    `ResponsibleOnly` → 403; `PUT /api/groups/{id}` `{ "statementVisibility": "MembersSummary" }`
    → `detailLevel: "Summary"`; `AllMembers` → `Full`.
14. **Invariante contábil (SC-002)** — no banco:
    `SELECT transaction_id, currency, SUM(amount) FROM ledger_entries GROUP BY 1,2 HAVING SUM(amount) <> 0;`
    → nenhuma linha.
