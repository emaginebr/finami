# Finami no Kubernetes (DigitalOcean)

Cluster DOKS `do-nyc2-emagine-k8s`, namespace `finami`. Tráfego: **Cloudflare** (TLS público,
proxy) → **Cloudflare Tunnel compartilhado** `emagine-k8s` (pods `cloudflared` no namespace
`cloudflared`, conexão de saída, sem IP público nem Load Balancer) → **ingress-nginx compartilhado**
(interno, Service ClusterIP, HTTP) → Services `finami-api` (8080) e `finami-web` (80). O PostgreSQL
é externo.

Feature, decisões e roteiro completo: [`specs/009-kubernetes-migration/`](../../specs/009-kubernetes-migration/)
(principalmente o [quickstart](../../specs/009-kubernetes-migration/quickstart.md)).

| Pasta | Conteúdo | Quem aplica |
|---|---|---|
| [`infra/`](infra/) | entrada **compartilhada** do cluster: ingress-nginx (valores do Helm e script) e Cloudflare Tunnel (`cloudflared.yaml` e script) | admin do cluster, uma vez por cluster |
| [`bootstrap/`](bootstrap/) | namespace `finami` e a credencial restrita da pipeline (ServiceAccount `finami-deployer`) | admin do cluster, uma vez |
| [`finami/`](finami/) | recursos do Finami (Deployments, Services, Ingress, ConfigMap) via Kustomize | pipeline **Deploy Production** (`kubectl apply -k`) |

Nenhum arquivo daqui contém credenciais. Os Secrets `finami-api-secrets` e `ghcr-pull` são
criados pela pipeline a partir dos secrets do environment `production` do GitHub; a pipeline
valida isso a cada execução (job `manifests`). O token do túnel (Secret `cloudflared-token`, no
namespace `cloudflared`) é credencial do **cluster**: o admin o aplica com
`infra/install-cloudflared.sh` e ele não vai para o GitHub do Finami.

## Bootstrap (admin, uma vez)

Requer `kubectl` e `helm` na máquina do admin (ou WSL), com o kubeconfig **de admin** do cluster.
Esse kubeconfig nunca vai para o GitHub nem para o repositório.

1. **Pré-requisitos** (quickstart §0):
   - revogar qualquer token da DigitalOcean que tenha sido exposto e baixar um kubeconfig de admin
     novo (`doctl kubernetes cluster kubeconfig save do-nyc2-emagine-k8s`);
   - liberar o cluster no firewall do PostgreSQL (Managed DB: *Trusted sources*);
   - **anotar o IP do servidor antigo** no registro A/AAAA de `finami.site` (para a
     reversão);
   - Cloudflare Zero Trust → Networks → Tunnels → criar o túnel `emagine-k8s` (tipo
     *Cloudflared*), se ainda não existir, e copiar o token do conector (só para o passo 2);
   - criar um PAT (classic) só com `read:packages` para `GHCR_PULL_USER`/`GHCR_PULL_TOKEN`.
2. **Entrada compartilhada** (quickstart §1):

   ```bash
   deploy/k8s/infra/install-ingress.sh       # ingress-nginx interno (ClusterIP)
   deploy/k8s/infra/install-cloudflared.sh   # pede o token do túnel sem eco
   kubectl -n cloudflared get pods           # 2/2 Running; túnel HEALTHY no painel Zero Trust
   ```

   Se a IngressClass `nginx` já existir e for de outro projeto, o script não altera nada e lista
   as opções de real-ip que precisam ser conferidas. O IP real vem de `CF-Connecting-IP`,
   confiado só quando a conexão vem da faixa de pods do cluster (`proxy-real-ip-cidr` em
   [`infra/ingress-nginx-values.yaml`](infra/ingress-nginx-values.yaml), com o comando para
   reconferir a faixa). O token também pode vir de `CLOUDFLARE_TUNNEL_TOKEN`, mas o prompt evita
   deixá-lo no histórico do shell.
3. **Namespace e credencial da pipeline** (quickstart §2):

   ```bash
   kubectl apply -f deploy/k8s/bootstrap/
   deploy/k8s/bootstrap/make-kubeconfig.sh > finami-deployer.kubeconfig
   KUBECONFIG=finami-deployer.kubeconfig kubectl auth can-i create deployments -n finami   # yes
   KUBECONFIG=finami-deployer.kubeconfig kubectl auth can-i get pods -n kube-system         # no
   ```

   Cadastrar o conteúdo do arquivo como secret `KUBECONFIG` do environment `production` e **apagar
   o arquivo**. Cadastrar também os demais secrets (tabela no [README da raiz](../../README.md#prod--pipeline-de-produção)).
4. **Primeiro deploy**: Actions → **Deploy Production** → `ref` = `main` (ou a tag).
   Conferir com `kubectl -n finami get deploy,pods,ingress`.

## Troca da origem na Cloudflare

Antes da troca, validar direto no ingress por port-forward (quickstart §4):

```bash
kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 8080:80
# em outro terminal:
curl -s -H 'Host: finami.site' http://localhost:8080/healthz
curl -s -H 'Host: finami.site' http://localhost:8080/.well-known/oauth-authorization-server
```

Troca (quickstart §5) — alguns segundos fora do ar entre os passos 1 e 2:

1. Cloudflare → DNS da zona `finami.site`: apagar o registro A/AAAA de `finami.site` (o `www` **não** vai para o túnel: o servidor antigo fazia o redirect, então antes da troca crie a Redirect Rule da Cloudflare (Rules → Redirect Rules: `https://www.finami.site/*` → `https://finami.site/${1}`, 301, preservando a query string) + **Always Use HTTPS** (SSL/TLS → Edge Certificates) para o `http://`; o registro do `www` precisa estar proxied).
2. Zero Trust → Tunnels → `emagine-k8s` → *Public Hostnames*: adicionar `finami.site` e
   `www.finami.site` → Service `HTTP` `ingress-nginx-controller.ingress-nginx.svc.cluster.local:80`.
   O painel cria os CNAME `<id-do-túnel>.cfargotunnel.com` (proxied).
3. Rodar o roteiro de validação do quickstart (login e-mail/Google, transações, transferência,
   estorno, convite, cliente MCP, PWA) e conferir as contagens de dados.
4. Conferir no log da API (`kubectl -n finami logs deploy/finami-api`) que aparece o **IP real**
   dos clientes. Se aparecer um IP `10.109.x.x` (pod do cloudflared), o real-ip não está valendo
   (conferir `proxy-real-ip-cidr` no topo de `infra/ingress-nginx-values.yaml`).

**Reverter a troca**: remover os Public Hostnames do Finami no túnel (o painel apaga os CNAME) e
recriar os registros A/AAAA (proxied) com o IP do servidor antigo anotado no pré-requisito — o
efeito é quase imediato.

## Desligar o ambiente antigo

Só depois da troca validada (quickstart §6):

1. No servidor antigo: `docker stop finami-api && docker rm finami-api`.
2. Retirar o encaminhamento do Finami (`/api`, `/mcp`, `/oauth`, `/.well-known/oauth-*`) do proxy
   do outro projeto.
3. Remover no GitHub os secrets `PROD_SSH_*` e `PROD_GIT_TOKEN`.
4. Confirmar que o Finami e os demais projetos do servidor seguem no ar.

## Plano B — voltar ao servidor antigo

O estado anterior à migração (deploy por SSH + `docker-compose-prod.yml`) está no branch
`backup/sem-k8s`. No servidor antigo, com Docker:

```bash
cd /opt/finami && git fetch origin && git checkout --force backup/sem-k8s
# recriar .env.prod com FINAMI_CONNECTION_STRING, FINAMI_JWT_SECRET e FINAMI_GOOGLE_CLIENT_ID
docker compose --env-file .env.prod -f docker-compose-prod.yml up --build -d
```

Depois, repor o encaminhamento no proxy do outro projeto e apontar a Cloudflare de volta para o
servidor (remover os Public Hostnames do túnel e recriar os registros A/AAAA).

## Operação

| Ação | Como |
|---|---|
| Deploy | Actions → Deploy Production (`ref`) |
| Rollback rápido | Deploy Production com a tag anterior e `skip_tests=true` (a imagem já existe) |
| Rollback de emergência | `kubectl -n finami rollout undo deployment/finami-api` (e `finami-web`) |
| Logs | `kubectl -n finami logs deploy/finami-api --tail=200 -f` |
| Status | `kubectl -n finami get pods` / `kubectl -n finami describe pod <pod>` |
| Túnel | `kubectl -n cloudflared get pods` / `kubectl -n cloudflared logs deploy/cloudflared` (erro 1033 na Cloudflare = túnel sem conector) |
| Trocar o token do túnel | rodar de novo `infra/install-cloudflared.sh` (atualiza o Secret e reinicia os pods) |
