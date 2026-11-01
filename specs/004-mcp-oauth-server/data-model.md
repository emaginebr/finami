# Data Model: Servidor MCP com OAuth (feature 004)

Convenções do Princípio V: tabelas snake_case plural, PK `{entidade}_id bigint identity`,
constraint `{tabela}_pkey`, FKs `fk_{pai}_{filho}` com `ClientSetNull`, timestamps `timestamp
without time zone` (UTC), enums `integer`. Segredos e tokens **só como SHA-256 em hexadecimal**
(`varchar(64)`). Migration: `AddOAuthAndMcp`.

## Enums (`Finami.Domain/Enums`)

| Enum | Valores |
|---|---|
| `OAuthClientAuthMethod` | `None=1`, `ClientSecretPost=2`, `ClientSecretBasic=3` |
| `OAuthGrantStatus` | `Active=1`, `Revoked=2` |
| `OAuthRevokeReason` | `UserDisconnected=1`, `UserDisconnectedAll=2`, `Reauthorized=3`, `RefreshTokenReuse=4`, `ClientRevoked=5`, `AuthorizationCodeReuse=6` |
| `OAuthRequestStatus` | `Pending=1`, `Approved=2`, `Denied=3`, `CodeRedeemed=4` |
| `IdempotencyStatus` | `InProgress=1`, `Completed=2` |
| `McpScope` (flags, guardado como texto) | `finami:read`, `finami:write` |

## `oauth_clients` — Cliente OAuth (assistente registrado)

| Coluna | Tipo | Regras |
|---|---|---|
| `oauth_client_id` | bigint PK | |
| `client_id` | varchar(64) | público, aleatório (`fmc_…`), **único** |
| `client_secret_hash` | varchar(64) null | só se método ≠ `None` |
| `client_name` | varchar(120) | obrigatório |
| `redirect_uris` | varchar(2000) | JSON array, 1–5 URIs (R-05) |
| `auth_method` | integer | `OAuthClientAuthMethod` |
| `is_dynamic` | boolean default true | |
| `created_at` | timestamp | |

## `oauth_grants` — Conexão (pessoa ↔ assistente)

| Coluna | Tipo | Regras |
|---|---|---|
| `oauth_grant_id` | bigint PK | |
| `user_id` | bigint FK → `users` (`fk_user_oauth_grant`) | |
| `oauth_client_id` | bigint FK → `oauth_clients` (`fk_oauth_client_oauth_grant`) | |
| `scopes` | varchar(200) | separados por espaço |
| `status` | integer default 1 | `OAuthGrantStatus` |
| `created_at` / `updated_at` | timestamp | `updated_at` muda ao reautorizar |
| `last_used_at` | timestamp null | atualizado no máx. 1×/min |
| `revoked_at` | timestamp null | |
| `revoke_reason` | integer null | `OAuthRevokeReason` |

Índices: único parcial `(user_id, oauth_client_id) WHERE status = 1` (uma conexão ativa por
pessoa/assistente); `(user_id, status)`.

## `oauth_authorization_requests` — Pedido de autorização + código

| Coluna | Tipo | Regras |
|---|---|---|
| `oauth_authorization_request_id` | bigint PK | |
| `request_key` | varchar(64) | público na URL `/autorizar?pedido=`, aleatório, **único** |
| `oauth_client_id` | bigint FK | |
| `redirect_uri` | varchar(500) | exatamente o recebido |
| `scopes_requested` | varchar(200) | |
| `state` | varchar(500) null | devolvido sem alteração |
| `code_challenge` | varchar(128) | S256 |
| `resource` | varchar(500) | = URL do MCP |
| `status` | integer default 1 | `OAuthRequestStatus` |
| `user_id` | bigint FK null | preenchido ao aprovar/negar |
| `oauth_grant_id` | bigint FK null | conexão criada/atualizada |
| `code_hash` | varchar(64) null | **único** parcial (not null) |
| `created_at` | timestamp | |
| `expires_at` | timestamp | pedido: +10 min; ao aprovar, código: +10 min |
| `redeemed_at` | timestamp null | |

Transições: `Pending → Approved → CodeRedeemed`; `Pending → Denied`. Pedido vencido ou código
reapresentado depois de `CodeRedeemed` → recusado; reapresentação revoga a conexão
(`AuthorizationCodeReuse`).

## `oauth_tokens` — Tokens de acesso e de renovação

| Coluna | Tipo | Regras |
|---|---|---|
| `oauth_token_id` | bigint PK | |
| `oauth_grant_id` | bigint FK (`fk_oauth_grant_oauth_token`) | |
| `token_type` | integer | `Access=1`, `Refresh=2` |
| `token_hash` | varchar(64) | **único** |
| `scopes` | varchar(200) | |
| `parent_token_id` | bigint FK null → `oauth_tokens` | renovação anterior (cadeia de rotação) |
| `created_at` | timestamp | |
| `expires_at` | timestamp | acesso +1 h; renovação +30 d |
| `used_at` | timestamp null | renovação já trocada |
| `revoked_at` | timestamp null | |

Validação de acesso: `token_hash` = SHA-256(token) ∧ `token_type = Access` ∧ `expires_at > now`
∧ `revoked_at is null` ∧ conexão `Active`. Revogar conexão = `status = Revoked` + `revoked_at`
em todos os tokens dela (na mesma transação).

## `mcp_idempotency_keys` — Chave de repetição

| Coluna | Tipo | Regras |
|---|---|---|
| `mcp_idempotency_key_id` | bigint PK | |
| `user_id` | bigint FK | |
| `tool_name` | varchar(80) | |
| `idempotency_key` | varchar(64) | |
| `status` | integer | `IdempotencyStatus` |
| `result_json` | text null | resultado serializado |
| `created_at` | timestamp | apagada após 24 h |

Índice único `(user_id, tool_name, idempotency_key)`.

## `mcp_audit_logs` — Auditoria de escrita

| Coluna | Tipo | Regras |
|---|---|---|
| `mcp_audit_log_id` | bigint PK | |
| `user_id` | bigint FK | |
| `oauth_grant_id` | bigint FK | |
| `tool_name` | varchar(80) | |
| `outcome` | varchar(40) | `sucesso` ou código de erro (R-07) |
| `target_id` | bigint null | id criado/alterado |
| `created_at` | timestamp | guardado 1 ano |

Índice `(user_id, created_at DESC)`.

## DTOs (`Finami.DTO/OAuth`) — todos com `[JsonPropertyName]`

- Protocolo OAuth (nomes snake_case do padrão): `OAuthClientRegistrationInfo`,
  `OAuthClientRegistrationResult`, `OAuthTokenResult`, `OAuthErrorResult` (`error`,
  `error_description`), `AuthorizationServerMetadata`.
- App (camelCase): `OAuthRequestInfo` (`requestKey`, `clientName`, `redirectHost`,
  `scopesRequested[]`, `expiresAt`), `OAuthApproveInfo` (`scopes[]`), `OAuthRedirectResult`
  (`redirectUrl`), `OAuthConnectionInfo` (`connectionId`, `clientName`, `scopes[]`,
  `createdAt`, `lastUsedAt`).

## Relações

```text
users 1─* oauth_grants *─1 oauth_clients
oauth_grants 1─* oauth_tokens (refresh → parent_token_id → refresh anterior)
oauth_clients 1─* oauth_authorization_requests ─0..1 oauth_grants
users 1─* mcp_idempotency_keys · users 1─* mcp_audit_logs *─1 oauth_grants
```
