# Contrato — Pipeline `Deploy Production` (`.github/workflows/deploy-prod.yml`)

## Gatilho

`workflow_dispatch`, `concurrency: deploy-production` (sem cancelar o que está rodando).

| Input | Obrigatório | Padrão | Descrição |
|---|---|---|---|
| `ref` | sim | `main` | Branch ou tag a publicar |
| `skip_tests` | não | `false` | Só para rollback de uma ref já testada |

## Secrets e Variables (environment `production`)

| Nome | Tipo | Obrigatório | Uso |
|---|---|---|---|
| `KUBECONFIG` | Secret | sim | kubeconfig da ServiceAccount `finami-deployer` (nunca o admin da DO) |
| `FINAMI_CONNECTION_STRING` | Secret | sim | → `finami-api-secrets/ConnectionStrings__FinamiContext` |
| `FINAMI_JWT_SECRET` | Secret | sim (≥ 32 bytes) | → `finami-api-secrets/Jwt__Secret` |
| `FINAMI_GOOGLE_CLIENT_ID` | Secret ou Variable | não | → `finami-api-secrets/Google__ClientId` e build arg `VITE_GOOGLE_CLIENT_ID` |
| `GHCR_PULL_USER` | Secret ou Variable | sim | Usuário dono do PAT. Compartilhável entre projetos (pode ser da organização) |
| `GHCR_PULL_TOKEN` | Secret | sim | PAT com **apenas** `read:packages` → `ghcr-pull`. Compartilhável entre projetos (secret da organização, de preferência de uma conta de máquina) |

Publicação no GHCR usa o `GITHUB_TOKEN` (`permissions: contents: read, packages: write`).

Não há certificado de origem (a entrada é o Cloudflare Tunnel do cluster). O token do túnel é
credencial do cluster, aplicada pelo admin (`deploy/k8s/infra/install-cloudflared.sh`), e **não**
faz parte desta pipeline nem do environment `production`. Se os secrets `FINAMI_CLOUDFLARE_ORIGIN_CERT`
e `FINAMI_CLOUDFLARE_ORIGIN_KEY` (desenho anterior, com Load Balancer) já tiverem sido cadastrados,
podem ser apagados.

Removidos: `PROD_SSH_HOST`, `PROD_SSH_USER`, `PROD_SSH_KEY`, `PROD_SSH_PASSWORD`, `PROD_SSH_PORT`,
`PROD_GIT_TOKEN`.

## Jobs

| Job | Needs | Falha quando |
|---|---|---|
| `test` | — | `dotnet test` ou `npm test`/`npm run build` falham (pulado se `skip_tests`) |
| `images` | `test` | build/push falha. Pula o build de cada imagem se `sha-<commit>` já existe |
| `deploy` | `images` | secret obrigatório ausente (mensagem com o nome); `kubectl apply` falha; `rollout status` expira (10 min) |

## Garantias

- Nenhum valor de secret é impresso (sem `echo`/`set -x` com valores; mascaramento do GitHub).
- Secrets do cluster são aplicados com `--dry-run=client -o yaml | kubectl apply -f -` (idempotente).
- Ao falhar o rollout, o job imprime `kubectl get pods`, `kubectl describe` e `kubectl logs --tail=100`
  do pod novo; o pod anterior segue atendendo.
- Resumo (`GITHUB_STEP_SUMMARY`): ref, commit, tags das imagens, URL `https://finami.site`, autor.

## Imagens

| Imagem | Contexto | Build args | Tags |
|---|---|---|---|
| `ghcr.io/emaginebr/finami-api` | `backend/` | — | `sha-<commit7>`, `<ref sanitizada>` |
| `ghcr.io/emaginebr/finami-web` | `frontend/` | `VITE_API_URL=""`, `VITE_GOOGLE_CLIENT_ID` | `sha-<commit7>`, `<ref sanitizada>` |
