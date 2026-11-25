# Quickstart — 009 Migração para Kubernetes

Roteiro de ponta a ponta: preparar o cluster, publicar, validar, trocar a origem na Cloudflare e,
se preciso, voltar. Comandos `kubectl`/`helm` rodam na máquina do admin (ou num shell WSL), **não**
no ambiente do agente (Princípio II: sem Docker/infra local).

## 0. Pré-requisitos (uma vez)

1. **Revogar** o token `dop_v1_…` compartilhado no chat (DigitalOcean → API → Tokens) e baixar um
   kubeconfig de admin novo: `doctl kubernetes cluster kubeconfig save do-nyc2-emagine-k8s`.
   Esse kubeconfig fica só na máquina do admin.
2. **PostgreSQL**: liberar o cluster no firewall (Managed DB: *Trusted sources* → cluster
   `do-nyc2-emagine-k8s`).
3. **Cloudflare** (zona `finami.site`):
   - DNS → **anotar o IP do servidor antigo** no registro A/AAAA de `finami.site`
     (necessário para a reversão do §5).
   - Zero Trust → Networks → Tunnels → *Create a tunnel* → tipo *Cloudflared*, nome `emagine-k8s`
     (só se ainda não existir: o túnel é do cluster, compartilhado com os outros projetos). Na tela
     de instalação do conector, copiar **só o token** — ele é usado no §1 e não vai para o GitHub
     nem para arquivo algum. Ainda **não** criar os Public Hostnames (isso é a troca, §5).
   - Não há certificado de origem nem mudança de modo SSL: o túnel é criptografado até a Cloudflare.
4. **GHCR**: criar um PAT (classic) com escopo só `read:packages` → `GHCR_PULL_USER`/`GHCR_PULL_TOKEN`.

## 1. Infra comum de entrada (admin, uma vez por cluster)

```bash
deploy/k8s/infra/install-ingress.sh       # ingress-nginx interno (ClusterIP); pula se a IngressClass nginx já existe
deploy/k8s/infra/install-cloudflared.sh   # pede o token do túnel sem eco; cria o Secret e sobe 2 pods cloudflared
kubectl -n ingress-nginx get svc ingress-nginx-controller   # TYPE ClusterIP, sem EXTERNAL-IP
kubectl -n cloudflared get pods                               # 2/2 Running
```

No painel Zero Trust, o túnel `emagine-k8s` deve aparecer como **HEALTHY** (2 conectores).

O script também aceita `CLOUDFLARE_TUNNEL_TOKEN=... deploy/k8s/infra/install-cloudflared.sh`, mas
prefira o prompt: assim o token não fica no histórico do shell. Para trocar o token depois, basta
rodar o script de novo.

## 2. Bootstrap do namespace e da credencial da pipeline (admin, uma vez)

```bash
kubectl apply -f deploy/k8s/bootstrap/
deploy/k8s/bootstrap/make-kubeconfig.sh > finami-deployer.kubeconfig
```

Cadastrar o conteúdo de `finami-deployer.kubeconfig` como secret `KUBECONFIG` do environment
`production` no GitHub e **apagar o arquivo local**. Cadastrar também os demais secrets do
[contrato da pipeline](contracts/deploy-pipeline.md).

Teste de privilégio mínimo:

```bash
KUBECONFIG=finami-deployer.kubeconfig kubectl auth can-i create deployments -n finami   # yes
KUBECONFIG=finami-deployer.kubeconfig kubectl auth can-i get pods -n kube-system         # no
```

## 3. Primeiro deploy

GitHub → **Actions → Deploy Production → Run workflow** (`ref` = `main` ou a tag). Esperado: os três
jobs verdes em até 15 min (SC-003) e `finami-api`/`finami-web` com 1/1 prontos:

```bash
kubectl -n finami get deploy,pods,ingress
```

## 4. Validação antes da troca (tráfego ainda no servidor antigo)

O ingress não tem endereço público; a validação é feita por port-forward, direto no ingress-nginx:

```bash
kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 8080:80
```

Em outro terminal:

```bash
curl -s -H 'Host: finami.site' http://localhost:8080/healthz                                   # ok
curl -s -H 'Host: finami.site' http://localhost:8080/api/... -o /dev/null -w '%{http_code}\n'
curl -s -H 'Host: finami.site' http://localhost:8080/.well-known/oauth-authorization-server
```

(O `X-Forwarded-Proto: https` simula o que a Cloudflare envia pelo túnel; sem ele o `Location` do
redirect sai com `http://`.)

## 5. Troca da origem na Cloudflare

Entre os passos 1 e 2 o site fica **alguns segundos fora do ar** (os nomes não podem ter registro
A/AAAA e CNAME ao mesmo tempo). Faça os dois em sequência.

1. Cloudflare → DNS da zona `finami.site`: apagar o registro A/AAAA de `finami.site` (o `www` **não** vai para o túnel: o servidor antigo fazia o redirect, então antes da troca crie a Redirect Rule da Cloudflare (Rules → Redirect Rules: `https://www.finami.site/*` → `https://finami.site/${1}`, 301, preservando a query string) + **Always Use HTTPS** (SSL/TLS → Edge Certificates) para o `http://`; o registro do `www` precisa estar proxied).
2. Zero Trust → Networks → Tunnels → `emagine-k8s` → *Public Hostnames* → adicionar:
   - `finami.site` → Service `HTTP` `ingress-nginx-controller.ingress-nginx.svc.cluster.local:80`;

   O painel cria os registros CNAME `<id-do-túnel>.cfargotunnel.com` (proxied) na zona.
3. Roteiro de validação (SC-001): abrir `https://finami.site`, login e-mail e Google, listar e criar
   transação, transferência, estorno, convite de família, conectar um cliente MCP (OAuth) e uma
   chamada `/mcp`, abrir o PWA instalado; `https://www.finami.site/` redireciona (301, regra da Cloudflare) para
   `https://finami.site/`.
4. Contagem de usuários/grupos/transações igual à de antes (SC-002).
5. Conferir no log da API (`kubectl -n finami logs deploy/finami-api`) que o IP dos clientes é o
   real. Se aparecer um `10.109.x.x` (pod do cloudflared), conferir `proxy-real-ip-cidr` no
   `deploy/k8s/infra/ingress-nginx-values.yaml` (comando para reconferir a faixa de pods no
   comentário).

**Reverter a troca** (se algo falhar nos minutos seguintes): remover o Public Hostname
`finami.site` do túnel (o painel apaga o CNAME) e recriar o registro A/AAAA
(proxied) com o IP do servidor antigo anotado no passo 0.3 — efeito quase imediato.

## 6. Desligar o ambiente antigo

No servidor antigo: `docker stop finami-api && docker rm finami-api`, e retirar o encaminhamento
do Finami do proxy do outro projeto. Remover no GitHub os secrets `PROD_SSH_*` e `PROD_GIT_TOKEN`.

## Operação

| Ação | Como |
|---|---|
| Deploy | Actions → Deploy Production (`ref`) |
| Rollback rápido | Deploy Production com a tag anterior e `skip_tests=true` (imagem já existe) |
| Rollback de emergência | `kubectl -n finami rollout undo deployment/finami-api` (e `finami-web`) |
| Logs | `kubectl -n finami logs deploy/finami-api --tail=200 -f` |
| Status | `kubectl -n finami get pods` / `kubectl -n finami describe pod <pod>` |
| Túnel (infra do cluster) | `kubectl -n cloudflared get pods` / `kubectl -n cloudflared logs deploy/cloudflared`; erro 1033 na Cloudflare = nenhum conector |
| Teste de autorrecuperação (SC-006) | `kubectl -n finami delete pod -l app=finami-api` → site volta em ≤ 2 min |

## Voltar ao servidor antigo (plano B)

O estado anterior está no branch `backup/sem-k8s`. No servidor antigo, com Docker:

```bash
cd /opt/finami && git fetch origin && git checkout --force backup/sem-k8s
# recriar .env.prod com FINAMI_CONNECTION_STRING, FINAMI_JWT_SECRET, FINAMI_GOOGLE_CLIENT_ID
docker compose --env-file .env.prod -f docker-compose-prod.yml up --build -d
```

Depois, repor o encaminhamento no proxy do outro projeto e apontar a Cloudflare de volta (remover
os Public Hostnames do Finami no túnel e recriar os registros A/AAAA com o IP do servidor).
