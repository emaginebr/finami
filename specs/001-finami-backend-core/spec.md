# Feature Specification: Núcleo do Backend do Finami

**Feature Branch**: `001-finami-backend-core`
**Created**: 2026-11-01
**Status**: Draft
**Input**: User description: "Implemente o backend do Finami — web app de gestão financeira familiar: usuários (nome, sobrenome, email, senha) que podem ser criados sem credenciais mas só logam com email; autenticação por token e login com Google; grupos com um responsável que gerencia os membros; carteiras (nome, descrição, moeda Real ou Bitcoin, virtual); consulta da cotação do bitcoin; transferências entre carteiras com histórico completo no modelo de plano de contas (conta de saída e de entrada), tratando Real→Bitcoin como compra e Bitcoin→Real como venda na cotação atual; extrato por período por grupo, usuário ou carteira."

## Escopo

Esta feature cobre **apenas o backend** (serviço de API) do Finami. Interfaces de usuário
(web ou mobile) estão fora do escopo; todas as capacidades descritas aqui são expostas como
operações consumíveis por um futuro frontend.

## Clarifications

### Session 2026-11-01

- Q: Quem gerencia um usuário sem login (dados, carteiras, transações)? → A: A carteira pode ser vinculada a um grupo, e o responsável pelo grupo tem controle sobre as carteiras do grupo; o usuário também pode criar carteiras não vinculadas a nenhum grupo (pessoais).
- Q: Transferências podem envolver carteiras de outros usuários? → A: Sim, o destino pode ser a carteira de qualquer usuário do sistema.
- Q: Quem vê o extrato do grupo? → A: É uma configuração do grupo com três opções: apenas o responsável; todos os membros; responsável vê tudo e membros veem só totais.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastro e acesso à conta (Priority: P1)

Uma pessoa da família se cadastra no Finami informando nome, sobrenome, email e senha (ou
entra direto com sua conta Google) e passa a acessar o sistema de forma autenticada.

**Why this priority**: sem identidade e acesso nenhuma outra funcionalidade pode ser usada
com segurança; é a base de todo o produto.

**Independent Test**: cadastrar um usuário com email e senha, autenticar-se e acessar uma
operação protegida; repetir com uma conta Google.

**Acceptance Scenarios**:

1. **Given** um visitante sem conta, **When** ele se cadastra com nome, sobrenome, email e senha válidos, **Then** a conta é criada e ele consegue se autenticar com esse email e senha.
2. **Given** um usuário cadastrado, **When** ele informa email e senha corretos, **Then** recebe uma credencial de acesso com validade limitada que o autoriza nas demais operações.
3. **Given** um usuário cadastrado, **When** ele informa a senha errada, **Then** o acesso é negado com mensagem genérica (sem revelar se o email existe).
4. **Given** uma pessoa com conta Google, **When** ela escolhe entrar com Google pela primeira vez, **Then** um usuário é criado com nome, sobrenome e email vindos do Google e ela fica autenticada.
5. **Given** um usuário já cadastrado com o email X, **When** ele entra com uma conta Google do mesmo email X, **Then** o acesso é vinculado ao usuário existente (não é criado um duplicado).
6. **Given** uma requisição sem credencial ou com credencial expirada, **When** ela tenta acessar uma operação protegida, **Then** é recusada como não autenticada.

---

### User Story 2 - Carteiras e saldos (Priority: P1)

O usuário cadastra suas carteiras — uma conta bancária em Real, uma carteira cripto real em
Bitcoin ou uma carteira apenas virtual (anotação) — e acompanha o saldo de cada uma.

**Why this priority**: a carteira é a unidade de conta do Finami; sem ela não há transações
nem extratos.

**Independent Test**: criar carteiras de Real e de Bitcoin, registrar uma entrada de saldo
e conferir que o saldo de cada carteira reflete os lançamentos.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele cria uma carteira com nome, descrição, moeda (Real ou Bitcoin) e indicação de virtual, **Then** a carteira passa a existir como uma conta própria desse usuário com saldo zero.
2. **Given** uma carteira existente, **When** o usuário registra uma entrada de fundos vinda de fora do sistema (ex.: salário), **Then** é gravada uma transação com conta de saída "origem externa" e conta de entrada a carteira, e o saldo aumenta.
3. **Given** uma carteira com saldo, **When** o usuário registra uma saída para fora do sistema (ex.: pagamento de conta), **Then** é gravada uma transação com conta de saída a carteira e conta de entrada "destino externo", e o saldo diminui.
4. **Given** uma carteira, **When** o usuário consulta seus dados, **Then** vê nome, descrição, moeda, se é virtual e o saldo atual na moeda da carteira.
5. **Given** uma carteira que possui transações, **When** o usuário tenta excluí-la, **Then** a exclusão é impedida (a carteira pode apenas ser desativada) para preservar o histórico.

---

### User Story 3 - Transferência entre carteiras com compra e venda de bitcoin (Priority: P1)

O usuário move fundos de uma carteira para outra a qualquer momento. Se mover de uma
carteira em Real para uma em Bitcoin, o sistema registra uma compra de bitcoin na cotação
atual; se mover de Bitcoin para Real, registra uma venda.

**Why this priority**: é o coração do controle financeiro proposto e o diferencial do
Finami (conversão automática Real ↔ Bitcoin).

**Independent Test**: com uma carteira Real com saldo e uma carteira Bitcoin vazia,
transferir um valor em Real e conferir que a carteira Bitcoin recebeu a quantidade
equivalente na cotação usada, e que a transação registrou essa cotação.

**Acceptance Scenarios**:

1. **Given** duas carteiras na mesma moeda e saldo suficiente na origem, **When** o usuário transfere um valor, **Then** é gravada uma única transação com conta de saída (origem) e conta de entrada (destino), a origem diminui e o destino aumenta exatamente nesse valor.
2. **Given** uma carteira Real com R$ 1.000,00 e uma carteira Bitcoin, com cotação atual de R$ 500.000,00 por BTC, **When** o usuário transfere R$ 1.000,00 da Real para a Bitcoin, **Then** a transação é registrada como **compra**, a carteira Real diminui R$ 1.000,00, a carteira Bitcoin aumenta 0,00200000 BTC, e a cotação usada fica gravada na transação.
3. **Given** uma carteira Bitcoin com 0,01 BTC e uma carteira Real, com cotação atual de R$ 500.000,00 por BTC, **When** o usuário transfere 0,01 BTC da Bitcoin para a Real, **Then** a transação é registrada como **venda**, a Bitcoin diminui 0,01 BTC, a Real aumenta R$ 5.000,00 e a cotação usada fica gravada.
4. **Given** saldo insuficiente na carteira de origem, **When** o usuário tenta transferir, **Then** a transferência é recusada e nenhum saldo é alterado.
5. **Given** uma carteira de origem que o usuário controla e uma carteira ativa de outro usuário qualquer do sistema, **When** ele transfere um valor para ela, **Then** a transação é registrada (com compra/venda se as moedas forem diferentes), aparece no extrato de ambos, e o remetente não passa a ver saldo nem histórico da carteira de destino.
6. **Given** que a cotação do bitcoin está indisponível no momento, **When** o usuário tenta uma transferência que exige conversão, **Then** a transferência é recusada com mensagem clara e nenhum saldo é alterado; transferências na mesma moeda continuam funcionando.
7. **Given** uma transação já registrada, **When** o usuário precisa corrigi-la, **Then** ele registra um estorno (nova transação inversa vinculada à original); a transação original nunca é alterada nem apagada.

---

### User Story 4 - Grupos familiares (Priority: P2)

Um usuário cria um grupo (ex.: "Família Silva"), torna-se responsável por ele e inclui ou
retira membros. Ele também pode cadastrar membros que não usam o sistema (ex.: um filho
pequeno), sem email e senha.

**Why this priority**: viabiliza a gestão financeira *familiar*, mas o produto já entrega
valor individual sem grupos.

**Independent Test**: criar um grupo, cadastrar um usuário sem credenciais, incluí-lo no
grupo, incluir outro usuário existente, retirar um membro e conferir que um não-responsável
não consegue alterar a composição do grupo.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele cria um grupo com um nome, **Then** o grupo é criado e esse usuário fica registrado como seu responsável.
2. **Given** o responsável por um grupo, **When** ele inclui um usuário existente ou retira um membro, **Then** a composição do grupo é atualizada.
3. **Given** um membro que não é o responsável, **When** ele tenta incluir ou retirar membros, **Then** a operação é recusada por falta de permissão.
4. **Given** um usuário autenticado, **When** ele cadastra outro usuário informando apenas nome e sobrenome (sem email e senha), **Then** o usuário é criado, mas não consegue se autenticar até ter ao menos um email cadastrado.
5. **Given** um usuário que pertence ou é responsável por vários grupos, **When** ele lista seus grupos, **Then** vê todos eles, indicando em quais é o responsável.
6. **Given** um usuário que não pertence a nenhum grupo, **When** ele usa o sistema, **Then** consegue gerenciar suas carteiras e transações normalmente.
7. **Given** o responsável por um grupo e um membro sem login, **When** o responsável cria uma carteira para esse membro vinculada ao grupo, **Then** a carteira pertence ao membro e o responsável pode movimentá-la.
8. **Given** uma carteira pessoal (não vinculada), **When** o responsável pelo grupo do titular tenta consultá-la ou movimentá-la, **Then** a operação é recusada.
9. **Given** o responsável por um grupo, **When** ele altera a visibilidade do extrato para "Todos os membros", "Resumo para membros" ou "Apenas o responsável", **Then** a regra passa a valer imediatamente para as consultas dos membros.

---

### User Story 5 - Cotação do bitcoin (Priority: P2)

O usuário consulta a cotação atual do bitcoin em Real e vê quanto valem suas carteiras de
bitcoin hoje.

**Why this priority**: necessária para dar transparência às compras/vendas, mas a
conversão em si já está coberta pela User Story 3.

**Independent Test**: consultar a cotação e conferir que retorna o preço de 1 BTC em Real e
o momento da cotação.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele consulta a cotação do bitcoin, **Then** recebe o preço de 1 BTC em Real e a data/hora a que a cotação se refere.
2. **Given** que a fonte de cotação está temporariamente indisponível, **When** o usuário consulta a cotação, **Then** recebe a última cotação conhecida, sinalizada como desatualizada, ou um aviso de indisponibilidade se nunca houve cotação.

---

### User Story 6 - Extrato por período (Priority: P2)

O usuário gera um extrato de todas as transações de um período, filtrando por uma carteira,
por um usuário (todas as carteiras dele) ou por um grupo (todas as carteiras de todos os
membros).

**Why this priority**: é a principal forma de análise do histórico; depende das
transações (P1) já existirem.

**Independent Test**: registrar transações em datas diferentes e gerar extratos por
carteira, usuário e grupo, conferindo totais e saldos.

**Acceptance Scenarios**:

1. **Given** transações em várias datas, **When** o usuário gera o extrato de uma carteira para um período, **Then** recebe o saldo inicial, cada transação do período em ordem cronológica (data, tipo, contas de saída e entrada, valor, cotação quando houver, descrição), o total de entradas, o total de saídas e o saldo final.
2. **Given** um usuário com várias carteiras, **When** ele gera o extrato por usuário, **Then** recebe as transações de todas as carteiras dele no período, com totais separados por moeda (Real e Bitcoin nunca são somados entre si).
3. **Given** um grupo, **When** um usuário autorizado pela configuração de visibilidade do grupo gera o extrato do grupo, **Then** recebe as transações de todas as carteiras vinculadas ao grupo no período (ou apenas os totais, se a visibilidade for "Resumo para membros" e ele não for o responsável), com totais por moeda; transferências na mesma moeda entre carteiras do próprio escopo aparecem, mas não inflam os totais de entrada/saída do escopo.
4. **Given** um usuário sem permissão sobre a carteira, usuário ou grupo pedido, **When** ele tenta gerar o extrato, **Then** a operação é recusada.

---

### Edge Cases

- Usuário criado sem email tenta se autenticar → recusado ("cadastre um email para acessar").
- Usuário com email, mas sem senha, tenta entrar com email e senha → recusado; só pode entrar com Google (ou após definir uma senha).
- Cadastro ou alteração com email já usado por outro usuário → recusado (email é único quando preenchido).
- Transferência de uma carteira para ela mesma, ou com valor zero/negativo → recusada.
- Transferência envolvendo carteira desativada → recusada.
- Valor informado em bitcoin com mais de 8 casas decimais, ou em Real com mais de 2 → recusado. O valor convertido (compra/venda) é truncado para a precisão da moeda de destino (Bitcoin: 8 casas; Real: 2 casas), nunca arredondado para cima.
- Compra de bitcoin cujo resultado arredonda para 0 BTC → recusada (valor pequeno demais).
- Duas transferências simultâneas da mesma carteira que, juntas, excedem o saldo → apenas a que couber no saldo é aceita.
- Responsável tenta se retirar do próprio grupo → recusado; o grupo precisa sempre ter um responsável.
- Extrato com data inicial posterior à final → recusado.
- Extrato de período sem transações → retorna saldo inicial = saldo final e lista vazia.
- Membro retirado de um grupo → suas carteiras vinculadas são desvinculadas e deixam de compor o extrato do grupo; as transações passadas continuam no histórico das carteiras.
- Transferência para carteira de outro usuário que está desativada → recusada.
- Titular tenta vincular carteira a um grupo do qual não é membro → recusado.
- Membro consulta o extrato do grupo com visibilidade "Apenas o responsável" → recusado; com "Resumo para membros" → recebe apenas os totais por moeda.

## Requirements *(mandatory)*

### Functional Requirements

**Usuários e autenticação**

- **FR-001**: O sistema MUST manter usuários com nome, sobrenome, email (opcional) e senha (opcional).
- **FR-002**: O sistema MUST permitir que um visitante se cadastre informando nome, sobrenome, email e senha.
- **FR-003**: O sistema MUST permitir que um usuário autenticado cadastre outro usuário informando apenas nome e sobrenome, com email e senha opcionais.
- **FR-004**: O sistema MUST impedir a autenticação de usuários sem email cadastrado.
- **FR-005**: O sistema MUST permitir autenticação por email e senha para usuários que possuam ambos.
- **FR-006**: O sistema MUST permitir autenticação com conta Google, criando o usuário no primeiro acesso ou vinculando-o ao usuário existente de mesmo email.
- **FR-007**: Após autenticação bem-sucedida, o sistema MUST emitir uma credencial de acesso assinada e com validade limitada, exigida em todas as operações protegidas.
- **FR-008**: O sistema MUST armazenar senhas apenas de forma irreversível (nunca em texto puro) e exigir senha com no mínimo 8 caracteres.
- **FR-009**: O sistema MUST garantir que um email preenchido seja único entre os usuários.
- **FR-010**: O sistema MUST permitir que o próprio usuário atualize nome, sobrenome, email e senha.
- **FR-011**: Os dados cadastrais (nome, sobrenome, email, senha) de um usuário sem credenciais MUST poder ser alterados por quem o cadastrou, permitindo inclusive habilitar seu acesso ao cadastrar um email. As carteiras e transações desse usuário são controladas pelas regras de carteira vinculada a grupo (FR-019a a FR-019d).

**Grupos**

- **FR-012**: O sistema MUST permitir que qualquer usuário autenticado crie um grupo com um nome, ficando registrado como responsável por ele.
- **FR-013**: Apenas o responsável pelo grupo MUST poder renomear o grupo, incluir membros e retirar membros.
- **FR-014**: O sistema MUST permitir que um usuário pertença a vários grupos e seja responsável por vários grupos.
- **FR-015**: O sistema MUST permitir que um usuário exista sem pertencer a nenhum grupo.
- **FR-016**: O responsável MUST ser sempre considerado membro do próprio grupo e não pode ser retirado dele.
- **FR-017**: O sistema MUST permitir que um usuário liste os grupos dos quais é membro ou responsável e os membros de cada um.

**Carteiras (contas)**

- **FR-018**: O sistema MUST permitir que o usuário crie carteiras com nome, descrição, moeda (Real ou Bitcoin) e indicação de virtual.
- **FR-019**: Cada carteira MUST pertencer a exatamente um usuário (titular) e funcionar como uma conta do plano de contas.
- **FR-019a**: Uma carteira MAY ser vinculada a no máximo um grupo do qual o titular é membro; carteiras não vinculadas são pessoais e controladas apenas pelo titular.
- **FR-019b**: O responsável por um grupo MUST ter controle total sobre as carteiras vinculadas ao grupo (consultar, movimentar, desativar e desvincular), além do próprio titular.
- **FR-019c**: O responsável por um grupo MUST poder criar carteiras para qualquer membro do grupo, já vinculadas a esse grupo (ex.: carteira de um filho sem login).
- **FR-019d**: O titular MUST poder vincular uma carteira pessoal a um grupo do qual é membro; uma vez vinculada, apenas o responsável pelo grupo pode desvinculá-la. Se o titular for retirado do grupo, a carteira é desvinculada automaticamente e volta a ser pessoal.
- **FR-020**: A moeda de uma carteira MUST ser imutável após a criação.
- **FR-021**: O saldo de uma carteira MUST ser sempre derivado do histórico de transações (soma das entradas menos soma das saídas) e nunca ficar negativo.
- **FR-022**: Carteiras com transações MUST NOT ser excluídas; podem apenas ser desativadas, deixando de aceitar novas transações e permanecendo nos extratos.
- **FR-023**: O sistema MUST possuir contas especiais de "origem externa" e "destino externo" para registrar entradas e saídas de fundos de/para fora do Finami.

**Transações**

- **FR-024**: Toda transação MUST ter exatamente uma conta de saída e uma conta de entrada, diferentes entre si, data/hora, valor, tipo, descrição opcional e o usuário que a registrou.
- **FR-025**: O sistema MUST suportar os tipos de transação: entrada externa, saída externa, transferência, compra de bitcoin, venda de bitcoin e estorno.
- **FR-026**: O sistema MUST permitir transferências entre carteiras a qualquer momento, desde que a origem tenha saldo suficiente. A carteira de origem MUST ser uma que o usuário controla (FR-019, FR-019b); a carteira de destino MAY ser qualquer carteira ativa de qualquer usuário do sistema.
- **FR-026a**: Ao transferir para uma carteira que não controla, o usuário MUST ver apenas o necessário para confirmar o destino (nome da carteira, moeda e nome do titular), nunca o saldo ou o histórico dela; a transação aparece no extrato de ambos os lados.
- **FR-027**: Transferência de carteira Real para carteira Bitcoin MUST ser registrada como compra de bitcoin, convertendo o valor pela cotação atual; transferência de Bitcoin para Real MUST ser registrada como venda, convertendo pela cotação atual.
- **FR-028**: Transações com conversão MUST registrar o valor debitado na moeda de origem, o valor creditado na moeda de destino e a cotação utilizada com sua data/hora.
- **FR-029**: Transferências que exigem conversão MUST ser recusadas quando não houver cotação atual disponível (cotação com mais de 5 minutos é considerada não atual para conversão).
- **FR-030**: Transações MUST ser imutáveis e permanentes; correções são feitas por estorno, uma nova transação inversa vinculada à original, que reutiliza os valores e a cotação da transação original. Uma transação só pode ser estornada uma vez.
- **FR-031**: Uma transação e seus efeitos nos saldos MUST ser aplicados de forma integral ou não aplicados (nunca parcialmente), inclusive sob operações concorrentes.

**Cotação**

- **FR-032**: O sistema MUST disponibilizar a cotação atual de 1 BTC em Real, com a data/hora de referência, obtida de uma fonte externa de mercado; em caso de indisponibilidade, MUST informar a última cotação conhecida sinalizada como desatualizada.

**Extratos e permissões de consulta**

- **FR-033**: O sistema MUST gerar extrato por período (data inicial e final inclusivas) filtrado por carteira, por usuário ou por grupo, contendo saldo inicial, transações em ordem cronológica, total de entradas, total de saídas e saldo final, sempre separados por moeda. O extrato de um grupo abrange as carteiras vinculadas ao grupo; o extrato de um usuário abrange todas as carteiras das quais ele é titular.
- **FR-034**: Em extratos de usuário ou grupo, transferências na mesma moeda entre carteiras do próprio escopo MUST ser exibidas, mas não somadas aos totais de entradas e saídas do escopo. Compras e vendas de bitcoin dentro do escopo contam como saída na moeda de origem e entrada na moeda de destino.
- **FR-035**: Um usuário MUST poder consultar extratos das próprias carteiras e de si mesmo. O responsável pelo grupo MUST sempre poder consultar o extrato completo do grupo e de cada carteira vinculada a ele.
- **FR-035a**: Cada grupo MUST ter uma configuração de visibilidade do extrato, alterável apenas pelo responsável, com três opções: (1) **Apenas o responsável** — os demais membros não veem o extrato do grupo; (2) **Todos os membros** — qualquer membro vê o extrato completo do grupo; (3) **Resumo para membros** — o responsável vê o extrato completo e os demais membros veem apenas os totais por moeda (saldo inicial, entradas, saídas, saldo final), sem o detalhe das transações das carteiras de outros membros. Em todas as opções, cada membro sempre vê o detalhe das próprias carteiras. O padrão de um grupo novo é "Apenas o responsável".
- **FR-036**: O sistema MUST recusar qualquer operação sobre carteiras, transações, grupos ou extratos para os quais o usuário não tenha permissão.

### Key Entities

- **Usuário**: pessoa da família. Nome, sobrenome, email (opcional, único), senha (opcional, armazenada de forma irreversível), vínculo com conta Google (opcional), quem o cadastrou. Pode ter várias carteiras e participar de vários grupos.
- **Grupo**: conjunto de usuários (ex.: uma família). Nome, usuário responsável (UserId) e visibilidade do extrato (apenas responsável / todos os membros / resumo para membros). Possui vários membros e pode ter carteiras vinculadas.
- **Membro do grupo**: associação entre grupo e usuário, com a data de inclusão.
- **Carteira (Conta)**: conta do plano de contas pertencente a um usuário (titular) e, opcionalmente, vinculada a um grupo. Nome, descrição, moeda (Real ou Bitcoin), virtual (sim/não), ativa (sim/não), data de criação. Saldo derivado das transações.
- **Conta externa**: conta especial do sistema ("origem externa", "destino externo") que representa o mundo fora do Finami.
- **Transação**: lançamento imutável com conta de saída, conta de entrada, tipo, data/hora, valor debitado (moeda de origem), valor creditado (moeda de destino), cotação aplicada (quando houver), descrição, usuário que registrou e referência à transação estornada (quando for estorno).
- **Cotação**: preço de 1 BTC em Real, data/hora de referência e fonte.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um novo usuário consegue se cadastrar e acessar o sistema (por email/senha ou Google) em menos de 1 minuto.
- **SC-002**: 100% das transações registradas possuem conta de saída e conta de entrada, e a soma de todos os débitos e créditos por moeda (incluindo contas externas) fecha em zero.
- **SC-003**: Para qualquer carteira, o saldo final de um extrato do início do histórico até hoje é igual ao saldo atual da carteira em 100% dos casos.
- **SC-004**: Em toda compra ou venda de bitcoin, o valor creditado difere do valor debitado × cotação registrada no máximo pelo arredondamento da moeda de destino.
- **SC-005**: Nenhum cenário de transferências concorrentes resulta em saldo negativo ou em transação parcialmente aplicada.
- **SC-006**: Um extrato de um ano de transações de um grupo familiar (até 10 membros, 5.000 transações) é gerado em menos de 3 segundos.
- **SC-007**: 100% das tentativas de operar recursos sem permissão (grupo, carteira, extrato de outro usuário) são recusadas.
- **SC-008**: A cotação exibida ao usuário nunca tem mais de 5 minutos sem estar explicitamente sinalizada como desatualizada.

## Assumptions

- Escopo restrito ao backend; o frontend será especificado em feature futura.
- O mecanismo de autenticação por token assinado (JWT) e o login com Google foram pedidos explicitamente; ambos substituem o esquema "Basic Authentication" descrito na constituição atual, o que deverá ser tratado como emenda/justificativa no plano.
- O Real (BRL) é a moeda de referência para cotação e para valor estimado das carteiras de bitcoin.
- Precisão: Real com 2 casas decimais; Bitcoin com 8 casas decimais (satoshi).
- Não há taxas de corretagem nem spread nas compras/vendas: a conversão usa exatamente a cotação de mercado obtida no momento.
- Carteiras virtuais e reais seguem as mesmas regras de saldo e transação; a marcação "virtual" é informativa e usada para filtro/relatório.
- Entradas e saídas de fundos de/para fora do sistema (salário, despesas) são necessárias para que haja saldo a transferir e são registradas contra as contas externas.
- A data/hora das transações é a do momento do registro; lançamentos retroativos estão fora do escopo desta versão.
- O extrato de grupo considera apenas as carteiras vinculadas ao grupo; carteiras pessoais dos membros não aparecem nele, preservando a privacidade de cada um.
- A desvinculação ou revinculação de uma carteira vale para o extrato inteiro do grupo a partir do vínculo atual (o vínculo não é histórico).
- Exclusão de usuários e de grupos está fora do escopo desta versão (apenas retirada de membros e desativação de carteiras).
- Recuperação de senha por email está fora do escopo desta versão.
- A validade da credencial de acesso segue padrões de mercado (ex.: algumas horas), configurável.
- Depende de uma fonte pública de cotação de bitcoin e do serviço de login do Google, ambos acessíveis pela internet.
