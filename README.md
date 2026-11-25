# Finami

Gestão financeira familiar: carteiras em Real e Bitcoin, famílias, transferências com compra e
venda de bitcoin na cotação atual e extratos por período.

| Pasta | Conteúdo |
|---|---|
| [`backend/`](backend/README.md) | API .NET 8 (Clean Architecture, EF Core + PostgreSQL, JWT) |
| [`frontend/`](frontend/README.md) | SPA React 18 + Vite + Tailwind 4, mobile-first |
| [`docs/design/`](docs/design/README.md) | Direção visual, tokens e mockups |
| [`specs/`](specs/) | Especificações, planos e tarefas (Spec Kit) |

## Ambientes

| | **dev** | **homolog** | **prod** |
|---|---|---|---|
| Onde roda | Máquina do desenvolvedor | Docker local | Kubernetes na DigitalOcean (`do-nyc2-emagine-k8s`, namespace `finami`) |
| `ASPNETCORE_ENVIRONMENT` | `Development` | `Docker` | `Production` |
| Configuração da API | `appsettings.Development.json` (valores locais) | `appsettings.Docker.json` + `.env` | `appsettings.Production.json` + ConfigMap/Secret do cluster |
| Configuração do frontend | `frontend/.env.development` | build args no `docker-compose.yml` | build args na pipeline (imagem `finami-web`) |
| Banco | PostgreSQL local (`finami_dev`) | Container `db` (porta 5433) | PostgreSQL externo (secret `FINAMI_CONNECTION_STRING`) |
| SSL | Não | Não | Sim — Cloudflare (público) + Cloudflare Tunnel até o cluster |
| Migrations | `dotnet ef database update` | Automáticas ao subir a API | Automáticas ao subir a API |
| Como subir | `dotnet run` + `npm run dev` | `docker compose up --build -d` | Pipeline **Deploy Production** |

### dev — desenvolvimento local

Requer .NET SDK 8+, Node 22+ e um PostgreSQL local (`postgres`/`postgres` na porta 5432).

```powershell
cd backend
# o dotnet ef lê a connection string só da variável de ambiente
$env:ConnectionStrings__FinamiContext = "Host=localhost;Port=5432;Database=finami_dev;Username=postgres;Password=postgres"
dotnet ef database update --project Finami.Infra --startup-project Finami.API
dotnet run --project Finami.API          # http://localhost:5145 (Swagger em /swagger)

cd ../frontend
npm install
npm run dev                              # http://localhost:5173
```

### homolog — Docker local

```bash
cp .env.example .env                     # ajuste senhas e segredo JWT
docker compose up --build -d
```

- Frontend: http://localhost:8080 · API: http://localhost:5145 (health em `/health`) · Banco: `localhost:5433`
- Dados persistem no volume `finami_homolog_pgdata` (`docker compose down -v` apaga).

### prod — pipeline de produção

API e frontend rodam no cluster Kubernetes da DigitalOcean `do-nyc2-emagine-k8s`, no namespace
`finami`, com 1 réplica cada. Manifestos, scripts de bootstrap e operação em
[`deploy/k8s/`](deploy/k8s/README.md); roteiro completo (pré-requisitos, validação, troca e plano B)
no [quickstart da feature 009](specs/009-kubernetes-migration/quickstart.md).

```text
navegador / cliente MCP
  → Cloudflare (TLS público, proxy)
  → Cloudflare Tunnel compartilhado emagine-k8s (pods cloudflared, conexão de saída; sem Load Balancer)
  → ingress-nginx compartilhado (interno, ClusterIP, HTTP; IP real via CF-Connecting-IP)
  → namespace finami: /api, /oauth, /.well-known/oauth-*, /mcp → finami-api:8080 · demais → finami-web:80
```

App e API ficam no mesmo domínio (requisito do MCP/OAuth e do PWA); `www.finami.site` redireciona
para `finami.site`. O PostgreSQL é externo (secret `FINAMI_CONNECTION_STRING`) e as migrations
rodam na subida da API.

**Deploy** — workflow [`Deploy Production`](.github/workflows/deploy-prod.yml), disparado
manualmente (**Actions → Deploy Production → Run workflow**, informando a branch ou tag, ex.:
`v1.2.0`):

1. `test` — build e testes do backend (`dotnet test`) e do frontend (`npm test` + `npm run build`).
   Pulado com `skip_tests=true`.
2. `manifests` — valida os manifestos (`kubectl kustomize`) e falha se houver credencial em
   `deploy/k8s/`.
3. `images` — gera e publica no GHCR `ghcr.io/emaginebr/finami-api` e
   `ghcr.io/emaginebr/finami-web` com as tags `sha-<commit>` e o nome da ref. Se a imagem
   `sha-<commit>` já existe, o build é pulado.
4. `deploy` — valida os secrets, cria/atualiza os Secrets do cluster, aplica `deploy/k8s/finami`
   com a imagem `sha-<commit>` e espera o rollout (até 10 min por Deployment). A versão nova só
   recebe tráfego quando fica saudável (a API checa o banco em `/health`); se não ficar, a
   pipeline falha mostrando pods, eventos e logs, e a versão anterior continua no ar.

O resumo da execução mostra ref, commit, imagens, URL e autor.

**Configuração no GitHub** (Settings → Environments → `production`):

| Tipo | Nome | Obrigatório | Descrição |
|---|---|---|---|
| Secret | `KUBECONFIG` | Sim | kubeconfig da ServiceAccount `finami-deployer` (gerado por `deploy/k8s/bootstrap/make-kubeconfig.sh`), com permissões só no namespace `finami`. **Nunca** o kubeconfig de admin da DigitalOcean |
| Secret | `FINAMI_CONNECTION_STRING` | Sim | Connection string do PostgreSQL externo → `ConnectionStrings__FinamiContext` |
| Secret | `FINAMI_JWT_SECRET` | Sim (≥ 32 bytes) | Chave HMAC do JWT (64+ caracteres aleatórios) → `Jwt__Secret` |
| Secret ou Variable | `FINAMI_GOOGLE_CLIENT_ID` | Não | OAuth Client ID do Google (terminado em `.apps.googleusercontent.com`) → `Google__ClientId` da API e build arg `VITE_GOOGLE_CLIENT_ID` do frontend. Não é o Client Secret (`GOCSPX-…`) |
| Secret ou Variable | `GHCR_PULL_USER` | Sim | Usuário dono do PAT de leitura do GHCR. Compartilhável: pode ser secret/variable da organização `emaginebr` |
| Secret | `GHCR_PULL_TOKEN` | Sim | PAT com **apenas** `read:packages` → Secret `ghcr-pull` (o cluster baixa as imagens com ele). Compartilhável: pode ser secret da organização `emaginebr` (de preferência de uma conta de máquina) |

A publicação no GHCR usa o `GITHUB_TOKEN` do próprio workflow. Se faltar um secret obrigatório, o
deploy falha antes de tocar no cluster, com o nome do que falta. Não há certificado de origem: o
token do Cloudflare Tunnel é credencial do cluster (aplicada pelo admin) e **não** fica no GitHub
do Finami.

O domínio de produção é fixo: `https://finami.site` (CORS e endereços do MCP/OAuth e da tela
`/autorizar`), definido em `backend/Finami.API/appsettings.Production.json`.

**Rollback**

- Rápido: rodar o **Deploy Production** com a tag anterior e `skip_tests=true` — as imagens já
  existem, então leva só o tempo do rollout.
- Emergência (sem GitHub): `kubectl -n finami rollout undo deployment/finami-api` (e
  `deployment/finami-web`).

**Logs e status** (com acesso ao cluster):

```bash
kubectl -n finami get deploy,pods,ingress
kubectl -n finami logs deploy/finami-api --tail=200 -f
kubectl -n finami describe pod <pod>
```

**Migrations**: durante o rolling update a versão anterior da API continua atendendo enquanto a
nova aplica as migrations. Por isso cada migration precisa ser compatível com a versão anterior
(colunas novas com default ou anuláveis; nada de remover/renomear o que a versão no ar ainda usa
no mesmo deploy).

Infra comum do cluster (ingress-nginx e Cloudflare Tunnel), bootstrap da credencial da pipeline, troca da origem
na Cloudflare e o plano B (voltar ao servidor antigo pelo branch `backup/sem-k8s`) estão em
[`deploy/k8s/README.md`](deploy/k8s/README.md).

## Assistentes de IA (MCP)

O Finami tem um servidor MCP com OAuth: assistentes como Claude, Claude Code e ChatGPT podem
consultar saldos e extratos e lançar receitas, despesas e transferências em nome da pessoa, que
autoriza a conexão no próprio app (tela `/autorizar`, com opção de só consultar) e pode desconectá-la
em **Conta → Assistentes conectados**.

- Endereço: `https://<domínio>/mcp` (dev e homolog: `http://localhost:5145/mcp`).
- Claude: Configurações → Conectores → *Adicionar conector personalizado* com esse endereço.
- Claude Code: `claude mcp add --transport http finami https://<domínio>/mcp` e `/mcp` para autenticar.
- Escopos `finami:read` e `finami:write`; 41 ferramentas em português, 4 recursos e 3 prompts.
- Permissões na família (feature 008): o responsável define, por membro, quem pode lançar e quem pode
  estornar (`PUT /api/groups/{groupId}/members/{userId}/permissions` ou a ferramenta
  `alterar_permissoes_membro`); as regras valem igual no app, na API e no MCP.

Detalhes (ferramentas, erros, limites, auditoria) em [`backend/README.md`](backend/README.md#servidor-mcp-feature-004)
e em [`specs/004-mcp-oauth-server/`](specs/004-mcp-oauth-server/).

## Versionamento

Commits seguem o formato do [GitVersion](GitVersion.yml) (`feat:`, `fix:`, `feat(x)!:` …). Cada
push no `main` gera uma tag `vX.Y.Z` e uma GitHub Release (`version-tag.yml` e
`create-release.yml`).
