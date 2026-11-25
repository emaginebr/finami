# Contrato — Roteamento público de `finami.site`

Cadeia: **navegador/cliente MCP → Cloudflare (TLS público, proxy) → Cloudflare Tunnel `emagine-k8s`
→ pods `cloudflared` (namespace `cloudflared`, conexão de saída) → HTTP
`ingress-nginx-controller.ingress-nginx.svc.cluster.local:80` (ingress-nginx interno, sem TLS) →
Service**.

Public Hostnames do túnel (painel Zero Trust): `finami.site` e `www.finami.site` → `HTTP`
`ingress-nginx-controller.ingress-nginx.svc.cluster.local:80`. Os Ingress do Finami usam
`ssl-redirect: "false"` (o HTTPS é da Cloudflare; não há redirect para HTTPS dentro do cluster).

| Host | Caminho (prefixo) | Destino | Particularidades |
|---|---|---|---|
| `finami.site` | `/api/` | `finami-api:8080` | |
| `finami.site` | `/oauth/` | `finami-api:8080` | rate limit por IP (IP real) |
| `finami.site` | `/.well-known/oauth-` | `finami-api:8080` | metadados OAuth/MCP |
| `finami.site` | `/mcp` | `finami-api:8080` | sem buffer; read/send timeout 3600 s; SSE |
| `finami.site` | `/` (demais) | `finami-web:80` | SPA; fallback para `index.html` no nginx |
| `www.finami.site` | qualquer | 308 → `https://finami.site$request_uri` | |

Os caminhos mantêm o prefixo ao chegar à API (sem rewrite), como no proxy atual.

## Cabeçalhos entregues à API

| Cabeçalho | Valor |
|---|---|
| `Host` | `finami.site` |
| `X-Forwarded-Proto` | `https` |
| `X-Forwarded-For` | IP real do cliente (de `CF-Connecting-IP`, aceito só de conexões vindas da faixa de pods do cluster, isto é, do `cloudflared`) |

O ingress é `ClusterIP`: não há como chegar a ele sem passar pela Cloudflare. Um `CF-Connecting-IP`
enviado pelo cliente é sobrescrito pela Cloudflare na borda. O `X-Forwarded-Proto: https` vem da
Cloudflare e é repassado (`use-forwarded-headers`).

## Health

| Endpoint | Quem usa | Exposto publicamente? |
|---|---|---|
| `GET /health` (API) | readiness probe | Não (não há rota do ingress para `/health`) |
| `GET /healthz` (web) | readiness/liveness probe | Sim, via `/` (já é público hoje; responde `ok`) |

## Erros esperados na borda

| Situação | Resposta |
|---|---|
| Túnel sem conector (pods `cloudflared` fora do ar) | 1033 (Cloudflare) |
| Hostname sem Public Hostname no túnel / sem regra no ingress | 404 (ingress-nginx) |
| Nenhum pod pronto | 503 (ingress) |
| Requisição sem resposta por > ~100 s | 524 (Cloudflare) |
