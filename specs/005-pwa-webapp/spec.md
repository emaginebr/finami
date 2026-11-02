# Feature Specification: Finami como webapp instalável (PWA)

**Feature Branch**: `005-pwa-webapp`
**Created**: 2026-11-01
**Status**: Draft
**Input**: User description: "transforme o frontend em um webapp PWA"

## Contexto

O app web do Finami já tem visual de app de celular (barra de abas, tema escuro, ícone), mas ainda
funciona só como site: depende da internet para abrir, não oferece instalação de forma clara, não
se atualiza de forma controlada e mostra tela em branco ou erro quando a conexão cai. Esta feature
transforma o Finami num **app web progressivo (PWA)**: instalável na tela inicial do celular e no
computador, abre rápido e em tela cheia, continua mostrando os últimos dados vistos quando estiver
sem internet e avisa quando há uma versão nova.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instalar o Finami na tela inicial (Priority: P1)

A pessoa abre o Finami no navegador do celular ou do computador e encontra a opção de instalar:
pelo próprio navegador ou por um convite discreto dentro do app ("Instalar o Finami"). Depois de
instalado, o Finami aparece na tela inicial / menu de apps com o ícone e o nome do Finami e abre
em janela própria, sem barra de endereço, com a cor do tema na barra de status.

**Why this priority**: é o que define "ser um app"; sem instalação não há PWA.

**Independent Test**: em um Android com Chrome e num computador com Chrome/Edge, instalar pelo
convite do app; o ícone aparece e o app abre em tela cheia direto na Home (ou no login, sem sessão).

**Acceptance Scenarios**:

1. **Given** um navegador que permite instalação e o Finami ainda não instalado, **When** a
   pessoa usa o app por alguns segundos, **Then** vê, na tela Conta, a opção "Instalar o Finami";
   ao tocar, o navegador mostra a confirmação de instalação.
2. **Given** a pessoa instalou o app, **When** abre pelo ícone, **Then** o Finami abre em janela
   própria, sem barra de endereço, com a tela de abertura nas cores da marca, e cai na Home (com
   sessão) ou no login (sem sessão).
3. **Given** um iPhone/iPad (que não oferece instalação automática), **When** a pessoa abre o
   Finami no Safari, **Then** a opção da tela Conta mostra o passo a passo "Compartilhar →
   Adicionar à Tela de Início".
4. **Given** o Finami já instalado ou aberto como app, **When** a pessoa abre a tela Conta,
   **Then** a opção de instalar não aparece.
5. **Given** a pessoa dispensou o convite de instalação, **When** volta ao app nos 30 dias
   seguintes, **Then** o convite não reaparece por conta própria (a opção na Conta continua lá).
6. **Given** o app instalado, **When** a pessoa toca e segura o ícone (onde o sistema permitir),
   **Then** vê atalhos para "Novo lançamento" e "Carteiras".

---

### User Story 2 - Usar sem internet com os últimos dados vistos (Priority: P1)

A pessoa abre o Finami sem conexão (no metrô, em modo avião). O app abre normalmente e mostra os
últimos saldos, carteiras, extratos e famílias que ela viu, com um aviso claro de que está sem
internet e de quando os dados foram atualizados. Ações que dependem do servidor (lançar, transferir,
convidar, aceitar convite) ficam indisponíveis com explicação. Quando a conexão volta, o app
atualiza os dados sozinho e o aviso some.

**Why this priority**: abrir sem internet e não mostrar tela de erro é o principal ganho prático
de um PWA para um app de consulta de saldos.

**Independent Test**: abrir o app com internet, navegar por Home, Carteiras e um extrato; ligar o
modo avião; fechar e reabrir o app — as mesmas telas aparecem com o aviso "Sem internet".

**Acceptance Scenarios**:

1. **Given** a pessoa já usou o app conectada, **When** abre o app sem internet, **Then** o app
   carrega em até 3 segundos e mostra a Home com os últimos dados vistos e o aviso "Sem internet ·
   dados de {data e hora}".
2. **Given** o app sem internet, **When** a pessoa navega para uma tela que já tinha visto,
   **Then** vê os dados guardados; **When** navega para uma tela nunca vista (ex.: extrato de outro
   mês), **Then** vê "Este conteúdo não está disponível sem internet." com o botão "Tentar de novo".
3. **Given** o app sem internet, **When** a pessoa toca no botão "+" ou em qualquer ação que altere
   dados, **Then** a ação não é enviada e aparece "Sem internet. Conecte-se para fazer
   lançamentos." — nada fica pendente para envio posterior.
4. **Given** o app sem internet, **When** a conexão volta, **Then** em até 5 segundos o aviso some
   e os dados da tela atual são atualizados sem a pessoa precisar recarregar.
5. **Given** a pessoa sai da conta (logout) ou a sessão expira, **When** isso acontece, **Then**
   todos os dados guardados no aparelho são apagados imediatamente.
6. **Given** a pessoa nunca usou o app neste aparelho, **When** o abre sem internet, **Then** vê
   uma tela de "Sem internet" com o logo, a explicação e "Tentar de novo" — nunca a página de erro
   do navegador.

---

### User Story 3 - Receber a versão nova sem perder o que estava fazendo (Priority: P2)

Quando uma versão nova do Finami é publicada, o app instalado detecta e mostra um aviso discreto
"Nova versão disponível · Atualizar". A pessoa escolhe quando atualizar; se ignorar, a versão nova
entra na próxima vez que o app for aberto do zero.

**Why this priority**: sem isso, apps instalados ficam presos em versões antigas ou recarregam no
meio de um lançamento.

**Independent Test**: com o app aberto, publicar uma versão nova no homolog; em até 1 hora (ou ao
voltar ao app) aparece o aviso; tocar em "Atualizar" recarrega já na versão nova.

**Acceptance Scenarios**:

1. **Given** o app aberto e uma versão nova publicada, **When** o app verifica atualizações (ao
   voltar ao primeiro plano e a cada 60 minutos), **Then** mostra o aviso "Nova versão disponível"
   com o botão "Atualizar".
2. **Given** o aviso visível e uma folha de lançamento aberta com dados digitados, **When** a
   pessoa não toca em "Atualizar", **Then** nada é recarregado e o que foi digitado não se perde.
3. **Given** a pessoa toca em "Atualizar", **When** o app recarrega, **Then** abre na mesma tela
   em que estava, já na versão nova, e a sessão continua.
4. **Given** a pessoa ignorou o aviso, **When** fecha todas as janelas do app e abre de novo,
   **Then** a versão nova é usada.

---

### User Story 4 - Abertura rápida e aparência de app nativo (Priority: P2)

O app instalado abre rápido mesmo em conexões lentas, porque a "casca" (telas, estilos, ícones,
fontes) fica guardada no aparelho; só os dados vêm da internet. A aparência respeita o aparelho:
cor da barra de status, área segura do entalhe, ícone adaptável no Android, tela de abertura com a
marca.

**Why this priority**: melhora a percepção de qualidade; o app já funciona sem isso.

**Independent Test**: com o app instalado e rede 3G simulada, medir o tempo até a Home aparecer
com conteúdo na segunda abertura.

**Acceptance Scenarios**:

1. **Given** o app já aberto antes neste aparelho, **When** a pessoa o abre numa conexão 3G lenta,
   **Then** a estrutura da tela aparece em até 1,5 segundo e os dados guardados em seguida.
2. **Given** um Android com ícones adaptáveis, **When** o app está instalado, **Then** o ícone não
   fica cortado nem com borda branca.
3. **Given** um iPhone com entalhe, **When** o app está instalado, **Then** nenhum conteúdo fica
   sob a barra de status ou o indicador inicial.

---

### Edge Cases

- A conexão oscila (cai e volta várias vezes em segundos) → o aviso não pisca: só aparece após
  2 segundos sem conexão e só some após a primeira resposta bem-sucedida.
- Internet "presa" (rede conectada, mas o servidor não responde) → após 10 segundos sem resposta, o
  app trata como sem internet e mostra os dados guardados.
- Lançamento enviado e a conexão cai antes da resposta → o app mostra "Não foi possível confirmar
  o lançamento. Verifique o extrato quando a conexão voltar." e não reenvia sozinho.
- Duas pessoas usam o mesmo aparelho → dados guardados pertencem só à sessão atual e são apagados
  ao sair; outra pessoa que entra nunca vê dados da anterior.
- Espaço do aparelho cheio ou armazenamento negado (navegação privada) → o app funciona
  normalmente online, só sem modo offline, sem mensagens de erro.
- Cotação do bitcoin guardada há muito tempo → valores em reais de carteiras BTC mostram a data
  da cotação usada.
- Tela de autorização de assistentes (`/autorizar`) e retorno de login com Google → sempre exigem
  internet; nunca são servidos de dados guardados.
- A versão nova muda o formato dos dados guardados → os dados antigos são descartados sem erro.
- Navegador sem suporte a PWA → o site continua funcionando como hoje.

## Requirements *(mandatory)*

### Functional Requirements

**Instalação e aparência**

- **FR-001**: O Finami MUST ser instalável nos navegadores que suportam instalação de apps web
  (Chrome/Edge em Android, Windows, macOS, Linux, ChromeOS) e MUST cumprir os critérios de
  instalabilidade desses navegadores.
- **FR-002**: O app instalado MUST abrir em janela própria (sem interface do navegador), com nome
  "Finami", ícone da marca em todos os tamanhos exigidos (incluindo ícone adaptável/"maskable" e
  ícone comum separados), cores de tema e fundo da marca e tela de abertura com a marca.
- **FR-003**: A tela Conta MUST ter a opção "Instalar o Finami" quando o app não estiver instalado:
  nos navegadores com instalação nativa ela dispara a instalação; no iOS/iPadOS ela mostra o passo a
  passo de "Adicionar à Tela de Início". A opção MUST ficar oculta quando o app já roda instalado.
- **FR-004**: O app MAY mostrar um convite de instalação uma única vez, de forma discreta e
  dispensável, depois que a pessoa entrou e viu a Home; dispensado, MUST NOT reaparecer sozinho por
  30 dias.
- **FR-005**: O app instalado MUST oferecer atalhos de ícone (onde o sistema suportar) para
  "Novo lançamento" (abre a Home com a folha de lançamento) e "Carteiras".
- **FR-006**: O app MUST respeitar áreas seguras (entalhe, barra de status, indicador inicial) e a
  cor da barra de status no modo instalado.

**Funcionamento sem internet**

- **FR-007**: A estrutura do app (telas, estilos, ícones, fontes, traduções) MUST ficar guardada no
  aparelho após a primeira visita, de forma que o app abra sem internet.
- **FR-008**: As respostas de consulta já vistas (perfil, saldo total, carteiras, extratos já
  abertos, famílias, saldos de membros, notificações, cotação) MUST ficar guardadas no aparelho e
  ser exibidas sem internet, sempre com a data/hora em que foram obtidas.
- **FR-009**: Com internet, o app MUST mostrar dados atualizados do servidor (os dados guardados
  podem aparecer primeiro e ser substituídos assim que a resposta chegar).
- **FR-010**: O app MUST mostrar um indicador persistente e acessível de "Sem internet" enquanto
  estiver offline, anunciado a leitores de tela, com a data/hora dos dados exibidos.
- **FR-011**: Sem internet, todas as ações que alteram dados MUST ficar indisponíveis, com mensagem
  explicativa; o app MUST NOT guardar ações para envio posterior (nenhuma fila de lançamentos).
- **FR-012**: Ao voltar a conexão, o app MUST atualizar automaticamente os dados da tela atual e
  esconder o indicador.
- **FR-013**: Telas nunca vistas sem internet MUST mostrar uma mensagem própria de conteúdo
  indisponível com "Tentar de novo"; abrir o app pela primeira vez sem internet MUST mostrar uma
  tela própria de "Sem internet", nunca o erro do navegador.
- **FR-014**: Login, cadastro, login com Google, troca de senha e autorização de assistentes
  (`/autorizar`) MUST sempre ir ao servidor e MUST NOT usar dados guardados.

**Privacidade e segurança**

- **FR-015**: Dados guardados MUST pertencer à sessão atual e MUST ser apagados ao sair da conta,
  quando a sessão expirar ou for rejeitada pelo servidor, e ao trocar de conta.
- **FR-016**: O token de acesso MUST continuar armazenado apenas como hoje (sessão do app) e MUST NOT
  ser copiado para outros armazenamentos nem para o componente que trabalha em segundo plano.
- **FR-017**: Respostas que não sejam consultas (lançamentos, alterações, autenticação, OAuth, MCP)
  MUST NOT ser guardadas.

**Atualização**

- **FR-018**: O app MUST verificar se há versão nova ao voltar ao primeiro plano e a cada 60
  minutos com o app aberto, e MUST mostrar o aviso "Nova versão disponível · Atualizar" sem
  recarregar sozinho.
- **FR-019**: "Atualizar" MUST aplicar a versão nova e recarregar na mesma tela, mantendo a sessão;
  sem a ação da pessoa, a versão nova MUST valer na próxima abertura do app do zero.
- **FR-020**: Dados guardados com formato de uma versão anterior incompatível MUST ser descartados
  automaticamente.

**Qualidade**

- **FR-021**: Todos os elementos novos (indicador offline, aviso de atualização, convite e
  instruções de instalação, tela sem internet) MUST seguir a identidade visual e as regras de
  acessibilidade do app (contraste, foco, leitores de tela, alvos de toque, movimento reduzido).
- **FR-022**: A experiência em navegadores sem suporte a PWA MUST continuar idêntica à atual.
- **FR-023**: Os três ambientes (dev, homolog, prod) MUST servir o app instalável; em dev o modo
  offline MAY ficar desligado por padrão para não atrapalhar o desenvolvimento.

### Key Entities

- **Dados guardados de consulta**: cópia local de uma resposta de consulta, com a data/hora em que
  foi obtida, a sessão a que pertence e a versão do formato.
- **Estado de conexão**: online, offline ou instável, exibido pelo indicador.
- **Versão do app**: versão em uso e versão nova disponível aguardando a pessoa atualizar.
- **Preferência de instalação**: se o convite foi dispensado e quando (para o intervalo de 30 dias).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O Finami passa em 100% dos critérios de instalabilidade de PWA dos navegadores
  Chrome e Edge, e na auditoria de PWA/boas práticas sem itens críticos.
- **SC-002**: Uma pessoa instala o Finami em até 3 toques a partir da tela Conta (Android/desktop)
  ou seguindo as instruções em até 1 minuto (iOS).
- **SC-003**: Na segunda abertura, sem internet, a Home com os últimos dados aparece em até
  3 segundos em 100% das tentativas, sem tela de erro do navegador.
- **SC-004**: Na segunda abertura com rede lenta (3G), a estrutura da tela aparece em até
  1,5 segundo.
- **SC-005**: 0 ações de alteração são enviadas ou enfileiradas enquanto o app está offline.
- **SC-006**: Após sair da conta, 0 dados de consulta da pessoa permanecem no aparelho (verificável
  nas ferramentas do navegador).
- **SC-007**: Uma versão nova publicada é oferecida em até 60 minutos (ou na próxima volta ao app)
  e, ao tocar em "Atualizar", a pessoa continua na mesma tela e com a sessão ativa.
- **SC-008**: Todas as telas novas passam na verificação automática de acessibilidade sem violações.

## Assumptions

- O app continua sendo o mesmo site; "PWA" = instalável + funcionamento offline de consulta +
  atualização controlada. Não há publicação em lojas de aplicativos (Play Store/App Store).
- **Notificações push** (ex.: avisar convite recebido com o app fechado) ficam **fora** desta
  feature — exigem infraestrutura nova no servidor e permissão do sistema; podem virar uma feature
  futura. As notificações dentro do app (feature 003) continuam como estão.
- Sem fila offline: em um app financeiro, lançar sem confirmação do servidor arrisca duplicidade
  e saldos errados; a pessoa lança quando houver conexão (FR-011).
- Guardar os últimos dados vistos no aparelho é aceitável porque a pessoa já os viu nesse aparelho,
  ficam presos à sessão e são apagados ao sair (FR-015); quem compartilha aparelho deve sair da
  conta, como já acontece hoje.
- Ícones atuais da marca são reaproveitados; o `ux-designer` gera os tamanhos que faltarem (ícone
  comum e adaptável separados, telas de abertura do iOS, screenshots para a janela de instalação).
- Prazos padrão: convite dispensado por 30 dias; verificação de versão a cada 60 minutos; conexão
  considerada perdida após 10 segundos sem resposta.
- Produção já é servida por HTTPS (requisito para PWA); homolog e dev em `localhost` são aceitos
  pelos navegadores.
- Depende das features 002 (frontend), 003 (notificações) e 004 (tela `/autorizar`).
