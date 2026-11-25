# Implementation Plan: Migração do Finami para Kubernetes (DigitalOcean)

**Branch**: `009-kubernetes-migration` | **Date**: 2026-11-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/009-kubernetes-migration/spec.md`

## Summary

API e frontend do Finami saem do servidor único (deploy por SSH + proxy de outro projeto) e passam
a rodar no cluster DOKS `do-nyc2-emagine-k8s`, no namespace `finami`, com 1 réplica cada. O
tráfego segue: Cloudflare (TLS público) → **Cloudflare Tunnel compartilhado** `emagine-k8s` (pods
`cloudflared` com conexão de saída; sem Load Balancer nem IP público) → **ingress-nginx
compartilhado** interno (ClusterIP, HTTP, IP real via `CF-Connecting-IP`) → Services. A pipeline
`Deploy Production` é reescrita: testes → imagens no **GHCR** (`sha-<commit>`) → `kubectl apply -k`
com rolling update sem queda (`maxSurge 1 / maxUnavailable 0`) e `rollout status`. A pipeline
acessa o cluster com uma ServiceAccount restrita ao namespace, nunca com o kubeconfig de admin. O
PostgreSQL externo não muda; as migrations continuam no startup da API. **Nenhuma mudança de
código da aplicação** — só infraestrutura, pipeline e documentação. O deploy por SSH é removido.

## Technical Context

**Language/Version**: YAML (Kubernetes 1.3x do DOKS, Kustomize embutido no `kubectl`), Bash (scripts de bootstrap/infra), GitHub Actions. Aplicação inalterada: C# 12 / .NET 8 e TypeScript 5.8 / React 18.3
**Primary Dependencies**: ingress-nginx (chart Helm oficial, infra compartilhada), GHCR, `docker/build-push-action`, `docker/login-action`, `azure/setup-kubectl`; Cloudflare (proxy + Tunnel, imagem `cloudflare/cloudflared` como infra compartilhada). Sem dependências novas na aplicação
**Storage**: PostgreSQL externo, inalterado (sem migrations novas)
**Testing**: pipeline roda `dotnet test` e `npm test` + `npm run build`; validação da infra pelo roteiro do [quickstart](quickstart.md) (curl via `kubectl port-forward` no ingress, `kubectl rollout status`, teste de autorrecuperação)
**Target Platform**: DigitalOcean Kubernetes (`do-nyc2-emagine-k8s`, nyc2), nós Linux amd64
**Project Type**: web-service + SPA (infra/deploy)
**Performance Goals**: deploy completo ≤ 15 min (SC-003); rollback ≤ 5 min (SC-005); autorrecuperação ≤ 2 min (SC-006); latência percebida não pior que hoje (SC-008)
**Constraints**: zero credenciais no repositório/logs (SC-007); sem queda perceptível em deploy (SC-004); cluster compartilhado com limites de CPU/memória; sem `docker` local (Princípio II); streaming `/mcp` sujeito ao limite de ~100 s da Cloudflare
**Scale/Scope**: 1 réplica de API + 1 de frontend (+ 2 réplicas do `cloudflared`, infra do cluster); ~10 manifestos; 1 workflow reescrito; 3 scripts de admin

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| I. Skills de arquitetura | Sem entidades, services ou telas novas; as skills `dotnet-architecture`/`react-architecture` não se aplicam | ✅ N/A |
| II. Stack fixa | Nenhuma tecnologia de aplicação nova. Docker/kubectl só na pipeline e na máquina do admin, nunca no ambiente local do agente | ✅ |
| III. Case sensitivity | Sem novos imports | ✅ N/A |
| IV. Convenções de código | Sem código de aplicação | ✅ N/A |
| V. Banco de dados | Sem mudanças de schema | ✅ N/A |
| VI. Autenticação e segurança | `Jwt__Secret`, connection string e `Google__ClientId` continuam vindo de variáveis de ambiente (agora de um Secret do cluster); validação de `Jwt__Secret` ≥ 32 bytes na pipeline; CORS de produção fixo em `https://finami.site` mantido; segredos nunca no frontend nem no repositório | ✅ |
| VII. Erros no backend | Sem controllers novos | ✅ N/A |
| VIII. Agentes especializados | Os arquivos desta feature (manifestos, workflow, scripts, README) não são código React nem .NET; nenhum dos três agentes cobre infra. Ver Complexity Tracking | ⚠️ Justificado |
| IX. Acessibilidade | Sem telas novas | ✅ N/A |
| Variáveis de ambiente | Mesmas variáveis da constituição; `VITE_API_URL` vazio = mesma origem (já suportado) | ✅ |

**Re-check pós-design (Phase 1)**: mantém-se. O design não exige mudanças de código; a única
ressalva continua sendo o Princípio VIII, justificada abaixo.

## Project Structure

### Documentation (this feature)

```text
specs/009-kubernetes-migration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routing.md
│   └── deploy-pipeline.md
├── checklists/requirements.md
└── tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
deploy/k8s/
├── infra/                          # infra COMPARTILHADA do cluster (admin, fora da pipeline)
│   ├── ingress-nginx-values.yaml   # Service ClusterIP; real-ip via CF-Connecting-IP da faixa de pods
│   ├── install-ingress.sh          # helm upgrade --install (pula se IngressClass nginx existe)
│   ├── cloudflared.yaml            # namespace cloudflared + Deployment do túnel emagine-k8s (2 réplicas)
│   └── install-cloudflared.sh      # Secret cloudflared-token (token sem eco) + apply + rollout
├── bootstrap/                      # uma vez, pelo admin
│   ├── namespace.yaml              # namespace finami
│   ├── deployer-rbac.yaml          # ServiceAccount + Role + RoleBinding + token Secret
│   └── make-kubeconfig.sh          # gera o kubeconfig do finami-deployer (para o secret KUBECONFIG)
└── finami/                         # aplicado pela pipeline (kubectl apply -k)
    ├── kustomization.yaml          # namespace finami + images (tag definida na pipeline)
    ├── api-configmap.yaml
    ├── api-deployment.yaml
    ├── api-service.yaml
    ├── web-deployment.yaml
    ├── web-service.yaml
    ├── ingress.yaml                # finami.site → web / api; sem tls (www: redirect na Cloudflare)
    └── ingress-mcp.yaml            # /mcp sem buffer, timeout 3600 s; sem tls

.github/workflows/deploy-prod.yml   # REESCRITO: test → images (GHCR) → deploy (kubectl)
docker-compose-prod.yml             # REMOVIDO
.env.prod.example                   # REMOVIDO
README.md                           # seção de produção reescrita (cluster, secrets, deploy, rollback, logs)
frontend/README.md                  # referência ao deploy de produção atualizada
```

Inalterados: `backend/**` (incluindo `Dockerfile` e `Program.cs`), `frontend/Dockerfile`,
`frontend/nginx.conf`, `docker-compose.yml` (dev local, FR-022), `.github/workflows/version-tag.yml`
e `create-release.yml`.

**Structure Decision**: nova pasta `deploy/k8s/` na raiz, separando a infra compartilhada
(`infra/`), o bootstrap de admin (`bootstrap/`) e os recursos do Finami aplicados pela pipeline
(`finami/`), conforme R-01, R-02 e R-09.

## Phase 0 — Research

Ver [research.md](research.md). Nenhum `NEEDS CLARIFICATION` restante. Decisões principais:
Kustomize (R-01), Cloudflare Tunnel + ingress-nginx interno compartilhados, instalados pelo admin
(R-02), real-ip via `CF-Connecting-IP` confiado da faixa de pods (R-03), TLS só na Cloudflare, sem
certificado de origem (R-04), Ingress direto para a API (R-05), migrations no startup (R-06),
probes sem banco na liveness (R-07), GHCR (R-08), ServiceAccount restrita (R-09), pipeline e
rollback (R-10).

## Phase 1 — Design

- [data-model.md](data-model.md): recursos do cluster, regras dos Deployments e validações.
- [contracts/routing.md](contracts/routing.md): roteamento público, cabeçalhos e erros de borda.
- [contracts/deploy-pipeline.md](contracts/deploy-pipeline.md): inputs, secrets, jobs e garantias.
- [quickstart.md](quickstart.md): pré-requisitos, bootstrap, deploy, validação, troca, rollback e
  plano B.

## Riscos

| Risco | Mitigação |
|---|---|
| Banco não aceita o cluster | Pré-requisito 0.2; readiness com `/health` faz o deploy falhar sem trocar tráfego |
| IngressClass `nginx` já instalada por outro projeto com outra config | `install-ingress.sh` detecta e não reinstala; conferir as opções de real-ip antes da troca |
| Túnel compartilhado fora do ar (erro 1033 para todos os projetos) | 2 réplicas do `cloudflared` com antiafinidade por nó, probes em `/ready`; status no painel Zero Trust |
| Faixa de pods muda (novos nós) e o IP real deixa de valer | `proxy-real-ip-cidr` com a /16 inteira; comando para reconferir no topo de `ingress-nginx-values.yaml`; conferência do IP no log da API (quickstart §5) |
| Troca no DNS deixa o site alguns segundos fora do ar | Apagar os A/AAAA e criar os Public Hostnames em sequência; reversão documentada com o IP antigo anotado no §0 |
| Migration incompatível com a versão anterior durante o rolling | Prática atual (colunas com default/anuláveis); registrar no README |
| Token `dop_v1_…` exposto no chat | Revogar antes de tudo (quickstart 0.1); pipeline usa ServiceAccount restrita |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Princípio VIII — trabalho de infra/deploy sem agente dedicado | Manifestos, workflow e scripts não são código React nem .NET; ficam com o **dotnet-senior-developer**, que já tem as skills `dotnet-env` e `deploy-prod` e era dono do deploy atual. README/documentação: o mesmo agente, com o agente `analyst` opcional para `docs/` | Criar um agente de DevOps só para esta feature exigiria emendar a constituição; deixar sem dono quebraria a regra de "exatamente um agente por tarefa" |
