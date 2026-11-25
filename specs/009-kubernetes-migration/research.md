# Research — 009 Migração para Kubernetes (DigitalOcean)

Decisões técnicas para a spec, a partir do código atual (`backend/Dockerfile`, `frontend/Dockerfile`,
`frontend/nginx.conf`, `backend/Finami.API/Program.cs`, `.github/workflows/deploy-prod.yml`) e das
respostas da sessão de clarificação de 2026-11-25.

---

## R-01 — Formato dos manifestos: Kustomize (sem Helm para o Finami)

- **Decision**: manifestos YAML puros em `deploy/k8s/finami/`, aplicados com `kubectl apply -k`
  (Kustomize embutido no `kubectl`). A tag das imagens é definida na pipeline com
  `kustomize edit set image` (o `kustomize` já vem nos runners `ubuntu-latest`).
- **Rationale**: o Finami tem 2 Deployments, 2 Services e 2 Ingress; não há variação entre
  ambientes (só produção). Kustomize não adiciona dependência e o YAML fica legível no repositório.
- **Alternatives considered**: Helm chart próprio (templating desnecessário para um único ambiente);
  `kubectl set image` sem Kustomize (perde o estado declarativo das imagens).

## R-02 — Entrada compartilhada: ingress-nginx interno atrás de um Cloudflare Tunnel do cluster

- **Decision** (revisada em 2026-11-25, clarificação Q6): a entrada pública do cluster é um
  **Cloudflare Tunnel compartilhado** (`emagine-k8s`), e não um Load Balancer da DigitalOcean:
  - Túnel *remotely-managed*, criado no painel Cloudflare Zero Trust (Networks → Tunnels). Os
    *Public Hostnames* ficam no painel, por projeto; para o Finami, `finami.site` e
    `www.finami.site` → `HTTP` `ingress-nginx-controller.ingress-nginx.svc.cluster.local:80`.
    Outros projetos adicionam os hostnames deles no mesmo túnel, apontando para o mesmo ingress.
  - Conector: Deployment `cloudflared` no namespace `cloudflared` (`deploy/k8s/infra/cloudflared.yaml`),
    2 réplicas com antiafinidade preferida por nó, imagem fixa `cloudflare/cloudflared:2026.11.2`,
    não-root, sistema de arquivos somente-leitura, probes em `/ready` (porta de métricas 2000). O
    token do túnel fica no Secret `cloudflared-token`, criado por
    `deploy/k8s/infra/install-cloudflared.sh` (prompt sem eco ou `CLOUDFLARE_TUNNEL_TOKEN`). É
    credencial do cluster: não vai para o GitHub nem para a pipeline do Finami.
  - Controller **ingress-nginx** (chart oficial, fixado em 4.15.1) no namespace `ingress-nginx`,
    com Service **`ClusterIP`** (só pods do cluster o alcançam). Valores em
    `deploy/k8s/infra/ingress-nginx-values.yaml`; instalação com `helm upgrade --install`
    (`deploy/k8s/infra/install-ingress.sh`), feita uma única vez pelo admin.
  - A pipeline do Finami **não** instala nem altera a infra comum (FR-002a).
- **Rationale**: elimina o custo do LB e não expõe IP público nem porta no cluster (o `cloudflared`
  só abre conexões de saída). O ingress-nginx continua sendo o ponto comum de roteamento, com tudo o
  que o Finami precisa (`proxy-buffering off` por rota, timeouts longos, redirect do `www`). Ficar
  fora da pipeline do Finami evita que um deploy do Finami derrube a entrada dos outros projetos e
  evita dar à pipeline permissões de cluster inteiro.
- **Consequências**: deixam de existir o PROXY protocol, o problema de *hairpin* (chamadas de dentro
  do cluster para o IP do LB) e a necessidade de restringir o LB às faixas da Cloudflare. Se o túnel
  cair (nenhum conector), a Cloudflare responde 1033 para todos os projetos do túnel — daí as 2
  réplicas.
- **Pre-check**: antes de instalar, `install-ingress.sh` verifica se já existe uma `IngressClass`
  `nginx`; se existir (instalada por outro projeto), não reinstala e só lista as opções da R-03.
- **Alternatives considered**: Traefik (anotações diferentes, menos documentação para os casos de
  SSE e real-ip); Gateway API (ainda pouco usado no DOKS para esse cenário); LB por projeto
  (descartado na clarificação Q1); ver também as alternativas ao túnel na R-04.

## R-03 — IP real do cliente e esquema atrás do túnel

- **Decision**: o tráfego chega ao nginx por HTTP, vindo dos pods `cloudflared` (IP da faixa de
  pods do cluster). `controller.config`:
  - `use-forwarded-headers: "true"` — repassa o `X-Forwarded-Proto: https` que a Cloudflare envia
    pelo túnel (sem isso a API veria `http`);
  - `enable-real-ip: "true"`, `forwarded-for-header: "CF-Connecting-IP"`,
    `compute-full-forwarded-for: "false"`;
  - `proxy-real-ip-cidr: "10.109.0.0/16"` — faixa de pods do cluster, conferida em 2026-11-25 pelos
    CiliumNodes (`10.109.0.0/25` e `10.109.0.128/25`). Reconferir com
    `kubectl get ciliumnodes -o jsonpath='{range .items[*]}{.spec.ipam.podCIDRs}{"\n"}{end}'`.
  - A API recebe `X-Forwarded-For` = IP real e `X-Forwarded-Proto` = `https`.
- **Segurança**: o ingress é `ClusterIP`, então só pods do cluster falam com ele; o
  `CF-Connecting-IP` é confiado apenas de dentro do cluster. Na borda, a Cloudflare sobrescreve esse
  cabeçalho com o IP de quem conectou, então o cliente não consegue forjá-lo.
- A API já confia em `X-Forwarded-For/Proto` vindos de qualquer origem (`Program.cs`, KnownNetworks
  limpos), o que continua seguro porque o Service da API é `ClusterIP`: só o ingress fala com ela.
  **Nenhuma mudança de código no backend.**
- **Rationale**: atende o FR-004 e o caso de borda de IP forjado sem depender de cada projeto.
- **Validation**: o quickstart confere, após a troca, que o log da API mostra o IP real dos
  clientes (e não um `10.109.x.x` do cloudflared) e que o rate limit de `/oauth/token` usa esse IP.
- **Alternatives considered**: manter as faixas públicas da Cloudflare em `proxy-real-ip-cidr` (não
  se aplica: as conexões chegam dos pods do cloudflared, não da Cloudflare).

## R-04 — TLS: Cloudflare na borda + túnel criptografado (sem certificado de origem)

- **Decision**: o HTTPS público termina na Cloudflare (certificado dela, como hoje). O trecho
  Cloudflare → cluster é o próprio túnel (criptografado, iniciado de dentro do cluster); do
  `cloudflared` ao ingress é HTTP dentro do cluster. Os Ingress do Finami **não** têm seção `tls` e
  declaram `nginx.ingress.kubernetes.io/ssl-redirect: "false"` (não há redirect para HTTPS dentro
  do cluster). Não há Origin Certificate, Secret TLS nem secrets de certificado no GitHub.
- **Rationale**: decisão Q6 (substitui o Origin Certificate da Q5). Nada para emitir ou renovar no
  cluster; o modo SSL da zona não se aplica ao trecho do túnel.
- **Pré-validação**: sem endereço público, a validação antes da troca é feita com
  `kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 8080:80` e
  `curl -H 'Host: finami.site' http://localhost:8080/...` (quickstart §4).
- **Alternatives considered**:
  - LB da DigitalOcean (~US$ 12/mês) com Origin Certificate na origem — o desenho anterior;
    custo fixo, IP público exposto, PROXY protocol e hairpin.
  - Expor o ingress no IP de um nó (`hostPort`/`NodePort`) — nós são recriados pela DigitalOcean e
    o IP muda; sem alta disponibilidade.
  - Reserved IP da DigitalOcean — só se associa a Droplets, não acompanha a reciclagem dos nós do
    DOKS.
  - MetalLB — inviável na DO (não há anúncio L2/BGP de IPs na rede da DigitalOcean).
  - cert-manager + Let's Encrypt — desnecessário atrás da Cloudflare.

## R-05 — Roteamento: Ingress do Finami chama a API diretamente

- **Decision**: dois objetos Ingress no namespace `finami`, hosts `finami.site` e `www.finami.site`:
  - `finami` — `/api`, `/oauth`, `/.well-known/oauth-` → Service `finami-api:8080`;
    `/` → Service `finami-web:80`. `www` redireciona para o domínio sem `www`
    (`nginx.ingress.kubernetes.io/from-to-www-redirect: "true"`).
  - `finami-mcp` — `/mcp` → `finami-api:8080`, com `proxy-buffering: "off"`,
    `proxy-read-timeout`/`proxy-send-timeout: "3600"` (mesmo comportamento do nginx atual).
  - Os dois sem seção `tls` e com `nginx.ingress.kubernetes.io/ssl-redirect: "false"` (R-04).
- O `nginx.conf` do frontend continua igual: no cluster ele só serve a SPA (as rotas de API não
  chegam nele). As `location /api` etc. com `resolver 127.0.0.11` seguem usadas no
  `docker-compose.yml` local (FR-022) e não impedem o nginx de subir no cluster (resolução só na
  hora da requisição).
- **Rationale**: um salto a menos (Cloudflare → túnel → ingress → API), sem precisar adaptar o DNS
  interno do nginx para o Kubernetes.
- **Alternatives considered**: manter o nginx do frontend como proxy da API (exigiria template com
  `resolver` do CoreDNS e nome do Service); um Ingress único (anotações de buffer valem por objeto).
- **Observação**: `www.finami.site` já resolve na Cloudflare (proxied) e também ganha um Public
  Hostname no túnel; o redirecionamento passa a ser feito no ingress, a não ser que já exista uma
  regra de redirect na Cloudflare. O `Location` usa o esquema de `X-Forwarded-Proto` (`https`).

## R-06 — Migrations com 1 réplica e rolling update

- **Decision**: manter `Database:MigrateOnStartup=true` (comportamento atual). Com 1 réplica e
  estratégia `RollingUpdate` (`maxSurge: 1`, `maxUnavailable: 0`), só o pod novo aplica migrations
  enquanto o antigo continua atendendo — o mesmo que ocorre hoje no `docker compose up`. Para
  proteger o caso raro de dois pods novos simultâneos (ex.: escala futura), o EF Core 9 com o
  Npgsql 9 faz um lock do histórico de migrations durante o `MigrateAsync`.
- **Requisito de deploy**: migrations precisam continuar compatíveis com a versão anterior da API
  durante a troca (já é a prática do projeto: colunas novas com default ou anuláveis).
- **Rationale**: FR-009 sem mudar código e sem Job extra.
- **Alternatives considered**: Job de migration antes do rollout (`dotnet ef database update` ou um
  bundle de migrations): mais peças (imagem SDK ou bundle e ordenação na pipeline) sem ganho com 1
  réplica. Fica registrado como evolução caso as réplicas aumentem.

## R-07 — Probes

- **Decision**:
  - API: `startupProbe` TCP 8080 (5s × 60 = até 5 min, cobre migrations, pois o Kestrel só abre a
    porta depois do `MigrateAsync`); `readinessProbe` HTTP `GET /health` (já inclui o PostgreSQL);
    `livenessProbe` TCP 8080 (não usa o banco: uma oscilação do PostgreSQL não deve reiniciar o pod).
  - Frontend: `readinessProbe` e `livenessProbe` HTTP `GET /healthz` (já existe no `nginx.conf`).
- **Rationale**: FR-006 e o caso "banco recusa conexões do cluster": a réplica nova não fica
  pronta, o `kubectl rollout status` expira e a pipeline falha mantendo a versão anterior.
- `UseHttpsRedirection` não interfere nas probes: sem porta HTTPS configurada, a API não redireciona
  (mesmo comportamento do healthcheck atual do compose).

## R-08 — Registro de imagens: GHCR

- **Decision**: `ghcr.io/emaginebr/finami-api` e `ghcr.io/emaginebr/finami-web`, privados. Tags:
  `sha-<commit curto>` (imutável, usada no deploy) e o nome da ref sanitizado (ex.: `v1.2.3`, `main`).
  A pipeline publica com `GITHUB_TOKEN` (`permissions: packages: write`) usando
  `docker/build-push-action` com cache do GitHub Actions (`type=gha`).
- O cluster baixa com o Secret `ghcr-pull` (`kubernetes.io/dockerconfigjson`), criado pela pipeline
  a partir de `GHCR_PULL_USER` e `GHCR_PULL_TOKEN` (PAT com escopo **apenas** `read:packages`).
- Se a imagem `sha-<commit>` já existe, o build é pulado (rollback rápido — R-10).
- **Rationale**: decisão Q2.

## R-09 — Acesso da pipeline ao cluster: ServiceAccount com permissões só no namespace

- **Decision**: o kubeconfig de admin da DigitalOcean **não** vai para o GitHub. Um bootstrap único,
  feito pelo admin (`deploy/k8s/bootstrap/`), cria o namespace `finami`, a ServiceAccount
  `finami-deployer`, um `Role` restrito ao namespace (deployments, replicasets, pods, pods/log,
  services, ingresses, secrets, configmaps, events) com `RoleBinding`, e um Secret de token
  de longa duração para a SA. O script `deploy/k8s/bootstrap/make-kubeconfig.sh` gera um kubeconfig
  com esse token, que o admin cadastra como secret `KUBECONFIG` no environment `production`.
- **Rationale**: FR-016 e o fato de o token `dop_v1_…` do kubeconfig da DigitalOcean ser um token
  de API da conta (acesso além do cluster). Se o secret do GitHub vazar, o impacto fica limitado ao
  namespace do Finami.
- **Alternatives considered**: guardar o kubeconfig da DigitalOcean (`doctl kubernetes cluster
  kubeconfig`) com um token DO de escopo reduzido — melhor que admin, mas ainda é um token de conta e
  expira/rotaciona fora do controle do cluster.
- **Ação imediata do mantenedor**: revogar o token `dop_v1_…` exposto no chat e gerar outro.

## R-10 — Pipeline de deploy (substitui o deploy por SSH)

- **Decision**: o novo `.github/workflows/deploy-prod.yml` (mesmo nome e mesmo gatilho
  `workflow_dispatch` com `ref`, `concurrency: deploy-production`) com os jobs:
  1. `test` — igual ao atual (`dotnet test`) **e** `npm ci && npm test && npm run build` do frontend.
  2. `images` (needs `test`) — resolve o commit; para `api` e `web`, pula se a tag `sha-<commit>`
     já existir; senão faz build e push. O frontend recebe `VITE_GOOGLE_CLIENT_ID` como build arg;
     `VITE_API_URL` vazio (mesma origem).
  3. `deploy` (needs `images`, environment `production`) — valida os secrets obrigatórios (lista no
     contrato) com mensagem do que falta; configura `kubectl`; cria/atualiza os Secrets
     (`kubectl create secret ... --dry-run=client -o yaml | kubectl apply -f -`, nunca com `echo`
     dos valores); `kustomize edit set image`; `kubectl apply -k`; `kubectl rollout status` dos
     dois Deployments com `--timeout=10m`. Em falha: `kubectl describe` + `kubectl logs --tail=100`
     do pod novo e `exit 1` (o pod antigo continua atendendo, pois `maxUnavailable: 0`).
  4. Resumo no `GITHUB_STEP_SUMMARY` (ref, commit, imagens, URL).
- Input opcional `skip_tests` (padrão `false`) para rollback de emergência de uma ref já testada.
- **Rollback**: (a) reexecutar o workflow com a ref/tag anterior — imagens já existem, então leva só
  o tempo do rollout (SC-005); (b) emergência sem GitHub: `kubectl -n finami rollout undo
  deployment/finami-api` (e `finami-web`).
- **Rationale**: FR-010 a FR-015 e SC-003/004/005.

## R-11 — Estado em memória da API com 1 réplica

- **Achados**: rate limiter nativo (em memória, por réplica), `IMemoryCache` no `QuoteService`
  (só cache), nenhum uso explícito de Data Protection (JWT stateless; tokens OAuth/MCP no banco).
- **Decision**: nada a mudar com 1 réplica. Registrado para quando as réplicas aumentarem: o rate
  limit passa a ser por réplica (limite efetivo × N) — aceitável ou migrar para armazenamento
  compartilhado.

## R-12 — Recursos e isolamento

- **Decision**: namespace `finami`; `requests`/`limits` — API `100m/256Mi` → `500m/512Mi`; web
  `10m/32Mi` → `200m/128Mi`; `revisionHistoryLimit: 5`; containers sem root (a imagem da API já usa
  `USER app`; o nginx oficial roda o master como root — aceito, pois o nginx `unprivileged` exigiria
  mudar a porta 80 do `nginx.conf` usado também no compose local). `automountServiceAccountToken:
  false` nos pods.
- **Rationale**: FR-001 e FR-007.

## R-13 — PostgreSQL externo

- **Decision**: nada muda no banco nem na connection string (`FINAMI_CONNECTION_STRING`). Antes do
  primeiro deploy, liberar a origem do cluster no firewall do PostgreSQL: se for DigitalOcean Managed
  Database, adicionar o cluster `do-nyc2-emagine-k8s` como **trusted source**; senão, liberar o IP
  de saída dos nós (ou do NAT gateway do cluster, se houver).
- **Rationale**: FR-008 e o caso de borda de conexão recusada (a probe de prontidão denuncia).

## R-14 — Remoção do deploy antigo

- **Decision** (Q4): remover `docker-compose-prod.yml`, `.env.prod.example`, a versão SSH de
  `.github/workflows/deploy-prod.yml` e os secrets `PROD_SSH_*`/`PROD_GIT_TOKEN` (estes no GitHub,
  pelo mantenedor). `docker-compose.yml` (local) permanece. README e `frontend/README.md` passam a
  descrever o deploy no cluster. O retorno ao servidor antigo usa o branch `backup/sem-k8s`
  (procedimento no quickstart).
