# Feature Specification: Migração do Finami para Kubernetes (DigitalOcean)

**Feature Branch**: `009-kubernetes-migration`
**Created**: 2026-11-25
**Status**: Draft
**Input**: User description: "Preciso migrar esse serviço (backend e frontend) para um cluster Kubernetes gerenciado na DigitalOcean (cluster `do-nyc2-emagine-k8s`, região nyc2). O kubeconfig de admin NÃO deve ser gravado em nenhum arquivo do repositório; deve ser referenciado apenas como segredo. O banco de dados PostgreSQL continua da mesma forma (fora do cluster, sem migração)."

## Contexto

Hoje a produção (https://finami.site) roda num servidor único: a pipeline de deploy acessa o servidor
por SSH, faz o build e sobe só a API em container. O frontend (SPA) é publicado pelo deploy de
**outro projeto**, cujo proxy HTTPS encaminha `/api/*`, `/mcp*`, `/oauth/*` e `/.well-known/oauth-*`
para a API. O PostgreSQL é externo e acessado por connection string.

Esta feature leva **API e frontend** do Finami para o cluster Kubernetes gerenciado
`do-nyc2-emagine-k8s` (DigitalOcean, nyc2), com deploy próprio e independente do outro projeto.
O banco **não muda**.

## Clarifications

### Session 2026-11-25

- Q: Como o tráfego público entra no cluster e quem emite o HTTPS? → A: Infra de entrada compartilhada no cluster (um ingress controller para todos os projetos); o Finami só declara suas rotas e instala a infra comum se ela ainda não existir. O certificado público é da Cloudflare (ver Q5); a entrada pública no cluster é um Cloudflare Tunnel compartilhado, sem Load Balancer (ver Q6).
- Q: Qual registro privado de imagens usar? → A: GitHub Container Registry (GHCR), privado na organização `emaginebr`; a pipeline publica com o token nativo do GitHub e o cluster baixa com uma credencial somente-leitura guardada como segredo.
- Q: Quantas réplicas de API e frontend? → A: 1 réplica de cada (custo menor); aceita-se indisponibilidade breve em reinício de pod/manutenção de nó, mas o deploy em si continua sem queda (a réplica nova sobe e fica saudável antes de a antiga sair).
- Q: Quanto tempo manter o ambiente antigo (SSH) religável após a troca do DNS? → A: Corte imediato — a pipeline por SSH e o `docker-compose-prod.yml` são removidos na mesma entrega; o retorno, se necessário, é feito a partir do branch `backup/sem-k8s` com deploy manual.
- Q: Como validar antes da troca e como o HTTPS é emitido? → A: `finami.site` já está na Cloudflare (nameservers e proxy ativo, confirmado em 2026-11-25): o certificado público é da Cloudflare na borda; não há emissão automática de certificado no cluster. A troca é feita mudando a origem do registro DNS na Cloudflare (efeito quase imediato, reversível na hora); antes disso, valida-se no próprio cluster. (Substituído pela Q6: a resposta original previa um Cloudflare Origin Certificate na origem, com modo SSL "Full (strict)", e a validação pelo IP do Load Balancer; com o túnel não há certificado de origem e a validação é feita por port-forward até o ingress.)
- Q: Dá para usar o cluster sem o Load Balancer pago? → A: Sim — Cloudflare Tunnel compartilhado pelo cluster (túnel `emagine-k8s`, pods cloudflared com conexão de saída) no lugar do Load Balancer da DigitalOcean; sem Origin Certificate; o ingress-nginx fica interno (ClusterIP).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Usuários continuam usando o Finami sem perceber a troca (Priority: P1)

Quem usa o Finami (web/PWA, login com e-mail ou Google, famílias, transações, clientes MCP/OAuth)
continua acessando o mesmo endereço `https://finami.site` e encontra os mesmos dados, agora
servidos pelo cluster.

**Why this priority**: é o objetivo da migração; qualquer regressão para o usuário final
invalida a mudança.

**Independent Test**: após o deploy no cluster e a troca do DNS, abrir `https://finami.site`,
fazer login, consultar e criar uma transação, e conectar um cliente MCP via OAuth — tudo com os
dados que já existiam antes.

**Acceptance Scenarios**:

1. **Given** a aplicação publicada no cluster e o domínio apontando para ele, **When** o usuário abre `https://finami.site`, **Then** a SPA carrega com certificado HTTPS válido e o login funciona.
2. **Given** um usuário com dados existentes, **When** ele entra após a migração, **Then** vê exatamente os mesmos grupos, contas e transações de antes (mesmo banco).
3. **Given** um cliente MCP já autorizado antes da migração, **When** ele chama `/mcp` com seu token, **Then** a chamada funciona sem nova autorização, inclusive respostas em streaming.
4. **Given** o PWA instalado no celular, **When** o app é aberto após a migração, **Then** ele atualiza para a versão servida pelo cluster sem precisar reinstalar.

---

### User Story 2 - Publicar uma versão no cluster pela pipeline (Priority: P1)

O mantenedor dispara a pipeline de deploy de produção escolhendo uma branch ou tag; ela roda os
testes, gera as imagens da API e do frontend, publica no cluster e só dá o deploy como concluído
quando a nova versão está saudável.

**Why this priority**: sem um deploy reprodutível a migração não se sustenta; substitui o deploy
por SSH atual.

**Independent Test**: disparar a pipeline com uma tag; verificar que a versão publicada no
cluster corresponde a essa tag e que o resumo da execução informa a versão e a URL.

**Acceptance Scenarios**:

1. **Given** uma ref válida, **When** o deploy é disparado, **Then** testes rodam primeiro e, se falharem, nada é publicado.
2. **Given** testes aprovados, **When** a nova versão sobe, **Then** a versão anterior continua atendendo até a nova estar saudável (sem tempo fora do ar perceptível).
3. **Given** a nova versão não fica saudável no prazo, **When** o deploy expira, **Then** a pipeline falha, mostra os logs relevantes e o tráfego continua na versão anterior.
4. **Given** uma versão problemática já publicada, **When** o mantenedor pede rollback, **Then** a versão anterior volta a atender em poucos minutos.

---

### User Story 3 - Credenciais protegidas (Priority: P1)

Credenciais de acesso ao cluster, connection string do banco, segredo JWT e demais segredos ficam
apenas no cofre de segredos da pipeline e no armazenamento de segredos do cluster — nunca em
arquivos versionados.

**Why this priority**: o acesso de admin ao cluster e ao banco dá controle total sobre a
produção; vazamento é incidente grave.

**Independent Test**: varrer o repositório (incluindo histórico do branch) atrás do token do
cluster, da connection string e do segredo JWT; nenhum deve aparecer.

**Acceptance Scenarios**:

1. **Given** o repositório após a feature, **When** se procura por tokens/certificados do kubeconfig ou senhas, **Then** nada é encontrado.
2. **Given** um segredo obrigatório ausente no cofre, **When** o deploy é disparado, **Then** ele falha cedo com mensagem dizendo qual segredo falta, sem publicar nada.
3. **Given** os logs da pipeline, **When** são inspecionados, **Then** nenhum segredo aparece em texto claro.

---

### User Story 4 - Remover o ambiente antigo na mesma entrega (Priority: P3)

A entrega já remove do repositório o deploy por SSH (pipeline e `docker-compose-prod.yml`). Depois
da troca do DNS, o mantenedor desliga o container antigo e o encaminhamento do Finami no proxy do
outro projeto, sem afetar os demais projetos daquele servidor.

**Why this priority**: evita dois ambientes divergentes; só depende de P1 estar validado.

**Independent Test**: após a troca do DNS, confirmar que o repositório não tem mais o deploy por
SSH, desligar o container antigo e verificar que o Finami segue no ar e os outros projetos do
servidor não foram afetados.

**Acceptance Scenarios**:

1. **Given** a entrega mesclada, **When** se olha o repositório, **Then** só existe a pipeline de deploy para o cluster.
2. **Given** o DNS apontando para o cluster, **When** o container antigo é desligado, **Then** o Finami continua no ar.
3. **Given** um problema grave após a troca, **When** o mantenedor decide voltar, **Then** há um procedimento documentado para republicar a partir do branch `backup/sem-k8s` no servidor antigo e devolver o DNS.

---

### Edge Cases

- O banco recusa conexões vindas do cluster (lista de origens confiáveis/firewall do PostgreSQL não inclui os nós do cluster): a API não deve ficar marcada como saudável e o deploy deve falhar com mensagem clara.
- Duas réplicas da API sobem ao mesmo tempo e tentam aplicar migrations do banco simultaneamente: as migrations devem ser aplicadas uma única vez, sem corromper o schema.
- Troca da origem na Cloudflare: por alguns segundos, requisições podem chegar ao servidor antigo ou ao cluster; ambos usam o mesmo banco, então os dados ficam consistentes.
- Túnel fora do ar (nenhum conector `cloudflared` conectado): a Cloudflare devolve o erro 1033 para todos os projetos do túnel. Por isso o conector roda com 2 réplicas, de preferência em nós diferentes, e volta sozinho se um pod ou nó cair; a troca só ocorre com o túnel saudável.
- A Cloudflare encerra requisições proxied sem resposta em ~100 s (erro 524), também pelo túnel: o streaming de `/mcp` precisa enviar dados ou manter-se ativo dentro desse limite, como já ocorre hoje.
- IP do cliente forjado: o roteador de entrada não tem endereço público (só o túnel chega a ele, de dentro do cluster) e a Cloudflare sobrescreve na borda o cabeçalho com o IP do cliente, então um cliente não consegue forjar o IP que a API vê.
- Conexões longas de streaming do MCP (`/mcp`, text/event-stream) não podem ser cortadas por buffer ou timeout curto do roteador de entrada.
- Endereço do cliente e esquema original (HTTPS) precisam chegar à API (rate limit, URLs do OAuth/MCP, cookies seguros).
- Um nó do cluster é reciclado (manutenção da DigitalOcean) ou a réplica cai: com 1 réplica há indisponibilidade breve, e a aplicação DEVE voltar sozinha, sem intervenção manual.
- Deploys disparados em sequência: o segundo espera o primeiro terminar (sem dois deploys simultâneos).

## Requirements *(mandatory)*

### Functional Requirements

**Publicação e disponibilidade**

- **FR-001**: A API e o frontend do Finami DEVEM ser executados no cluster `do-nyc2-emagine-k8s`, isolados dos demais projetos do cluster (espaço próprio do Finami).
- **FR-002**: O domínio `https://finami.site` DEVE continuar atrás do proxy da Cloudflare (certificado público na borda) e ter como origem o cluster, por meio da infra de entrada **compartilhada**: um Cloudflare Tunnel do cluster (conexão de saída, sem Load Balancer, IP público ou porta aberta) que entrega o tráfego a um roteador de entrada (ingress controller) interno, comum a todos os projetos. A conexão Cloudflare → cluster é criptografada pelo próprio túnel; não há certificado de origem. O Finami declara apenas as próprias rotas no ingress e os próprios hostnames no túnel.
- **FR-002a**: Se a infra de entrada compartilhada (túnel e ingress controller) ainda não existir no cluster, ela DEVE ser instalada de forma reprodutível e documentada pelo admin do cluster, separada dos recursos e da pipeline do Finami, para que outros projetos possam reutilizá-la sem depender do Finami. A credencial do túnel é do cluster e NÃO DEVE ficar nos segredos da pipeline do Finami nem em arquivos versionados.
- **FR-003**: O roteamento público DEVE preservar o comportamento atual: `/api/*`, `/mcp*`, `/oauth/*` e `/.well-known/oauth-*` vão para a API; o restante vai para a SPA (com fallback para `index.html` nas rotas do app).
- **FR-004**: O roteamento DEVE repassar à API o esquema e o IP originais do cliente (o IP real vindo do cabeçalho da Cloudflare, confiado só quando a conexão vem de dentro do cluster, isto é, do túnel) e NÃO DEVE bufferizar nem encerrar prematuramente as respostas em streaming de `/mcp`.
- **FR-005**: A API e o frontend DEVEM rodar com **1 réplica cada**. Se a réplica cair (falha, reinício ou manutenção de nó), o cluster DEVE recriá-la automaticamente; indisponibilidade breve nesses casos é aceita. A quantidade de réplicas DEVE ser um parâmetro simples de alterar no futuro.
- **FR-006**: Cada componente DEVE expor verificação de saúde; uma réplica só recebe tráfego quando saudável e é reiniciada automaticamente se deixar de estar.
- **FR-007**: Os recursos de CPU/memória de cada componente DEVEM ter limites definidos para não afetar os demais projetos do cluster.

**Banco de dados**

- **FR-008**: A API DEVE continuar usando o mesmo PostgreSQL externo atual; nenhum dado é migrado ou copiado e nenhum banco é criado no cluster.
- **FR-009**: As migrations do banco DEVEM ser aplicadas exatamente uma vez por deploy, mesmo com várias réplicas da API.

**Deploy**

- **FR-010**: A pipeline de deploy de produção DEVE ser disparada manualmente com uma branch ou tag, rodar os testes do backend antes e não publicar nada se eles falharem.
- **FR-011**: A pipeline DEVE gerar imagens versionadas (identificáveis pela ref/commit publicado) da API e do frontend e publicá-las de forma privada no GitHub Container Registry da organização `emaginebr`; o cluster DEVE baixá-las com uma credencial somente-leitura, armazenada como segredo.
- **FR-012**: A atualização DEVE ser gradual (rolling), sem tempo fora do ar perceptível — com 1 réplica, a nova DEVE subir e ficar saudável antes de a antiga ser removida — e a pipeline só DEVE terminar com sucesso quando todas as réplicas novas estiverem saudáveis.
- **FR-013**: Se a nova versão não ficar saudável no prazo, a pipeline DEVE falhar exibindo status e logs, mantendo o tráfego na versão anterior.
- **FR-014**: DEVE existir uma forma documentada de voltar à versão anterior (rollback) em poucos minutos.
- **FR-015**: Deploys de produção NÃO DEVEM rodar em paralelo.

**Segurança e segredos**

- **FR-016**: O kubeconfig/token de acesso ao cluster DEVE existir somente como segredo da pipeline; NÃO DEVE ser gravado em nenhum arquivo do repositório, nem em logs.
- **FR-017**: Connection string do banco, segredo JWT e o Client ID do Google DEVEM chegar à API a partir de segredos/variáveis da pipeline, armazenados no cluster como segredos — nunca em manifestos versionados.
- **FR-018**: A pipeline DEVE validar a presença dos segredos obrigatórios antes de publicar e falhar com mensagem indicando qual falta.

**Transição e documentação**

- **FR-019**: A troca da origem de `finami.site` e `www.finami.site` na Cloudflare (dos registros que apontam para o servidor antigo para os hostnames do túnel do cluster) DEVE ocorrer só após a aplicação estar validada no cluster (acesso direto ao ingress interno, com o túnel saudável); o procedimento de troca e de reversão (voltar os registros para o IP do servidor antigo) DEVE estar documentado.
- **FR-020**: A entrega DEVE remover o deploy antigo por SSH (pipeline `deploy-prod.yml` por SSH, `docker-compose-prod.yml` e `.env.prod.example`), substituindo-o pelo deploy no cluster. O retorno ao ambiente antigo, se necessário, DEVE ser feito a partir do branch `backup/sem-k8s`, com o procedimento documentado.
- **FR-021**: A documentação do projeto DEVE descrever a arquitetura no cluster, os segredos necessários, como fazer deploy, rollback e consultar logs.
- **FR-022**: O ambiente de desenvolvimento local (`docker-compose.yml`) DEVE continuar funcionando como hoje.

### Key Entities

- **Ambiente de produção no cluster**: espaço isolado do Finami no cluster, contendo API, frontend, roteamento público e segredos.
- **Imagem de versão**: artefato imutável de API ou frontend, identificado pela ref/commit que o gerou.
- **Segredos de produção**: acesso ao cluster, connection string do banco, segredo JWT, Client ID do Google, credencial somente-leitura do GHCR usada pelo cluster.
- **Token do túnel**: credencial do cluster (não do Finami), usada pelos conectores do túnel compartilhado; fica só no armazenamento de segredos do cluster, fora do GitHub e da pipeline do Finami.
- **Banco PostgreSQL externo**: inalterado; precisa aceitar conexões vindas do cluster.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos fluxos principais (login e-mail/Google, famílias, transações, transferências, estorno, convites, MCP/OAuth, PWA) funcionam em `https://finami.site` após a migração, verificados por um roteiro de validação.
- **SC-002**: Nenhum dado é perdido ou duplicado: contagens de usuários, grupos e transações antes e depois da troca são idênticas (salvo uso real no período).
- **SC-003**: Um deploy completo (testes + publicação) termina em até 15 minutos.
- **SC-004**: Durante um deploy, 99% das requisições feitas continuamente ao site são atendidas com sucesso (sem janela fora do ar perceptível).
- **SC-005**: Rollback para a versão anterior leva no máximo 5 minutos.
- **SC-006**: Com a réplica de um componente derrubada manualmente, o site volta a responder sozinho em até 2 minutos.
- **SC-007**: Zero ocorrências de credenciais (token do cluster, connection string, segredo JWT) no repositório e nos logs da pipeline.
- **SC-008**: Tempo de resposta percebido pelos usuários não piora em relação ao ambiente atual.

## Assumptions

- O cluster `do-nyc2-emagine-k8s` já existe e está operacional; o mantenedor tem acesso de admin e cadastrará o kubeconfig como segredo da pipeline (ex.: `KUBECONFIG` no environment `production` do GitHub).
- O cluster pode ser compartilhado com outros projetos da emagine; o Finami usa um namespace próprio e não depende de componentes de outros projetos, exceto a infra de entrada compartilhada do cluster (Cloudflare Tunnel `emagine-k8s` e ingress controller interno, sem Load Balancer da DigitalOcean), que será instalada se ainda não existir.
- O domínio continua `finami.site`, gerenciado na Cloudflare com proxy ativo; o mantenedor tem acesso ao painel (DNS e Zero Trust) para criar o túnel, configurar os hostnames e trocar a origem. O modo SSL da zona não se aplica ao trecho do túnel.
- O PostgreSQL externo permite liberar o acesso a partir do cluster (lista de origens confiáveis/firewall); a connection string não muda.
- O frontend passa a ser servido pelo próprio Finami no cluster, usando o Dockerfile/nginx já existentes em `frontend/`; o proxy do outro projeto deixa de encaminhar o Finami após a transição.
- Não há ambiente de homologação separado; a validação antes da troca é feita no próprio cluster, acessando o ingress interno diretamente (port-forward).
- Observabilidade avançada (métricas, alertas, autoescala) está fora do escopo; basta consultar logs e status pelo cluster.
- O token de admin do cluster foi compartilhado em texto no chat; recomenda-se rotacioná-lo e cadastrar o novo apenas como segredo.
