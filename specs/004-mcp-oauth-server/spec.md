# Feature Specification: Servidor MCP do Finami com conexão via OAuth

**Feature Branch**: `004-mcp-oauth-server`
**Created**: 2026-11-01
**Status**: Draft
**Input**: User description: "crie um mcp completo, deve ser conectar usando oauth"

## Contexto

Hoje o Finami só é usado pelo app web. Esta feature cria um **servidor MCP** (Model Context
Protocol, o padrão aberto que assistentes de IA como o Claude usam para acessar serviços externos).
Com ele, a pessoa conecta o assistente à própria conta do Finami e passa a pedir em linguagem
natural, por exemplo: "quanto tenho no total?", "lança um gasto de R$ 80 no mercado na carteira
Nubank", "mostra o extrato da família Silva em outubro".

"Completo" significa que o assistente faz pelo MCP tudo o que a pessoa faz no app no dia a dia:
consulta e movimenta carteiras, consulta extratos, cuida da família, dos convites e das
notificações. A conexão usa **OAuth**: a pessoa entra no Finami numa tela do próprio Finami,
vê o que o assistente vai poder fazer e autoriza. O assistente nunca recebe a senha.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conectar um assistente de IA à conta pelo OAuth (Priority: P1)

A pessoa adiciona o endereço do MCP do Finami no assistente (por exemplo, como "conector" no
Claude). O assistente abre a tela de autorização do Finami no navegador. A pessoa entra com o
login que já usa no app (email e senha ou Google), vê o nome do assistente e a lista do que ele
vai poder fazer, e toca em "Autorizar". O assistente fica conectado e passa a agir em nome dela,
com as mesmas permissões que ela tem no app.

**Why this priority**: sem a conexão segura nada mais funciona; é o pedido explícito ("deve se
conectar usando OAuth").

**Independent Test**: adicionar o MCP num cliente compatível, concluir a autorização e chamar a
ferramenta de perfil; o assistente mostra o nome da pessoa logada.

**Acceptance Scenarios**:

1. **Given** um assistente compatível sem cadastro prévio no Finami, **When** a pessoa adiciona o
   endereço do MCP, **Then** o assistente se registra sozinho e abre a tela de autorização do
   Finami, sem que ninguém precise criar chaves ou credenciais manualmente.
2. **Given** a tela de autorização aberta e a pessoa sem sessão, **When** ela entra com email e
   senha ou com Google, **Then** vê o nome do assistente, as permissões pedidas e os botões
   "Autorizar" e "Negar".
3. **Given** a tela de autorização, **When** a pessoa toca em "Autorizar", **Then** volta ao
   assistente já conectado e a primeira consulta funciona.
4. **Given** a tela de autorização, **When** a pessoa toca em "Negar", **Then** o assistente
   recebe a recusa, não ganha acesso e mostra que a conexão não foi feita.
5. **Given** um pedido ao MCP sem autorização ou com autorização vencida ou revogada, **When** o
   assistente chama qualquer ferramenta, **Then** recebe a indicação de que precisa autorizar de
   novo e nenhum dado é devolvido.
6. **Given** o assistente conectado há dias, **When** o acesso de curta duração vence, **Then** o
   assistente renova o acesso sozinho, sem pedir login de novo, enquanto a conexão não for
   revogada e estiver dentro do prazo máximo.

---

### User Story 2 - Consultar saldos, carteiras e extratos pelo assistente (Priority: P1)

Conectada, a pessoa pergunta ao assistente sobre o próprio dinheiro: saldo total, saldo de cada
carteira, carteiras de uma família, saldo de cada membro da família, extrato de uma carteira, de
uma pessoa ou de uma família num período, detalhes de um lançamento e a cotação do bitcoin.
O assistente responde com os mesmos números do app.

**Why this priority**: consultar é o uso mais frequente e de menor risco; já entrega valor sozinho.

**Independent Test**: com uma conta com carteiras e lançamentos, pedir "qual meu saldo total" e
"extrato da carteira X em outubro" e comparar com o app.

**Acceptance Scenarios**:

1. **Given** a pessoa com carteiras em reais e em bitcoin, **When** pede o saldo total, **Then** o
   assistente recebe o total em reais (bitcoin convertido pela cotação atual), o total por moeda e
   a cotação usada, iguais aos da Home do app.
2. **Given** uma carteira da pessoa, **When** pede o extrato de um período, **Then** recebe os
   lançamentos do período, mais recentes primeiro, com saldo inicial e final, iguais aos do app.
3. **Given** um extrato com muitos lançamentos, **When** o assistente pede a próxima página,
   **Then** recebe a continuação sem repetir nem pular lançamentos.
4. **Given** uma família de que a pessoa participa, **When** pede o saldo por membro, **Then**
   recebe o saldo de cada membro, respeitando as mesmas regras de visibilidade do app.
5. **Given** uma carteira, família ou pessoa a que ela **não** tem acesso no app, **When** o
   assistente tenta consultar, **Then** recebe "não encontrado" ou "sem permissão", sem nenhum dado.
6. **Given** a pessoa se refere à carteira pelo nome ("Nubank"), **When** o assistente lista as
   carteiras, **Then** recebe nome, moeda, família e identificador de cada uma para escolher a certa.

---

### User Story 3 - Lançar receitas, despesas e transferências pelo assistente (Priority: P1)

A pessoa pede ao assistente para registrar uma receita, uma despesa ou uma transferência entre
carteiras (inclusive compra e venda de bitcoin), ou para estornar um lançamento. Antes de uma
transferência com conversão, o assistente pode pedir a prévia com a cotação e o valor que vai
chegar. O lançamento aparece no app na hora, igual a um feito pelo botão "+".

**Why this priority**: registrar gastos e receitas conversando é o maior ganho de praticidade do
MCP; junto com as consultas forma o núcleo da feature.

**Independent Test**: pedir "lança despesa de R$ 80,00 em Mercado na carteira Nubank hoje" e ver
o lançamento e o saldo novo no app.

**Acceptance Scenarios**:

1. **Given** uma carteira em reais da pessoa, **When** o assistente registra uma despesa de
   R$ 80,00 com descrição, **Then** o lançamento é criado, o saldo cai R$ 80,00 e a resposta traz
   o identificador do lançamento e o saldo novo.
2. **Given** duas carteiras (reais e bitcoin), **When** o assistente pede a prévia de uma
   transferência, **Then** recebe a cotação, o valor de saída e o valor de chegada, sem nada ser
   lançado.
3. **Given** a mesma operação repetida por falha de rede com a mesma chave de repetição, **When**
   o assistente reenvia, **Then** o lançamento não é duplicado.
4. **Given** saldo insuficiente, valor inválido, carteira inativa ou de outra pessoa, **When** o
   assistente tenta lançar, **Then** recebe a mesma mensagem de erro do app e nada é lançado.
5. **Given** um lançamento da pessoa, **When** o assistente pede o estorno, **Then** o estorno é
   criado como no app e os saldos voltam ao valor anterior.
6. **Given** uma conexão autorizada só para consulta, **When** o assistente tenta lançar,
   **Then** recebe "permissão insuficiente" e nada é lançado.

---

### User Story 4 - Gerenciar conexões autorizadas no app (Priority: P2)

Na tela **Conta**, a pessoa vê a seção "Assistentes conectados" com cada assistente autorizado,
as permissões dadas, a data da autorização e o último uso. Ela pode desconectar qualquer um; a
partir daí o assistente perde o acesso na hora.

**Why this priority**: controle e segurança do usuário; necessário antes de liberar em produção,
mas o MVP de conexão e uso funciona sem ele.

**Independent Test**: conectar um assistente, abrir Conta → Assistentes conectados, desconectar e
verificar que a próxima chamada do assistente é recusada.

**Acceptance Scenarios**:

1. **Given** dois assistentes autorizados, **When** a pessoa abre "Assistentes conectados",
   **Then** vê os dois com nome, permissões, data da autorização e último uso.
2. **Given** um assistente conectado, **When** a pessoa toca em "Desconectar" e confirma, **Then**
   ele some da lista e a próxima chamada dele é recusada, inclusive a tentativa de renovar acesso.
3. **Given** nenhum assistente autorizado, **When** abre a seção, **Then** vê um texto curto
   explicando como conectar e o endereço do MCP para copiar.
4. **Given** a pessoa troca a senha, **When** a troca é concluída, **Then** todas as conexões de
   assistentes continuam válidas, a menos que ela escolha "desconectar todos" (opção oferecida na
   própria seção).

---

### User Story 5 - Família, convites e notificações pelo assistente (Priority: P2)

A pessoa pede ao assistente para criar ou renomear uma família, incluir alguém (criar pessoa sem
conta ou convidar quem já tem conta, com as mesmas regras da feature 003), cancelar convites,
retirar membros, ver as notificações não lidas, aceitar ou recusar convites recebidos e marcar
notificações como lidas.

**Why this priority**: completa o "MCP completo"; é menos frequente que dinheiro.

**Independent Test**: pedir "quais notificações tenho?" e "aceita o convite da família Silva" e ver
a família aparecer no app.

**Acceptance Scenarios**:

1. **Given** um convite pendente para a pessoa, **When** o assistente lista as notificações,
   **Then** recebe o convite com família, quem convidou e estado atual.
2. **Given** esse convite, **When** o assistente aceita, **Then** a pessoa vira membro e quem
   convidou é notificado, como no app.
3. **Given** a pessoa é responsável de uma família, **When** o assistente consulta um email,
   **Then** recebe o mesmo resultado da verificação do app (disponível, cadastrado, já membro,
   convite pendente) e pode criar a pessoa ou enviar o convite.
4. **Given** a pessoa **não** é responsável da família, **When** o assistente tenta incluir,
   convidar ou retirar membros, **Then** recebe "sem permissão".

---

### User Story 6 - Gerenciar carteiras e perfil pelo assistente (Priority: P3)

A pessoa pede ao assistente para criar uma carteira (em reais ou bitcoin, pessoal ou numa
família), renomear, mudar de família, desativar ou excluir uma carteira sem lançamentos, e para
ver ou atualizar nome e sobrenome do perfil.

**Why this priority**: tarefas de configuração pouco frequentes; completam a cobertura.

**Independent Test**: pedir "cria uma carteira BTC chamada Reserva na família Silva" e ver no app.

**Acceptance Scenarios**:

1. **Given** a pessoa membro da família, **When** o assistente cria uma carteira nela, **Then** a
   carteira aparece no app com o mesmo resultado da criação pelo app.
2. **Given** uma carteira com lançamentos, **When** o assistente tenta excluir, **Then** recebe a
   mesma recusa do app e a opção de desativar.
3. **Given** a pessoa, **When** o assistente atualiza o sobrenome dela, **Then** o app mostra o
   nome novo.

---

### Edge Cases

- Assistente pede permissões que não existem → a autorização é recusada com erro claro.
- Endereço de retorno do assistente diferente do registrado → o Finami não redireciona e mostra
  erro (proteção contra roubo do código de autorização).
- Código de autorização reutilizado ou usado depois de vencer → recusado; se reutilizado, a
  conexão gerada com ele é revogada.
- Pessoa autoriza o mesmo assistente duas vezes → aparece uma conexão só, com as permissões mais
  recentes.
- Conta criada por outra pessoa (sem senha nem Google próprios) → não consegue entrar na tela de
  autorização, como já acontece no app.
- Pessoa deixa de ser membro de uma família → o assistente perde o acesso aos dados dessa família
  na próxima chamada, sem precisar reconectar.
- Muitas chamadas em sequência → acima do limite, o assistente recebe "muitas requisições, tente
  em instantes" sem afetar o uso do app.
- Valores em texto ("80 reais", "0,001 btc") → o MCP aceita só números na unidade documentada; a
  interpretação do texto é do assistente; formato inválido devolve erro de validação.
- Ferramenta chamada com identificador inexistente → "não encontrado", sem revelar se pertence a
  outra pessoa.
- Datas sem fuso → interpretadas no fuso de Brasília, como no app.

## Requirements *(mandatory)*

### Functional Requirements

**Conexão e autorização**

- **FR-001**: O Finami MUST oferecer um servidor MCP num endereço público fixo, acessível por
  assistentes compatíveis com a versão atual do protocolo MCP, por transporte HTTP.
- **FR-002**: Toda chamada ao MCP MUST exigir uma autorização OAuth válida; chamadas sem ela MUST
  ser recusadas com a indicação de onde obter autorização (descoberta automática pelo cliente).
- **FR-003**: O Finami MUST atuar como servidor de autorização OAuth 2.1 próprio, com fluxo de
  código de autorização e PKCE obrigatório; fluxos sem PKCE ou implícitos MUST ser recusados.
- **FR-004**: O Finami MUST publicar os metadados de descoberta do recurso protegido e do servidor
  de autorização, para que o cliente se configure sozinho a partir só do endereço do MCP.
- **FR-005**: O Finami MUST aceitar registro dinâmico de clientes (o assistente se cadastra
  sozinho, com nome e endereços de retorno); clientes registrados MUST ter seus endereços de
  retorno verificados por igualdade exata em cada autorização.
- **FR-006**: A tela de autorização MUST usar o mesmo login do app (email e senha ou Google), MUST
  mostrar o nome do assistente, as permissões pedidas em linguagem simples e os botões "Autorizar"
  e "Negar", e MUST seguir a identidade visual e as regras de acessibilidade do app.
- **FR-007**: Permissões MUST ser separadas em pelo menos: **leitura** (consultas) e **escrita**
  (lançamentos, carteiras, família, convites, notificações, perfil). Na tela de autorização a
  pessoa MUST poder conceder só leitura mesmo que o assistente peça escrita.
- **FR-008**: O acesso emitido MUST ter vida curta (até 1 hora) e MUST poder ser renovado sem novo
  login por até 30 dias de inatividade; cada renovação MUST trocar a credencial de renovação
  (a anterior deixa de valer), e o reuso de uma credencial antiga MUST revogar a conexão.
- **FR-009**: O acesso emitido para o MCP MUST valer só para o MCP (MUST NOT ser aceito nas rotas
  do app), e o login do app MUST NOT valer como autorização do MCP.
- **FR-010**: Códigos de autorização MUST valer no máximo 10 minutos e ser de uso único.

**Ferramentas (cobertura "completa")**

- **FR-011**: O MCP MUST expor ferramentas de **leitura**: perfil da pessoa; saldo total; lista de
  carteiras (com saldo, moeda, família, status); detalhe de uma carteira; lista de famílias;
  detalhe de uma família com membros; saldo por membro de uma família; saldos de uma pessoa por
  família; extrato de carteira, de pessoa e de família por período, paginado; detalhe de um
  lançamento; cotação atual do bitcoin; notificações paginadas e contador de não lidas; convites
  pendentes de uma família (para o responsável); verificação de email para incluir membro.
- **FR-012**: O MCP MUST expor ferramentas de **escrita**: registrar receita; registrar despesa;
  prévia de transferência; registrar transferência (inclusive com conversão real ↔ bitcoin);
  estornar lançamento; criar, renomear, mudar de família, desativar e excluir carteira; criar e
  renomear família; criar pessoa e incluir na família; convidar por email; cancelar convite;
  retirar membro; aceitar e recusar convite; marcar notificações como lidas; atualizar nome do
  perfil.
- **FR-013**: Cada ferramenta MUST aplicar exatamente as mesmas regras de negócio, validações,
  permissões e mensagens de erro da ação equivalente no app (inclusive as regras da feature 003);
  o MCP MUST NOT criar caminho que permita algo que o app não permite.
- **FR-014**: Cada ferramenta MUST ter nome, descrição em português e parâmetros documentados
  (tipos, unidades, obrigatoriedade, exemplos), e MUST indicar se só lê, se altera dados e se a
  ação é destrutiva, para que o assistente peça confirmação quando apropriado.
- **FR-015**: Ferramentas de escrita que criam lançamentos MUST aceitar uma chave de repetição
  opcional; repetir a chamada com a mesma chave MUST devolver o resultado original sem duplicar.
- **FR-016**: Respostas MUST trazer dados estruturados (identificadores, valores com moeda, datas
  com fuso) e um resumo em texto legível em português; valores em reais com 2 casas e em bitcoin
  com 8 casas, sem arredondamentos diferentes do app.
- **FR-017**: Listas MUST ser paginadas (padrão 20, máximo 50 itens) com indicador de próxima página.
- **FR-018**: O MCP MUST expor também recursos de leitura (por exemplo, "minhas carteiras" e
  "minhas famílias") e prompts prontos de uso comum (por exemplo, "resumo do mês", "registrar
  gasto"), para que o assistente ofereça atalhos à pessoa.
- **FR-019**: Ferramentas que exigem permissão de escrita MUST ser recusadas com "permissão
  insuficiente" quando a conexão tiver só leitura; a lista de ferramentas MUST indicar a
  permissão de cada uma.
- **FR-020**: Ficam **fora** do MCP: troca de senha, login/cadastro de conta, exclusão de conta e
  gestão das próprias conexões de assistentes (feitas só pelo app).

**Gestão, segurança e operação**

- **FR-021**: A tela Conta MUST ter a seção "Assistentes conectados" (US4) com lista, permissões,
  data de autorização, último uso, "Desconectar" por item com confirmação e "Desconectar todos".
- **FR-022**: Desconectar MUST invalidar na hora o acesso e a renovação daquela conexão.
- **FR-023**: O MCP MUST limitar a taxa de chamadas por conexão (padrão: 60 por minuto) e devolver
  erro claro acima do limite, sem afetar o app.
- **FR-024**: Cada ferramenta de escrita executada MUST ficar registrada (quem, qual assistente,
  qual ação, quando, resultado) para auditoria; credenciais e segredos MUST NOT aparecer em logs.
- **FR-025**: Segredos de clientes, códigos e credenciais de renovação MUST ser guardados só como
  resumo criptográfico (nunca em texto puro) e MUST NOT ser expostos ao frontend.
- **FR-026**: O MCP MUST funcionar nos três ambientes (dev, homolog e prod), com o endereço
  público e as origens permitidas configuráveis por ambiente; em produção só por HTTPS.

### Key Entities

- **Cliente OAuth**: um assistente registrado (nome, endereços de retorno permitidos, data de
  registro, se foi registro dinâmico).
- **Autorização (conexão)**: o vínculo entre uma pessoa e um cliente, com as permissões
  concedidas, data de criação, último uso e se está ativa ou revogada. É o que aparece em
  "Assistentes conectados".
- **Código de autorização**: emitido após "Autorizar", de uso único e vida curta, ligado ao
  cliente, à pessoa, às permissões, ao endereço de retorno e ao desafio PKCE.
- **Credencial de renovação**: permite obter novo acesso sem login; tem família/rotação para
  detectar reuso; pertence a uma autorização.
- **Registro de ação do MCP**: auditoria das ferramentas de escrita (pessoa, cliente, ferramenta,
  data, resultado).
- **Chave de repetição**: associa uma chamada de escrita ao resultado já produzido, por pessoa,
  por tempo limitado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa conecta um assistente compatível (ex.: Claude) ao Finami em menos de 2
  minutos, só com o endereço do MCP e o próprio login, sem criar chaves manualmente.
- **SC-002**: 100% das ações listadas em FR-011 e FR-012 podem ser feitas pelo assistente e dão o
  mesmo resultado (valores, saldos, mensagens de erro) que a ação equivalente no app.
- **SC-003**: 0 chamadas sem autorização válida, com permissão insuficiente ou a dados de outra
  pessoa devolvem dados; verificado por testes automatizados para todas as ferramentas.
- **SC-004**: Após "Desconectar", 100% das chamadas seguintes daquele assistente são recusadas em
  até 5 segundos.
- **SC-005**: 95% das consultas pelo assistente respondem em até 2 segundos no ambiente de produção.
- **SC-006**: Repetir uma escrita com a mesma chave de repetição nunca gera lançamento duplicado
  (0 duplicados em teste de 100 repetições).
- **SC-007**: Uma pessoa registra uma despesa pelo assistente com uma única frase e vê o
  lançamento no app na próxima vez que abre a tela, sem passos extras.

## Assumptions

- "MCP completo" = ferramentas, recursos e prompts cobrindo tudo o que o app faz no dia a dia
  (FR-011/FR-012), exceto gestão de conta e de credenciais (FR-020).
- O Finami é o próprio servidor de autorização OAuth (não depende de provedor externo); o login
  com Google continua sendo só uma forma de entrar na tela de autorização.
- Ações de escrita são permitidas pelo MCP, com permissão separada que a pessoa pode negar; a
  confirmação antes de executar fica a cargo do assistente, guiada pelas indicações de
  "altera dados" e "destrutiva" (FR-014).
- Clientes-alvo: assistentes que seguem a especificação de autorização do MCP (descoberta +
  registro dinâmico + PKCE), como o Claude (web, desktop e Claude Code).
- O MCP roda junto do backend existente e é publicado no mesmo domínio de produção, atrás do
  mesmo proxy com HTTPS.
- Tempos: acesso de 1 hora, renovação por até 30 dias de inatividade, código de 10 minutos, chave
  de repetição guardada por 24 horas, limite de 60 chamadas por minuto — valores padrão de
  mercado, ajustáveis por configuração.
- Fuso de Brasília para datas sem fuso; moedas suportadas continuam sendo só BRL e BTC.
- Interpretação de linguagem natural (ex.: "80 reais") é responsabilidade do assistente; o MCP
  recebe valores já estruturados.
- Depende das features 001 (contas, carteiras, lançamentos, extratos), 002 (app e tela Conta) e
  003 (inclusão de membros, convites e notificações).
