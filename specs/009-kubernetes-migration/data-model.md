# Data Model — 009 Migração para Kubernetes

**Banco de dados**: nenhuma mudança. Sem tabelas, colunas ou migrations novas; o PostgreSQL externo e
a connection string continuam os mesmos (FR-008).

As "entidades" desta feature são os recursos de implantação. Esta é a lista canônica que os
manifestos devem seguir.

## Namespace `finami`

Contém tudo do Finami. Criado no bootstrap (pelo admin), não pela pipeline.

| Recurso | Tipo | Origem | Observações |
|---|---|---|---|
| `finami-deployer` | ServiceAccount + Role + RoleBinding + Secret (token) | bootstrap | Permissões só no namespace (R-09) |
| `finami-api` | Deployment | `deploy/k8s/finami/` | 1 réplica, imagem `ghcr.io/emaginebr/finami-api:sha-<commit>` |
| `finami-api` | Service (ClusterIP, 8080) | `deploy/k8s/finami/` | Só o ingress acessa |
| `finami-web` | Deployment | `deploy/k8s/finami/` | 1 réplica, imagem `ghcr.io/emaginebr/finami-web:sha-<commit>` |
| `finami-web` | Service (ClusterIP, 80) | `deploy/k8s/finami/` | |
| `finami` | Ingress (class `nginx`) | `deploy/k8s/finami/` | `finami.site` + `www` → rotas web/API |
| `finami-mcp` | Ingress (class `nginx`) | `deploy/k8s/finami/` | `/mcp` sem buffer, timeout 1 h |
| `finami-api-env` | ConfigMap | `deploy/k8s/finami/` | `ASPNETCORE_ENVIRONMENT=Production` |
| `finami-api-secrets` | Secret (Opaque) | pipeline | `ConnectionStrings__FinamiContext`, `Jwt__Secret`, `Google__ClientId` |
| `ghcr-pull` | Secret (`kubernetes.io/dockerconfigjson`) | pipeline | PAT `read:packages` |

## Namespace `ingress-nginx` (infra compartilhada)

| Recurso | Tipo | Origem | Observações |
|---|---|---|---|
| `ingress-nginx` | Release Helm (controller + Service `ClusterIP` `ingress-nginx-controller`, porta 80) | `deploy/k8s/infra/` (admin) | Sem Load Balancer; só o túnel (de dentro do cluster) chega a ele; real-ip via `CF-Connecting-IP` da faixa de pods (R-03) |

## Namespace `cloudflared` (infra compartilhada)

| Recurso | Tipo | Origem | Observações |
|---|---|---|---|
| `cloudflared` | Deployment | `deploy/k8s/infra/cloudflared.yaml` (admin) | Conector do túnel `emagine-k8s`; 2 réplicas, antiafinidade preferida por nó; `cloudflare/cloudflared:2026.11.2`; probes `/ready` (porta 2000); `10m/32Mi` → `200m/128Mi`; não-root (65532), FS somente-leitura; sem Service |
| `cloudflared-token` | Secret (Opaque, chave `token`) | `deploy/k8s/infra/install-cloudflared.sh` (admin) | Token do túnel; credencial do cluster, fora do GitHub e da pipeline do Finami |

Os *Public Hostnames* do túnel (`finami.site`, `www.finami.site` →
`http://ingress-nginx-controller.ingress-nginx.svc.cluster.local:80`) ficam no painel Cloudflare
Zero Trust, não no cluster.

## Regras dos Deployments

| Campo | `finami-api` | `finami-web` |
|---|---|---|
| `replicas` | 1 | 1 |
| `strategy` | RollingUpdate `maxSurge: 1`, `maxUnavailable: 0` | idem |
| `progressDeadlineSeconds` | 600 | 300 |
| `revisionHistoryLimit` | 5 | 5 |
| Porta | 8080 | 80 |
| `startupProbe` | TCP 8080, período 5s, 60 falhas | — |
| `readinessProbe` | HTTP `/health` (inclui banco), período 10s | HTTP `/healthz`, período 10s |
| `livenessProbe` | TCP 8080, período 20s, 3 falhas | HTTP `/healthz`, período 20s |
| `resources.requests` | `100m` / `256Mi` | `10m` / `32Mi` |
| `resources.limits` | `500m` / `512Mi` | `200m` / `128Mi` |
| Env | `envFrom`: `finami-api-env` + `finami-api-secrets` | nenhuma (VITE_* embutidas no build) |
| `imagePullSecrets` | `ghcr-pull` | `ghcr-pull` |
| `automountServiceAccountToken` | `false` | `false` |

## Ciclo de vida de uma versão

```text
ref (branch/tag) ──test──▶ imagens sha-<commit> no GHCR ──apply──▶ ReplicaSet novo
   ReplicaSet novo: Starting ─(startup ok)─▶ NotReady ─(/health ok)─▶ Ready ─▶ antigo removido
                                       └─(timeout 10 min)─▶ pipeline falha; antigo continua Ready
rollback: reaplicar sha anterior (pipeline) ou `kubectl rollout undo`
```

## Validações (falham o deploy antes de aplicar qualquer recurso)

- Secrets obrigatórios presentes e não vazios: `KUBECONFIG`, `FINAMI_CONNECTION_STRING`,
  `FINAMI_JWT_SECRET`, `GHCR_PULL_USER`, `GHCR_PULL_TOKEN`.
- `FINAMI_JWT_SECRET` com pelo menos 32 bytes (Princípio VI; a API também se recusa a iniciar).
