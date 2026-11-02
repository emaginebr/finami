# Contrato — Cache offline e `apiFetch` (feature 005)

Implementação: **frontend-react-developer** em `frontend/src/Services/apiHelpers.ts` e
`frontend/src/utils/offlineCache.ts`.

## `apiFetch` — opções novas

```ts
interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  authenticated?: boolean;
  signal?: AbortSignal;
  /** "network-first": só para GET autenticado de consulta. Padrão "none". */
  cache?: "network-first" | "none";
  /** Recebe a procedência do dado (para o indicador de dados antigos) */
  onFreshness?: (info: { stale: boolean; fetchedAt: string }) => void;
}
```

Comportamento:

| Situação | Resultado |
|---|---|
| GET `network-first`, resposta 2xx | devolve o JSON, grava no cache, `onFreshness({stale:false, fetchedAt: agora})`, reporta online |
| GET `network-first`, resposta não 2xx | lança `ApiError` como hoje; não grava; reporta online |
| GET `network-first`, falha de rede ou 10 s sem resposta, **com** registro | devolve o guardado, `onFreshness({stale:true, fetchedAt})`, reporta offline |
| idem, **sem** registro | lança `ApiError(0, "Este conteúdo não está disponível sem internet.")` com `offline: true` |
| Método ≠ GET com conectividade `offline` | lança `ApiError(0, "Sem internet. Conecte-se para fazer lançamentos.")` **sem** chamar `fetch` |
| Método ≠ GET e a rede cai durante a chamada | `ApiError(0, NETWORK_ERROR_MESSAGE)` como hoje; nunca reenvia |
| `cache: "none"` | igual a hoje + timeout de 10 s + reporta conectividade |
| 401 | handler atual + `offlineCache.clearAll()` |

## GETs que usam `network-first`

| Serviço | Chamada |
|---|---|
| `authService` | `me` |
| `walletService` | lista, detalhe |
| `balanceService` | saldos da família, saldos da pessoa |
| `groupService` | lista, detalhe |
| `statementService` | extrato de carteira, de pessoa e de família |
| `notificationService` | lista (primeira página), contador de não lidas |
| `quoteService` | cotação BTC |
| `userService` | detalhe, criados por mim |
| `transactionService` | detalhe do lançamento |
| `invitationService` | convites pendentes da família |

**Nunca** cacheados: login, cadastro, Google, `walletService.getPublic`, busca de usuário por
email, `member-lookup`, `transfer/preview`, tudo de `oauthRequestService` e
`oauthConnectionService`, e qualquer escrita.

## `offlineCache` (utils)

```ts
get(userId: number, path: string): Promise<CachedEntry | undefined>
set(userId: number, path: string, data: unknown): Promise<void>
clearAll(): Promise<void>
```
Falha de IndexedDB → operações viram no-op (resolvem sem erro).

## Testes esperados

Cada linha da tabela de comportamento; isolamento entre usuários; `clearAll` no logout e no 401;
registro com `schemaVersion` antigo ignorado; limite de 300 por usuário; timeout com timers falsos.
