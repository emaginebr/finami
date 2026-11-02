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
| Onde roda | Máquina do desenvolvedor | Docker local | Servidor remoto (Docker) |
| `ASPNETCORE_ENVIRONMENT` | `Development` | `Docker` | `Production` |
| Configuração da API | `appsettings.Development.json` (valores locais) | `appsettings.Docker.json` + `.env` | `appsettings.Production.json` + `.env.prod` |
| Configuração do frontend | `frontend/.env.development` | build args no `docker-compose.yml` | build args no `docker-compose-prod.yml` |
| Banco | PostgreSQL local (`finami_dev`) | Container `db` (porta 5433) | PostgreSQL externo (secret `FINAMI_CONNECTION_STRING`) |
| SSL | Não | Não | Sim — no proxy HTTPS que já roda no servidor |
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

Workflow [`Deploy Production`](.github/workflows/deploy-prod.yml), disparado manualmente
(**Actions → Deploy Production → Run workflow**, informando a branch ou tag, ex.: `v1.2.0`):

1. Roda build e testes do backend.
2. Entra no servidor por SSH, atualiza o repositório em `/opt/finami` na ref escolhida, gera o
   `.env.prod` a partir dos Secrets/Variables do GitHub e executa
   `docker compose --env-file .env.prod -f docker-compose-prod.yml up --build -d`.
3. Espera a API ficar saudável (as migrations rodam na subida) e mostra os logs se falhar.

Este deploy sobe **só a API** (o banco é externo). O frontend é publicado pelo deploy de outro
projeto, cujo proxy HTTPS termina o TLS do domínio e encaminha `/api/*`, `/mcp*`, `/oauth/*` e
`/.well-known/oauth-*` para a API na porta 80 do servidor (publicada pelo compose) ou, se o
proxy roda em container, em `http://finami-api:8080` pela rede `emagine-network`. Ele deve repassar
`X-Forwarded-Proto`/`X-Forwarded-For` e não bufferizar `/mcp` (respostas em `text/event-stream`).
App e API ficam no mesmo domínio (requisito do MCP/OAuth e do PWA).

**Pré-requisitos no servidor**: Docker Engine com o plugin Compose, Git, um proxy HTTPS para o domínio e
o DNS do domínio apontando para o servidor.

**Configuração no GitHub** (Settings → Environments → `production`):

| Tipo | Nome | Descrição |
|---|---|---|
| Secret | `PROD_SSH_HOST` | IP ou hostname do servidor |
| Secret | `PROD_SSH_USER` | Usuário SSH (precisa poder usar `docker`) |
| Secret | `PROD_SSH_KEY` | Chave privada SSH (recomendado) — ou `PROD_SSH_PASSWORD` |
| Secret | `PROD_SSH_PORT` | Porta SSH (opcional, padrão 22) |
| Secret | `PROD_GIT_TOKEN` | Token só-leitura do repositório (necessário se ele for privado) |
| Secret | `FINAMI_CONNECTION_STRING` | Connection string do PostgreSQL externo (ex.: `Host=…;Port=5432;Database=finami;Username=…;Password=…;SSL Mode=Require`) |
| Secret | `FINAMI_JWT_SECRET` | Chave HMAC do JWT (64+ caracteres aleatórios) |
| Variable | `FINAMI_DOMAIN` | Domínio público (ex.: `finami.exemplo.com.br`); define o CORS e os endereços do MCP/OAuth e da tela `/autorizar` (`https://<FINAMI_DOMAIN>`) |
| Secret ou Variable | `FINAMI_GOOGLE_CLIENT_ID` | OAuth Client ID do Google, terminado em `.apps.googleusercontent.com`, usado pela API para validar o login Google (opcional). Não é o Client Secret (`GOCSPX-…`). O frontend recebe o mesmo valor no deploy dele |

Evite `$` nas senhas: o Docker Compose interpreta `$` como variável dentro do `.env.prod`.

## Assistentes de IA (MCP)

O Finami tem um servidor MCP com OAuth: assistentes como Claude, Claude Code e ChatGPT podem
consultar saldos e extratos e lançar receitas, despesas e transferências em nome da pessoa, que
autoriza a conexão no próprio app (tela `/autorizar`, com opção de só consultar) e pode desconectá-la
em **Conta → Assistentes conectados**.

- Endereço: `https://<domínio>/mcp` (dev e homolog: `http://localhost:5145/mcp`).
- Claude: Configurações → Conectores → *Adicionar conector personalizado* com esse endereço.
- Claude Code: `claude mcp add --transport http finami https://<domínio>/mcp` e `/mcp` para autenticar.
- Escopos `finami:read` e `finami:write`; 38 ferramentas em português, 4 recursos e 3 prompts.

Detalhes (ferramentas, erros, limites, auditoria) em [`backend/README.md`](backend/README.md#servidor-mcp-feature-004)
e em [`specs/004-mcp-oauth-server/`](specs/004-mcp-oauth-server/).

## Versionamento

Commits seguem o formato do [GitVersion](GitVersion.yml) (`feat:`, `fix:`, `feat(x)!:` …). Cada
push no `main` gera uma tag `vX.Y.Z` e uma GitHub Release (`version-tag.yml` e
`create-release.yml`).
