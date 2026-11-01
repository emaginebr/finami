# Contrato — OAuth 2.1 do Finami (feature 004)

Implementação: **dotnet-senior-developer**. `{base}` = `Mcp:PublicUrl` (ex.
`https://finami.app`, homolog `http://localhost:5145`). Erros do protocolo usam o formato OAuth
`{ "error": "...", "error_description": "..." }` (não o envelope `{ sucesso, mensagem }`).

## Descoberta

### `GET /.well-known/oauth-protected-resource` (e `/.well-known/oauth-protected-resource/mcp`)
```json
{ "resource": "{base}/mcp",
  "authorization_servers": ["{base}"],
  "scopes_supported": ["finami:read", "finami:write"],
  "bearer_methods_supported": ["header"],
  "resource_name": "Finami" }
```

### `GET /.well-known/oauth-authorization-server`
```json
{ "issuer": "{base}",
  "authorization_endpoint": "{base}/oauth/authorize",
  "token_endpoint": "{base}/oauth/token",
  "registration_endpoint": "{base}/oauth/register",
  "revocation_endpoint": "{base}/oauth/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none", "client_secret_post", "client_secret_basic"],
  "revocation_endpoint_auth_methods_supported": ["none", "client_secret_post", "client_secret_basic"],
  "scopes_supported": ["finami:read", "finami:write"] }
```

### Desafio no MCP
`POST /mcp` sem token ou com token inválido → `401` com
`WWW-Authenticate: Bearer resource_metadata="{base}/.well-known/oauth-protected-resource"`
(e `error="invalid_token"` quando houver token). Escopo insuficiente numa ferramenta → resultado
de erro do MCP (ver `mcp-tools.md`), não 403 HTTP.

## `POST /oauth/register` (RFC 7591) — anônimo, 10/h por IP
Request:
```json
{ "client_name": "Claude",
  "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "finami:read finami:write" }
```
`201`:
```json
{ "client_id": "fmc_8Yd…", "client_id_issued_at": 1793563200,
  "client_name": "Claude", "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
  "grant_types": ["authorization_code", "refresh_token"], "response_types": ["code"],
  "token_endpoint_auth_method": "none" }
```
(+ `client_secret` e `client_secret_expires_at: 0` quando o método usa segredo).
`400 invalid_redirect_uri` (http fora de loopback, fragmento, >5 URIs) ·
`400 invalid_client_metadata` (nome ausente, grant/método não suportado) · `429`.

## `GET /oauth/authorize`
Query: `response_type=code`, `client_id`, `redirect_uri`, `code_challenge`,
`code_challenge_method=S256`, `scope?`, `state?`, `resource?`.

- `client_id` desconhecido ou `redirect_uri` não registrado → **`400` página HTML de erro**
  ("Não foi possível conectar este assistente"), sem redirecionar.
- Demais erros → redirect `302 {redirect_uri}?error=…&error_description=…&state=…`:
  `invalid_request` (sem PKCE, método ≠ S256, `response_type` ≠ code), `invalid_scope`,
  `invalid_target` (`resource` ≠ `{base}/mcp`).
- Válido → grava o pedido (10 min) e `302 {App:PublicUrl}/autorizar?pedido={requestKey}`.

Loopback: para `http://localhost|127.0.0.1|[::1]` registrado, a porta pode variar (RFC 8252).

## `POST /oauth/token` — `application/x-www-form-urlencoded`, 30/min por IP

**authorization_code**: `grant_type`, `code`, `redirect_uri`, `code_verifier`, `client_id`
(+ segredo conforme o método), `resource?`.
**refresh_token**: `grant_type`, `refresh_token`, `client_id` (+ segredo), `scope?` (só reduzir).

`200` (`Cache-Control: no-store`):
```json
{ "access_token": "fma_…", "token_type": "Bearer", "expires_in": 3600,
  "refresh_token": "fmr_…", "scope": "finami:read finami:write" }
```
Erros `400`: `invalid_grant` (código vencido/usado/de outro cliente, `redirect_uri` diferente,
PKCE não confere, renovação vencida/revogada/reusada, conexão revogada), `invalid_client`
(`401` quando autenticação de cliente falha), `unsupported_grant_type`, `invalid_scope`.
Código reapresentado → `invalid_grant` **e** conexão revogada. Renovação já usada reapresentada →
`invalid_grant` **e** conexão revogada (`RefreshTokenReuse`).

## `POST /oauth/revoke` (RFC 7009)
Form: `token`, `token_type_hint?`, `client_id` (+ segredo). Sempre `200` (mesmo token
desconhecido). Revogar o token de renovação revoga a conexão; revogar o de acesso revoga só ele.

## Rotas do app para consentimento e conexões (JWT do app, envelope `{ sucesso, mensagem }`)

Ver `api.md`.
