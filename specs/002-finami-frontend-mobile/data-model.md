# Data Model — Frontend do Finami

O frontend não tem banco. Este documento define os **tipos TypeScript** (espelho dos DTOs do
backend, em `src/types/`), o **estado local** (sessão, Contexts) e as **transições de estado** da
folha de transação. Convenções: `interface` (nunca `type`), campos camelCase, nulos como
`| null` (Princípio IV e skill `react-architecture`).

## 1. Tipos comuns — `types/api.ts`

| Interface | Campos | Observação |
|---|---|---|
| `ErrorResult` | `sucesso: boolean`, `mensagem: string`, `erros: string[] \| null` | Envelope de erro do backend |
| `ApiError` (classe) | `status: number`, `mensagem: string`, `erros: string[]` | Lançada por `handleResponse` |
| `Currency` (enum string) | `BRL`, `BTC` | |

## 2. Sessão — `types/auth.ts`

| Interface | Campos |
|---|---|
| `AuthSession` | `token: string`, `expiresAt: string` (ISO), `user: UserInfo` |
| `AuthResult` | `token`, `expiresAt`, `isNewUser: boolean`, `user: UserInfo` |
| `LoginInfo` | `email`, `password` |
| `RegisterInfo` | `firstName`, `lastName`, `email`, `password` |
| `GoogleLoginInfo` | `idToken` |

**Persistência**: `localStorage["finami:auth"] = JSON.stringify(AuthSession)`.
**Regras**: sessão inválida se `expiresAt <= agora` ou JSON corrompido → removida.

**Estados da sessão**: `checking` (lendo storage) → `anonymous` | `authenticated`;
`authenticated` → `anonymous` em "Sair", 401 ou expiração.

## 3. Pessoa — `types/user.ts`

| Interface | Campos |
|---|---|
| `UserInfo` | `userId`, `firstName`, `lastName`, `email: string \| null`, `hasPassword`, `hasGoogle`, `canLogin`, `createdByUserId: number \| null`, `createdAt` |
| `UserInsertInfo` | `firstName`, `lastName`, `email: string \| null`, `password: string \| null` |
| `UserUpdateInfo` | `firstName`, `lastName`, `email: string \| null` |
| `PasswordChangeInfo` | `currentPassword: string \| null`, `newPassword` |
| `UserSearchInfo` | `userId`, `firstName`, `lastName` |

Validação no formulário: nome e sobrenome obrigatórios (até 120 caracteres); email com formato
válido quando informado (até 254); senha com no mínimo 8 caracteres (`MIN_PASSWORD_LENGTH` do backend).

## 4. Família — `types/group.ts`

| Interface | Campos |
|---|---|
| `StatementVisibility` (enum) | `ResponsibleOnly`, `AllMembers`, `MembersSummary` |
| `GroupMemberInfo` | `userId`, `firstName`, `lastName`, `joinedAt` |
| `GroupInfo` | `groupId`, `name`, `responsibleUserId`, `isResponsible`, `statementVisibility`, `members: GroupMemberInfo[]` |
| `GroupInsertInfo` | `name` |
| `GroupUpdateInfo` | `name: string \| null`, `statementVisibility: StatementVisibility \| null` |
| `AddMemberInfo` | `userId` |

Rótulos exibidos para `StatementVisibility`: "Somente o responsável", "Todos os membros",
"Membros veem só os totais".

## 5. Carteira — `types/wallet.ts`

| Interface | Campos |
|---|---|
| `WalletInfo` | `walletId`, `name`, `description: string \| null`, `currency`, `isVirtual`, `isActive`, `ownerUserId`, `ownerName`, `groupId: number \| null`, `balance: number`, `estimatedBrl: number \| null`, `canControl`, `createdAt` |
| `WalletInsertInfo` | `name`, `description: string \| null`, `currency`, `isVirtual`, `ownerUserId: number \| null`, `groupId: number \| null` |
| `WalletUpdateInfo` | `name`, `description: string \| null`, `isVirtual` |
| `WalletGroupInfo` | `groupId: number \| null` |
| `WalletPublicInfo` | `walletId`, `name`, `currency`, `ownerName`, `isActive` |

Validação: nome obrigatório (até 120), descrição até 500, moeda obrigatória e imutável após
criar.

**Derivados (utilitários puros)**:
- `HomeSection` = `{ key: string; title: string; groupId: number | null; wallets: WalletInfo[] }`
  — gerado por `groupWallets(wallets, groups)`: famílias em ordem alfabética, depois "Avulsas".
- `HomeTotal` = `{ totalCents: number; btcExcluded: boolean }` — gerado por
  `computeHomeTotal(wallets, userId, quoteAvailable)` somando em centavos as carteiras ativas de
  que o usuário é titular.

## 6. Transação — `types/transaction.ts`

| Interface | Campos |
|---|---|
| `TransactionType` (enum) | `ExternalIncome`, `ExternalExpense`, `Transfer`, `BtcPurchase`, `BtcSale`, `Reversal` |
| `AccountRef` | `accountId`, `name`, `kind`, `currency`, `ownerName: string \| null` |
| `QuoteRef` | `priceBrl`, `quotedAt`, `source` |
| `TransactionInfo` | `transactionId`, `type`, `source: AccountRef`, `destination: AccountRef`, `sourceAmount`, `destinationAmount`, `quote: QuoteRef \| null`, `description: string \| null`, `occurredAt`, `createdByUserId`, `reversedTransactionId: number \| null`, `reversedByTransactionId: number \| null` |
| `IncomeExpenseInfo` | `walletId`, `amount: string`, `description: string \| null` |
| `TransferInfo` | `sourceWalletId`, `destinationWalletId`, `amount: string`, `description: string \| null` |
| `TransferPreviewResult` | `type`, `sourceAmount`, `destinationAmount`, `quote: QuoteRef \| null` |
| `ReverseInfo` | `description: string \| null` |

`amount` é **string decimal** com ponto (research R-09).

### Máquina de estados da folha de transação

```text
closed ──(+)──▶ chooseType ──(tipo)──▶ form
form ──(valida ok; mesma moeda e destino próprio)──▶ submitting
form ──(valida ok; moedas diferentes ou destino de terceiro)──▶ preview
preview ──(confirmar)──▶ submitting      preview ──(voltar)──▶ form
preview ──(503 cotação)──▶ preview[bloqueado]
submitting ──(201)──▶ closed + toast + refreshWallets + ledgerVersion++
submitting ──(4xx/5xx)──▶ form[erro do servidor, dados preservados]
qualquer ──(fechar/Esc)──▶ closed
```

Regras de validação em `form`: carteira(s) obrigatória(s); origem ≠ destino; valor > 0; casas
decimais ≤ 2 (BRL) ou ≤ 8 (BTC) conforme a moeda da carteira de origem (ou da carteira única em
Entrada/Saída); descrição até 500 caracteres.

## 7. Cotação — `types/quote.ts`

`BtcQuoteInfo` = `priceBrl`, `quotedAt`, `source`, `isStale`. Estados na interface: `loading`,
`available`, `stale` (exibe selo), `unavailable` (503).

## 8. Extrato — `types/statement.ts`

| Interface | Campos |
|---|---|
| `StatementScope` (enum) | `Wallet`, `User`, `Group` |
| `StatementTotalInfo` | `currency`, `openingBalance`, `totalIn`, `totalOut`, `closingBalance` |
| `StatementEntryInfo` | `transactionId`, `occurredAt`, `type`, `sourceName`, `destinationName`, `currency`, `amount` (com sinal), `quotePriceBrl: number \| null`, `description: string \| null`, `internal` |
| `StatementResult` | `scope`, `scopeId`, `start`, `end`, `detailLevel: "Full" \| "Summary"`, `totals`, `entries` |
| `StatementPeriod` | `preset: "thisMonth" \| "lastMonth" \| "last30" \| "custom"`, `start` (yyyy-MM-dd), `end` |

Validação de período: `start ≤ end` e no máximo 366 dias.
Para exibir "estornado" e a ação "Estornar", a tela consulta `GET /api/transactions/{id}` sob
demanda ao abrir o lançamento.

## 9. Saldos por membro — `types/balance.ts` (rotas novas)

| Interface | Campos |
|---|---|
| `DetailLevel` (enum) | `Full`, `Summary`, `Hidden` |
| `WalletBalanceInfo` | `walletId`, `name`, `currency`, `isVirtual`, `balance`, `estimatedBrl: number \| null`, `canViewStatement` |
| `MemberBalanceInfo` | `userId`, `firstName`, `lastName`, `isResponsible`, `balanceBrl \| null`, `balanceBtc \| null`, `estimatedBrl \| null`, `totalBrl \| null`, `wallets: WalletBalanceInfo[]` |
| `GroupBalancesResult` | `groupId`, `name`, `statementVisibility`, `isResponsible`, `detailLevel`, `quote: { priceBrl, quotedAt, isStale } \| null`, `btcExcluded`, `totalBrl: number \| null`, `members: MemberBalanceInfo[]` |
| `UserGroupBalanceInfo` | `groupId`, `name`, `detailLevel`, `balanceBrl`, `balanceBtc`, `estimatedBrl \| null`, `totalBrl`, `wallets: WalletBalanceInfo[]` |
| `UserGroupBalancesResult` | `userId`, `firstName`, `lastName`, `btcExcluded`, `totalBrl`, `groups: UserGroupBalanceInfo[]` |

Regras de apresentação: `Hidden` → lista de membros sem valores + explicação (FR-031);
`Summary` → valores por membro, sem lista de carteiras; `Full` → valores e carteiras, que abrem o
extrato quando `canViewStatement`.

## 10. Contexts (estado em memória)

| Context | Estado | Métodos principais |
|---|---|---|
| `AuthContext` | `session`, `status`, `loading`, `error` | `login`, `loginWithGoogle`, `register`, `logout`, `refreshMe`, `clearError` |
| `UserContext` | `createdByMe`, `loading`, `error` | `createUser`, `updateUser`, `changePassword`, `searchByEmail`, `loadCreatedByMe` |
| `GroupContext` | `groups`, `loading`, `error` | `loadGroups`, `getGroup`, `createGroup`, `updateGroup`, `addMember`, `removeMember` |
| `WalletContext` | `wallets`, `loading`, `error` | `loadWallets`, `refreshWallets`, `getWallet`, `createWallet`, `updateWallet`, `setWalletGroup`, `deactivateWallet`, `deleteWallet`, `getPublicWallet` |
| `QuoteContext` | `quote`, `status` | `loadQuote` (refaz a cada 60 s com a aba visível) |
| `TransactionContext` | `ledgerVersion`, `loading`, `error` | `createIncome`, `createExpense`, `createTransfer`, `previewTransfer`, `reverse`, `getTransaction` |
| `StatementContext` | `loading`, `error` | `getWalletStatement`, `getUserStatement`, `getGroupStatement` |
| `BalanceContext` | `loading`, `error` | `getGroupBalances`, `getUserGroupBalances` |

Ordem dos providers em `main.tsx`: `AuthProvider` → `QuoteProvider` → `UserProvider` →
`GroupProvider` → `WalletProvider` → `TransactionProvider` → `StatementProvider` →
`BalanceProvider` → `App` (o `TransactionProvider` depende do `WalletProvider` para
`refreshWallets`).
