# API Contract — rotas do app para OAuth (feature 004)

Complementa `specs/001-finami-backend-core/contracts/api.md`. Todas exigem
`Authorization: Bearer {jwt do app}` (o token do MCP é recusado aqui). Erros: `{ sucesso,
mensagem, erros }`. Implementação: **dotnet-senior-developer**; consumo:
**frontend-react-developer**.

## Consentimento

### `GET /api/oauth/requests/{requestKey}` → `200 OAuthRequestInfo`
```json
{ "requestKey": "q3Jk…", "clientName": "Claude", "redirectHost": "claude.ai",
  "scopesRequested": ["finami:read", "finami:write"], "expiresAt": "2026-11-01T18:10:00Z" }
```
`404` "Pedido de autorização não encontrado." · `410` "Este pedido de autorização venceu. Volte ao
assistente e tente conectar de novo." (vencido ou já respondido).

### `POST /api/oauth/requests/{requestKey}/approve`
Body `{ "scopes": ["finami:read"] }` (subconjunto não vazio do pedido; `finami:write` sem
`finami:read` é completado com read) → `200 OAuthRedirectResult`
```json
{ "redirectUrl": "https://claude.ai/api/mcp/auth_callback?code=…&state=…" }
```
Cria a conexão ou, se já houver uma ativa para o mesmo assistente, substitui os escopos e revoga
os tokens antigos (`Reauthorized`). `400` escopos inválidos · `404` · `410`.

### `POST /api/oauth/requests/{requestKey}/deny` → `200 OAuthRedirectResult`
`redirectUrl` com `error=access_denied&error_description=…&state=…`. `404` · `410`.

## Assistentes conectados

### `GET /api/oauth/connections` → `200 OAuthConnectionInfo[]` (ativas, mais recentes primeiro)
```json
[ { "connectionId": 7, "clientName": "Claude", "scopes": ["finami:read", "finami:write"],
    "createdAt": "2026-11-01T18:00:00Z", "lastUsedAt": "2026-11-01T18:42:00Z" } ]
```

### `DELETE /api/oauth/connections/{connectionId}` → `204`
Revoga conexão e tokens (`UserDisconnected`). `404` se não for da pessoa ou já revogada.

### `DELETE /api/oauth/connections` → `204`
Revoga todas as conexões ativas da pessoa (`UserDisconnectedAll`).

### `GET /api/oauth/mcp-info` → `200 { "mcpUrl": "https://finami.app/mcp" }`
Endereço exibido na seção vazia para copiar (US4-3).

## Testes esperados (xUnit)

- Approve: cria conexão; só leitura; reautorização substitui escopos e revoga tokens antigos;
  pedido vencido → 410; pedido de outra pessoa já aprovado → 410.
- Deny: URL com `access_denied` e `state`.
- Connections: lista só as próprias; desconectar revoga tokens (token de acesso passa a 401);
  desconectar todos.
