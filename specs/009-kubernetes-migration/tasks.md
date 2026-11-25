---
description: "Task list — 009 Migração do Finami para Kubernetes (DigitalOcean)"
---

# Tasks: Migração do Finami para Kubernetes (DigitalOcean)

**Input**: Design documents from `/specs/009-kubernetes-migration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routing.md, contracts/deploy-pipeline.md, quickstart.md

**Tests**: a spec não pede testes automatizados novos. A verificação é feita por validação dos
manifestos na pipeline (T029) e pelo roteiro do [quickstart](quickstart.md) (tarefas marcadas **manual**).

**Organization**: tarefas agrupadas por user story. Não há código de aplicação: `backend/**`,
`frontend/Dockerfile`, `frontend/nginx.conf` e `docker-compose.yml` **não** são alterados.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1–US4 (spec.md)
- Agente responsável ao fim de cada tarefa de implementação (Princípio VIII; ver Complexity
  Tracking do plan.md): `→ dotnet-senior-developer`. Tarefas **manual** são do mantenedor/admin do
  cluster, fora do repositório.
- Regra geral: **nenhum** valor de credencial (token, kubeconfig, connection string, segredo JWT,
  certificado/chave) pode ser escrito em arquivo do repositório, exemplo ou log.

---

## Phase 1: Setup

**Purpose**: estrutura de pastas e dados estáticos da infra.

- [X] T001 Criar a estrutura `deploy/k8s/infra/`, `deploy/k8s/bootstrap/` e `deploy/k8s/finami/` com um `deploy/k8s/README.md` curto explicando as três pastas (infra compartilhada aplicada pelo admin; bootstrap único pelo admin; `finami/` aplicado pela pipeline), conforme plan.md → dotnet-senior-developer
- [X] T002 [P] Remover `deploy/k8s/infra/cloudflare-ips.txt` (substituído pelo túnel: o ingress confia em `CF-Connecting-IP` vindo da faixa de pods do cluster, não das faixas públicas da Cloudflare) e as referências a ele → dotnet-senior-developer
- [X] T003 [P] Adicionar ao `.gitignore` da raiz os padrões `*.kubeconfig`, `kubeconfig*`, `*.pem` e `*.key`, para impedir commit acidental do kubeconfig gerado no bootstrap e de chaves/certificados → dotnet-senior-developer

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infra de entrada compartilhada e credencial restrita da pipeline. Bloqueia todas as stories.

- [X] T004 Criar `deploy/k8s/infra/ingress-nginx-values.yaml` para o chart `ingress-nginx/ingress-nginx` (fixado em 4.15.1): `controller.ingressClassResource.name: nginx` e `default: false`; `controller.service.type: ClusterIP` (sem Load Balancer); `controller.config` com `use-forwarded-headers: "true"`, `enable-real-ip: "true"`, `forwarded-for-header: "CF-Connecting-IP"`, `compute-full-forwarded-for: "false"` e `proxy-real-ip-cidr: "10.109.0.0/16"` (faixa de pods do cluster, com o comando para reconferir no comentário) (research R-02/R-03); `controller.resources.requests` `100m`/`128Mi` → dotnet-senior-developer
- [X] T005 Criar `deploy/k8s/infra/install-ingress.sh` (bash, `set -euo pipefail`): exige `kubectl` e `helm`; se já existir `IngressClass nginx` não gerenciada pela release `ingress-nginx` no namespace `ingress-nginx`, imprime aviso com as opções de real-ip que precisam ser conferidas e sai com 0 sem alterar nada; senão `helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx`, `helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx --version 4.15.1 -n ingress-nginx --create-namespace -f "$(dirname "$0")/ingress-nginx-values.yaml" --wait` e `kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller` → dotnet-senior-developer
- [X] T005a Criar `deploy/k8s/infra/cloudflared.yaml`: Namespace `cloudflared`; Deployment `cloudflared` (túnel compartilhado `emagine-k8s`) com 2 réplicas e `podAntiAffinity` preferida por `kubernetes.io/hostname`, imagem `cloudflare/cloudflared:2026.11.2`, args `tunnel --no-autoupdate --metrics 0.0.0.0:2000 run`, env `TUNNEL_TOKEN` do Secret `cloudflared-token` (chave `token`), readiness/liveness HTTP `/ready` na porta 2000, requests `10m/32Mi`, limits `200m/128Mi`, `runAsNonRoot`/`runAsUser: 65532`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `automountServiceAccountToken: false`; sem Service (research R-02) → dotnet-senior-developer
- [X] T005b Criar `deploy/k8s/infra/install-cloudflared.sh` (bash, `set -euo pipefail`, LF): exige `kubectl`; lê o token de `CLOUDFLARE_TUNNEL_TOKEN` ou pede com `read -rs`; cria o namespace, cria/atualiza o Secret `cloudflared-token` com `--from-file` de um arquivo temporário (`umask 077`, apagado num `trap`) via `--dry-run=client -o yaml | kubectl apply -f -`, sem nunca imprimir o token; aplica `cloudflared.yaml` e espera `kubectl -n cloudflared rollout status deploy/cloudflared --timeout=5m`. O token é credencial do cluster (fora do GitHub e da pipeline do Finami) → dotnet-senior-developer
- [X] T006 [P] Criar `deploy/k8s/bootstrap/namespace.yaml` com o Namespace `finami` (labels `app.kubernetes.io/part-of: finami`) → dotnet-senior-developer
- [X] T007 [P] Criar `deploy/k8s/bootstrap/deployer-rbac.yaml` no namespace `finami`: ServiceAccount `finami-deployer`; Role `finami-deployer` com verbs `get, list, watch, create, update, patch, delete` em `deployments`, `replicasets` (apps), `services`, `configmaps`, `secrets`, `pods`, `events` (core), `ingresses` (networking.k8s.io), e `get, list` em `pods/log`; RoleBinding ligando os dois; Secret `finami-deployer-token` do tipo `kubernetes.io/service-account-token` com a anotação `kubernetes.io/service-account.name: finami-deployer` (research R-09) → dotnet-senior-developer
- [X] T008 Criar `deploy/k8s/bootstrap/make-kubeconfig.sh` (bash, `set -euo pipefail`): lê do contexto atual (admin) o endereço do API server e o CA do cluster, lê o token e o `ca.crt` do Secret `finami-deployer-token`, e imprime em stdout um kubeconfig com cluster `do-nyc2-emagine-k8s`, usuário `finami-deployer`, contexto `finami` e `namespace: finami`. Não grava arquivo nem imprime nada além do kubeconfig; comentário no topo com o uso (`> finami-deployer.kubeconfig`, cadastrar como secret `KUBECONFIG`, apagar o arquivo) → dotnet-senior-developer
- [X] T009 Criar `deploy/k8s/finami/kustomization.yaml` com `namespace: finami`, `labels` comuns `app.kubernetes.io/part-of: finami` (sem incluir em selectors), a lista `resources` dos arquivos das Phases 3 e `images` com `ghcr.io/emaginebr/finami-api` e `ghcr.io/emaginebr/finami-web` (tag `latest` como placeholder; a pipeline sobrescreve com `sha-<commit>`) → dotnet-senior-developer
- [ ] T010 **manual** Pré-requisitos do quickstart §0: revogar o token `dop_v1_…` exposto no chat e baixar um kubeconfig de admin novo; liberar o cluster no firewall do PostgreSQL; anotar o IP do servidor antigo nos registros A/AAAA de `finami.site` e `www`; criar no Cloudflare Zero Trust o túnel `emagine-k8s` (se ainda não existir) e copiar o token do conector; criar o PAT `read:packages`
- [ ] T011 **manual** Rodar `deploy/k8s/infra/install-ingress.sh` e `deploy/k8s/infra/install-cloudflared.sh` (token pelo prompt; quickstart §1), conferir o túnel HEALTHY no painel; `kubectl apply -f deploy/k8s/bootstrap/` + `make-kubeconfig.sh` (quickstart §2); conferir com `kubectl auth can-i` o privilégio mínimo

**Checkpoint**: ingress e túnel compartilhados no ar, namespace `finami` e credencial restrita prontos.

---

## Phase 3: User Story 1 — Usuários continuam usando o Finami sem perceber a troca (P1) 🎯 MVP

**Goal**: API e SPA rodando no cluster e atendendo `finami.site` com o mesmo roteamento, cabeçalhos e dados de hoje.

**Independent Test**: com os recursos aplicados, validar direto no ingress por port-forward (quickstart §4) e, após a troca na Cloudflare, rodar o roteiro do quickstart §5.

- [X] T012 [P] [US1] Criar `deploy/k8s/finami/api-configmap.yaml`: ConfigMap `finami-api-env` com `ASPNETCORE_ENVIRONMENT: Production` (domínio, CORS e MCP continuam no `appsettings.Production.json`) → dotnet-senior-developer
- [X] T013 [P] [US1] Criar `deploy/k8s/finami/api-deployment.yaml`: Deployment `finami-api` (labels/selector `app: finami-api`), `replicas: 1`, `strategy` RollingUpdate `maxSurge: 1`/`maxUnavailable: 0`, `progressDeadlineSeconds: 600`, `revisionHistoryLimit: 5`, `automountServiceAccountToken: false`, `imagePullSecrets: [ghcr-pull]`, container `api` com imagem `ghcr.io/emaginebr/finami-api`, porta 8080 nomeada `http`, `envFrom` ConfigMap `finami-api-env` e Secret `finami-api-secrets`, probes e recursos exatamente como na tabela "Regras dos Deployments" do data-model.md (startup TCP 5s×60, readiness HTTP `/health` 10s, liveness TCP 20s×3; requests `100m/256Mi`, limits `500m/512Mi`), `securityContext` `runAsNonRoot: true`, `allowPrivilegeEscalation: false` → dotnet-senior-developer
- [X] T014 [P] [US1] Criar `deploy/k8s/finami/api-service.yaml`: Service ClusterIP `finami-api`, porta 8080 → `http`, selector `app: finami-api` → dotnet-senior-developer
- [X] T015 [P] [US1] Criar `deploy/k8s/finami/web-deployment.yaml`: Deployment `finami-web` (selector `app: finami-web`), `replicas: 1`, mesma strategy, `progressDeadlineSeconds: 300`, `revisionHistoryLimit: 5`, `automountServiceAccountToken: false`, `imagePullSecrets: [ghcr-pull]`, imagem `ghcr.io/emaginebr/finami-web`, porta 80 `http`, readiness/liveness HTTP `/healthz` (10s/20s), requests `10m/32Mi`, limits `200m/128Mi`, sem variáveis de ambiente → dotnet-senior-developer
- [X] T016 [P] [US1] Criar `deploy/k8s/finami/web-service.yaml`: Service ClusterIP `finami-web`, porta 80 → `http`, selector `app: finami-web` → dotnet-senior-developer
- [X] T017 [US1] Criar `deploy/k8s/finami/ingress.yaml`: Ingress `finami`, `ingressClassName: nginx`, sem seção `tls` (o HTTPS termina na Cloudflare; o túnel chega por HTTP), anotações `nginx.ingress.kubernetes.io/ssl-redirect: "false"`, `nginx.ingress.kubernetes.io/from-to-www-redirect: "true"` e `nginx.ingress.kubernetes.io/proxy-body-size: "10m"`; host `finami.site` com paths `Prefix` `/api` e `/oauth` → `finami-api:8080`, `ImplementationSpecific` `/.well-known/oauth-` → `finami-api:8080` e `Prefix` `/` → `finami-web:80`, sem rewrite (contracts/routing.md) → dotnet-senior-developer
- [X] T018 [US1] Criar `deploy/k8s/finami/ingress-mcp.yaml`: Ingress `finami-mcp`, `ingressClassName: nginx`, sem `tls`, host `finami.site`, path `Prefix` `/mcp` → `finami-api:8080`, anotações `ssl-redirect: "false"`, `proxy-buffering: "off"`, `proxy-request-buffering: "off"`, `proxy-read-timeout: "3600"`, `proxy-send-timeout: "3600"` (research R-05) → dotnet-senior-developer
- [X] T019 [US1] Conferir que `deploy/k8s/finami/kustomization.yaml` (T009) lista T012–T018 e que `kubectl kustomize deploy/k8s/finami` (ou `kustomize build`) gera os 8 objetos com namespace `finami`; se a ferramenta não estiver disponível localmente, deixar a verificação para T029 → dotnet-senior-developer
- [ ] T020 [US1] **manual** Após o primeiro deploy (US2), validar direto no ingress com `kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 8080:80` e `curl -H 'Host: finami.site'` conforme quickstart §4 (`/healthz`, `/api`, `/.well-known/oauth-authorization-server`, redirect do `www`) e, em seguida, fazer a troca na Cloudflare (apagar os A/AAAA e criar os Public Hostnames no túnel `emagine-k8s`) e o roteiro SC-001/SC-002 do quickstart §5, incluindo o IP real no log da API

**Checkpoint**: Finami servido pelo cluster com os mesmos fluxos de antes.

---

## Phase 4: User Story 2 — Publicar uma versão no cluster pela pipeline (P1)

**Goal**: `Deploy Production` testa, gera imagens no GHCR e atualiza o cluster sem queda, falhando com diagnóstico quando a versão nova não fica saudável.

**Independent Test**: disparar a pipeline com uma tag e conferir a imagem `sha-<commit>` nos dois Deployments (`kubectl -n finami get deploy -o wide`) e o resumo da execução; disparar de novo com a tag anterior e `skip_tests=true` e medir o tempo (SC-005).

- [X] T021 [US2] Reescrever `.github/workflows/deploy-prod.yml` (cabeçalho): nome `Deploy Production`, `on.workflow_dispatch.inputs` `ref` (obrigatório, padrão `main`) e `skip_tests` (boolean, padrão `false`), `concurrency: { group: deploy-production, cancel-in-progress: false }`, `permissions: { contents: read, packages: write }`, `env` com `REGISTRY: ghcr.io`, `API_IMAGE: ghcr.io/emaginebr/finami-api`, `WEB_IMAGE: ghcr.io/emaginebr/finami-web`. Remover todo o job SSH (`appleboy/ssh-action`) → dotnet-senior-developer
- [X] T022 [US2] No mesmo arquivo, job `test` (`if: ${{ !inputs.skip_tests }}`): checkout da `ref`; setup .NET 8.0.x e 9.0.x; `dotnet restore/build/test` de `backend/Finami.sln` (como hoje); setup Node 22 com cache npm em `frontend/package-lock.json`; em `frontend/`: `npm ci`, `npm test`, `npm run build` → dotnet-senior-developer
- [X] T023 [US2] No mesmo arquivo, job `images` (`needs: test`, `if: ${{ always() && (needs.test.result == 'success' || needs.test.result == 'skipped') }}`): checkout da `ref`; output `sha` = `git rev-parse --short=7 HEAD` e `reftag` = `ref` sanitizada (`/` → `-`, só `[A-Za-z0-9._-]`); `docker/login-action@v3` no GHCR com `GITHUB_TOKEN`; para cada imagem, verificar com `docker manifest inspect <imagem>:sha-<sha>` e pular o build se existir; senão `docker/setup-buildx-action@v3` + `docker/build-push-action@v6` (API: contexto `backend`; web: contexto `frontend` com build-args `VITE_API_URL=` e `VITE_GOOGLE_CLIENT_ID=${{ secrets.FINAMI_GOOGLE_CLIENT_ID || vars.FINAMI_GOOGLE_CLIENT_ID }}`), tags `sha-<sha>` e `<reftag>`, `cache-from/to: type=gha` com `scope` por imagem → dotnet-senior-developer
- [X] T024 [US2] No mesmo arquivo, job `deploy` (`needs: images`, `environment: { name: production, url: https://finami.site }`): checkout da `ref`; `azure/setup-kubectl@v4`; gravar `secrets.KUBECONFIG` em `$RUNNER_TEMP/kubeconfig` com `umask 077` e exportar `KUBECONFIG`; em `deploy/k8s/finami`: `kustomize edit set image ghcr.io/emaginebr/finami-api=ghcr.io/emaginebr/finami-api:sha-<sha>` (idem web); `kubectl apply -k deploy/k8s/finami`; `kubectl -n finami rollout status deployment/finami-api --timeout=10m` e depois `finami-web` → dotnet-senior-developer
- [X] T025 [US2] No job `deploy`, passo `if: failure()` de diagnóstico: `kubectl -n finami get pods -o wide`, `kubectl -n finami describe deploy finami-api finami-web`, `kubectl -n finami describe pods -l 'app in (finami-api,finami-web)'` e `kubectl -n finami logs -l app=finami-api --tail=100 --all-containers --prefix` (sem imprimir Secrets); e passo final sempre executado que escreve no `GITHUB_STEP_SUMMARY` ref, commit, tags das imagens, resultado, URL e autor; e remove `$RUNNER_TEMP/kubeconfig` → dotnet-senior-developer
- [ ] T026 [US2] **manual** Disparar `Deploy Production` com `main`: medir o tempo total (SC-003 ≤ 15 min); durante um segundo deploy, rodar um loop de `curl` contínuo em `https://finami.site/api/...` e confirmar ≥ 99% de sucesso (SC-004); fazer rollback com a tag anterior e `skip_tests=true` (SC-005 ≤ 5 min); `kubectl -n finami delete pod -l app=finami-api` e medir a volta (SC-006 ≤ 2 min)

**Checkpoint**: deploy e rollback reprodutíveis pela pipeline.

---

## Phase 5: User Story 3 — Credenciais protegidas (P1)

**Goal**: segredos só no GitHub (environment `production`) e em Secrets do cluster; deploy falha cedo se faltar algum.

**Independent Test**: varrer o repositório e os logs de uma execução atrás de tokens/senhas (nada encontrado); remover temporariamente um secret obrigatório e disparar o deploy (falha com o nome do secret, nada aplicado).

- [X] T027 [US3] No job `deploy` de `.github/workflows/deploy-prod.yml`, antes de qualquer `kubectl`: passo "Validar secrets" que recebe via `env:` `KUBECONFIG_B`, `FINAMI_CONNECTION_STRING`, `FINAMI_JWT_SECRET`, `GHCR_PULL_USER` (`secrets.X || vars.X`), `GHCR_PULL_TOKEN`, e para cada vazio imprime `::error::Secret/Variable <NOME> não definido no environment production.`; falha se algum faltar ou se `FINAMI_JWT_SECRET` tiver menos de 32 bytes (`${#VAR}`), sem nunca imprimir os valores (contracts/deploy-pipeline.md) → dotnet-senior-developer
- [X] T028 [US3] No job `deploy`, após a validação e antes do `kubectl apply -k`: criar/atualizar de forma idempotente (`kubectl create secret ... --dry-run=client -o yaml | kubectl apply -f -`, valores vindos de `env:` e arquivos temporários em `$RUNNER_TEMP` com `umask 077`, removidos no fim) os Secrets `finami-api-secrets` (`ConnectionStrings__FinamiContext`, `Jwt__Secret`, `Google__ClientId`) e `ghcr-pull` (`kubectl create secret docker-registry --docker-server=ghcr.io`) no namespace `finami`; sem `set -x` → dotnet-senior-developer
- [X] T029 [US3] No job `test` (ou num job `manifests` paralelo sem secrets), validar os manifestos: `kubectl kustomize deploy/k8s/finami > /dev/null` e uma checagem que falha se algum arquivo em `deploy/k8s/` contiver `kind: Secret` com `data:`/`stringData:` preenchido (exceto o token da ServiceAccount em `bootstrap/deployer-rbac.yaml`, que não tem dados) ou padrões `dop_v1_`, `BEGIN .*PRIVATE KEY`, `Password=` → dotnet-senior-developer
- [ ] T030 [US3] **manual** Cadastrar no environment `production` do GitHub os secrets/variables do contrato (`KUBECONFIG` da ServiceAccount, `FINAMI_CONNECTION_STRING`, `FINAMI_JWT_SECRET`, `FINAMI_GOOGLE_CLIENT_ID`, `GHCR_PULL_USER`, `GHCR_PULL_TOKEN`; o token do túnel **não** vai para o GitHub); apagar o `finami-deployer.kubeconfig` local; rodar a varredura `git grep -nE 'dop_v1_|BEGIN .*PRIVATE KEY|Password=' $(git rev-list --all)` (SC-007) e conferir os logs da primeira execução

**Checkpoint**: nenhum segredo fora do GitHub/cluster; deploy recusa configuração incompleta.

---

## Phase 6: User Story 4 — Remover o ambiente antigo na mesma entrega (P3)

**Goal**: só existe o deploy para o cluster; o retorno ao servidor antigo está documentado a partir de `backup/sem-k8s`.

**Independent Test**: o repositório não tem `docker-compose-prod.yml`, `.env.prod.example` nem `appleboy/ssh-action`; o README descreve deploy, rollback, logs e plano B; após desligar o container antigo o site segue no ar.

- [X] T031 [P] [US4] Remover `docker-compose-prod.yml` e `.env.prod.example` da raiz (o `.env.prod` local é ignorado pelo git; não tocar) e conferir com `git grep -n 'docker-compose-prod\|PROD_SSH\|appleboy'` que não restam referências fora de `specs/` e `.claude/` → dotnet-senior-developer
- [X] T032 [US4] Reescrever a seção "prod — pipeline de produção" de `README.md` (e a linha da tabela de ambientes): arquitetura (Cloudflare → Cloudflare Tunnel → ingress-nginx interno → namespace `finami`), tabela de secrets/variables de contracts/deploy-pipeline.md, como fazer deploy, rollback (pipeline com tag anterior + `skip_tests`; `kubectl rollout undo`), logs/status, aviso de migrations compatíveis com a versão anterior, links para `deploy/k8s/README.md` e para o quickstart; remover a menção ao "deploy de outro projeto" para o frontend → dotnet-senior-developer
- [X] T033 [P] [US4] Atualizar `frontend/README.md`: em produção o frontend é publicado pelo próprio Finami no cluster (imagem `finami-web`, rotas da API feitas pelo ingress, `VITE_GOOGLE_CLIENT_ID` vindo do GitHub); o proxy `/api` do `nginx.conf` vale só no `docker-compose.yml` local → dotnet-senior-developer
- [X] T034 [P] [US4] Completar `deploy/k8s/README.md` com: ordem de bootstrap (quickstart §0–§2), troca e reversão na Cloudflare (§5), desligamento do ambiente antigo (§6) e o plano B pelo branch `backup/sem-k8s` → dotnet-senior-developer
- [ ] T035 [US4] **manual** Após a troca validada (T020): parar e remover o container `finami-api` no servidor antigo, retirar o encaminhamento do Finami do proxy do outro projeto, remover os secrets `PROD_SSH_*` e `PROD_GIT_TOKEN` do GitHub e confirmar que o Finami e os demais projetos do servidor seguem no ar

**Checkpoint**: um único caminho de deploy, documentado.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T036 [P] Revisar todos os YAML de `deploy/k8s/` e o workflow contra data-model.md e contracts/ (nomes, portas, probes, recursos, anotações, secrets) e corrigir divergências → dotnet-senior-developer
- [X] T037 [P] Atualizar o checklist `specs/009-kubernetes-migration/checklists/requirements.md` com uma nota de que a implementação não alterou `backend/**`, `frontend/Dockerfile`, `frontend/nginx.conf` nem `docker-compose.yml` (FR-022) → dotnet-senior-developer
- [ ] T038 **manual** Rodar o quickstart completo uma vez de ponta a ponta e registrar no PR os tempos medidos (SC-003/004/005/006) e o resultado do roteiro SC-001

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup; T010/T011 (manuais) dependem de T004–T008 (incluindo T005a/T005b).
- **US1 (Phase 3)**: T012–T019 dependem de T009. A validação T020 depende de US2 e US3 (precisa de deploy e secrets).
- **US2 (Phase 4)**: depende de T009 e dos manifestos de US1 para aplicar algo; T021→T022→T023→T024→T025 no mesmo arquivo (sequenciais).
- **US3 (Phase 5)**: T027 e T028 editam o job `deploy` (depois de T024); T029 edita o job `test` (depois de T022).
- **US4 (Phase 6)**: T031–T034 podem ser feitos a qualquer momento após T021; T035 só depois de T020.
- **Polish (Phase 7)**: depois de todas as stories.

### User Story Dependencies

- US1, US2 e US3 são todas P1 e se completam: os arquivos de US1 são independentes, mas só é possível
  validar US1 em produção com a pipeline (US2) e os secrets (US3). Entrega mínima = US1 + US2 + US3.
- US4 é independente para os arquivos e depende de US1 validada para o desligamento (T035).

### Parallel Opportunities

- Phase 1: T002 e T003 em paralelo.
- Phase 2: T006 e T007 em paralelo; T004/T005/T005a/T005b em paralelo com T006–T008.
- US1: T012–T016 em paralelo (arquivos distintos); T017/T018 depois, em paralelo entre si.
- US4: T031, T033, T034 em paralelo.
- O workflow (`deploy-prod.yml`) é um arquivo único: T021–T029 são sequenciais.

## Parallel Example: User Story 1

```text
Task: "T012 Criar deploy/k8s/finami/api-configmap.yaml"
Task: "T013 Criar deploy/k8s/finami/api-deployment.yaml"
Task: "T014 Criar deploy/k8s/finami/api-service.yaml"
Task: "T015 Criar deploy/k8s/finami/web-deployment.yaml"
Task: "T016 Criar deploy/k8s/finami/web-service.yaml"
```

## Implementation Strategy

### MVP (US1 + US2 + US3)

1. Phases 1–2 (arquivos) → admin executa T010/T011.
2. US1 (manifestos) → US2 (pipeline) → US3 (secrets na pipeline).
3. T030 (cadastro dos secrets) → primeiro deploy → T020 (validação por port-forward, troca na Cloudflare, roteiro).
4. **Parar e validar**: tráfego real no cluster.

### Incremental

1. MVP no ar com a Cloudflare apontando para o cluster.
2. US4: remover o deploy antigo e atualizar a documentação; desligar o servidor antigo (T035).
3. Polish: revisão cruzada e registro das métricas (T036–T038).
