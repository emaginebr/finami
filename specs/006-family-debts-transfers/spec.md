# Feature Specification: Dívidas entre pessoas e transferências dentro da família

**Feature Branch**: `006-family-debts-transfers`
**Created**: 2026-11-03
**Status**: Draft
**Input**: User description: "Melhorias no projeto: as contas entre pessoas devem ser balanceadas (se A transfere 100 para B, B deve 100 para A); essas dívidas devem ser exibidas na página do usuário; valores só podem ser transferidos entre famílias; conversões de Real ↔ Bitcoin só podem ser feitas pelo mesmo usuário; na janela de transferência, o campo De mostra o ícone do tipo de conta, o primeiro nome do usuário e o saldo; o campo Para é igual, mas só com as contas da família e do mesmo tipo (real ou BTC), sem a conta De; o botão flutuante deve aparecer em todas as telas; na transferência de bitcoin, posso informar o valor em real e o sistema faz a conversão."

## Contexto

Hoje uma transferência entre carteiras de pessoas diferentes só move o dinheiro: ninguém fica
sabendo quanto um deve ao outro. Também é possível transferir para qualquer carteira pelo código
público, mesmo de quem não é da família, e converter real em bitcoin mandando o dinheiro direto
para a carteira de bitcoin de outra pessoa. Na tela de transferência, as carteiras de origem e de
destino aparecem só pelo nome, sem dizer de quem são nem quanto têm.

Esta feature transforma as transferências entre pessoas em **empréstimos rastreados** (quem
recebe passa a dever a quem enviou), limita as transferências às pessoas das famílias de quem
envia, restringe conversões real ↔ bitcoin às carteiras da mesma pessoa, melhora os campos De e
Para, deixa o botão de lançamento sempre à mão e permite informar uma transferência de bitcoin em
reais.

Termos usados nesta especificação:

- **Titular**: a pessoa dona da carteira (não necessariamente quem faz o lançamento; o responsável
  pela família pode lançar nas carteiras dos dependentes).
- **Pessoas da família**: todas as pessoas que estão em pelo menos uma família em comum com o
  titular da carteira de origem.
- **Tipo da carteira**: a moeda dela — real (R$) ou bitcoin (₿).

## Clarifications

### Session 2026-11-03

- Q: O campo Para deve mostrar só carteiras do mesmo tipo ou também as carteiras do próprio titular
  de outro tipo, para converter? → A: Mostra as do mesmo tipo da família e, num grupo separado
  "Converter", as carteiras do próprio titular do outro tipo (opção recomendada, adotada ao seguir
  para o planejamento).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber quem deve a quem (Priority: P1)

Ana transfere R$ 100,00 da carteira dela para a carteira de Bruno. A partir desse momento, o
Finami registra que Bruno deve R$ 100,00 a Ana. Se depois Bruno transfere R$ 30,00 para Ana, a
dívida cai para R$ 70,00; se ele transferir R$ 100,00, a dívida passa a ser de Ana com Bruno
(R$ 30,00). Na página de cada pessoa aparece a lista de dívidas dela: com quem, quanto e em que
sentido ("Bruno deve R$ 70,00 a você" / "Você deve R$ 30,00 a Bruno").

**Why this priority**: é o pedido central da feature — sem o saldo entre pessoas, a família não
tem como acertar as contas.

**Independent Test**: com duas pessoas da mesma família, fazer transferências nos dois sentidos e
conferir, na página de cada uma, que a dívida mostrada é a soma líquida das transferências.

**Acceptance Scenarios**:

1. **Given** Ana e Bruno sem nenhuma transferência entre si, **When** Ana transfere R$ 100,00 para
   uma carteira de Bruno, **Then** a página de Bruno mostra "deve R$ 100,00 a Ana" e a de Ana mostra
   "Bruno deve R$ 100,00 a você".
2. **Given** Bruno deve R$ 100,00 a Ana, **When** Bruno transfere R$ 30,00 para Ana, **Then** a
   dívida passa a R$ 70,00.
3. **Given** Bruno deve R$ 100,00 a Ana, **When** Bruno transfere R$ 100,00 para Ana, **Then** a
   dívida entre os dois fica zerada e deixa de aparecer na lista (ou aparece como "quites").
4. **Given** uma transferência de Ana para Bruno, **When** ela é estornada, **Then** a dívida
   gerada por ela é desfeita.
5. **Given** Ana move dinheiro entre duas carteiras dela mesma, **When** a transferência é
   registrada, **Then** nenhuma dívida é criada.
6. **Given** o responsável pela família transfere da carteira do dependente Caio para a carteira
   de Ana, **When** a transferência é registrada, **Then** a dívida é de Ana com Caio (titulares),
   não com o responsável.

---

### User Story 2 - Transferir só dentro da família, com destino claro (Priority: P1)

Ao abrir a tela de transferência, Ana escolhe a carteira de origem no campo **De**: cada opção
mostra o ícone do tipo (real ou bitcoin), o primeiro nome do titular e o saldo atual. No campo
**Para**, aparecem apenas as carteiras das pessoas da família, do mesmo tipo da carteira escolhida
em De, sem a própria carteira de origem, no mesmo formato (ícone, primeiro nome, saldo).
Transferir para alguém fora das famílias não é mais possível, nem pelo app nem por outros canais
(como o assistente conectado por MCP).

**Why this priority**: evita mandar dinheiro para a pessoa errada e mantém as dívidas dentro de
quem divide as contas.

**Independent Test**: com uma carteira em real escolhida em De, conferir que o Para lista só
carteiras em real de pessoas das famílias de quem envia, sem a de origem; tentar transferir para
uma carteira de fora da família (por qualquer canal) e ver a recusa.

**Acceptance Scenarios**:

1. **Given** Ana com carteiras "Nubank" (R$ 1.234,56) e "Ledger" (₿ 0,01000), **When** abre o campo
   De, **Then** vê cada carteira com o ícone do tipo, "Ana" e o saldo.
2. **Given** Ana escolheu "Nubank" (real) em De, **When** abre o campo Para, **Then** vê apenas as
   carteiras em real das pessoas das famílias dela, sem a "Nubank", cada uma com ícone, primeiro
   nome do titular e saldo.
3. **Given** Ana troca a carteira De para uma de bitcoin, **When** abre o campo Para, **Then** a
   lista passa a mostrar só carteiras de bitcoin, e o destino escolhido antes (em real) é limpo.
4. **Given** uma carteira de uma pessoa que não está em nenhuma família de Ana, **When** Ana tenta
   transferir para ela por qualquer canal, **Then** a transferência é recusada com a mensagem
   "Só é possível transferir para pessoas da sua família." e nada é registrado.
5. **Given** o saldo de uma carteira de destino está restrito para quem transfere (visibilidade do
   extrato da família), **When** ela aparece no Para, **Then** o saldo aparece oculto ("—"), sem
   revelar o valor.

---

### User Story 3 - Converter real ↔ bitcoin só nas próprias carteiras (Priority: P2)

Converter real em bitcoin (ou bitcoin em real) só é permitido entre carteiras do mesmo titular.
Ana pode comprar bitcoin passando dinheiro da "Nubank" dela para a "Ledger" dela, mas não pode
mandar R$ 100,00 para a carteira de bitcoin de Bruno.

**Why this priority**: conversão envolve cotação e não faz sentido como empréstimo entre pessoas;
a regra evita dívidas em moedas misturadas.

**Independent Test**: tentar converter real para a carteira de bitcoin de outra pessoa (por
qualquer canal) e ver a recusa; converter entre as próprias carteiras e ver a conversão registrada
com a cotação.

**Acceptance Scenarios**:

1. **Given** Ana com "Nubank" (real) e "Ledger" (bitcoin), **When** converte R$ 500,00 da Nubank
   para a Ledger, **Then** a compra de bitcoin é registrada com a cotação, como hoje.
2. **Given** Bruno com uma carteira de bitcoin, **When** Ana tenta enviar real da Nubank para a
   carteira de bitcoin de Bruno, **Then** a operação é recusada com a mensagem "Conversão entre
   real e bitcoin só entre carteiras da mesma pessoa." e nada é registrado.
3. **Given** uma conversão entre carteiras do mesmo titular, **When** é registrada, **Then** nenhuma
   dívida é criada.

---

### User Story 4 - Transferir bitcoin informando o valor em reais (Priority: P2)

Ao transferir de uma carteira de bitcoin, Ana pode digitar o valor em reais (por exemplo
"R$ 200,00") em vez de bitcoin. O Finami converte pela cotação atual, mostra quanto em bitcoin
será enviado e a cotação usada, e só então pede a confirmação. A transferência é registrada em
bitcoin.

**Why this priority**: ninguém pensa em "0,00041 bitcoin"; pensar em reais deixa a transferência
de bitcoin usável no dia a dia.

**Independent Test**: transferir de uma carteira de bitcoin informando R$ 200,00 e conferir que o
valor em bitcoin registrado corresponde a R$ 200,00 pela cotação mostrada na confirmação.

**Acceptance Scenarios**:

1. **Given** uma transferência com origem em bitcoin, **When** Ana escolhe informar o valor em reais
   e digita R$ 200,00, **Then** vê o equivalente em bitcoin e a cotação antes de confirmar.
2. **Given** a confirmação mostra ₿ 0,00040000 pela cotação R$ 500.000,00, **When** Ana confirma,
   **Then** a carteira de origem perde ₿ 0,00040000 e a de destino recebe o mesmo valor.
3. **Given** a cotação não está disponível, **When** Ana tenta informar o valor em reais, **Then**
   vê o aviso de cotação indisponível e pode informar o valor direto em bitcoin.
4. **Given** o valor em reais é pequeno demais e vira zero bitcoin, **When** tenta continuar,
   **Then** vê "Valor pequeno demais para conversão." e não consegue confirmar.

---

### User Story 5 - Botão de lançamento em todas as telas (Priority: P3)

O botão flutuante (Depositar · Sacar · Transferir) aparece em todas as telas do app com a pessoa
logada, não só na Home e nas Carteiras. Quando a tela é o extrato de uma carteira, a carteira
continua pré-selecionada no lançamento, como hoje.

**Why this priority**: conveniência; o lançamento já existe, só fica mais acessível.

**Independent Test**: navegar por Família, página de pessoa, Conta e Notificações e conferir que o
botão aparece e abre o menu de lançamento.

**Acceptance Scenarios**:

1. **Given** Ana está na aba Família, na página de uma pessoa, na Conta ou nas Notificações, **When**
   olha a tela, **Then** vê o botão flutuante.
2. **Given** Ana já está numa tela de lançamento (Depositar, Sacar ou Transferir), **When** olha a
   tela, **Then** o botão não aparece (o formulário já ocupa a tela).

---

### Edge Cases

- **Transferência para alguém que saiu da família**: a dívida já criada continua aparecendo nas
  páginas das duas pessoas; novas transferências entre elas são recusadas se não tiverem mais
  nenhuma família em comum.
- **Pessoas em várias famílias**: o Para lista as carteiras de todas as pessoas que estão em pelo
  menos uma família em comum com o titular da origem, sem repetir pessoas.
- **Responsável lançando por um dependente**: a regra de família é avaliada para o titular da
  carteira de origem, não para quem faz o lançamento.
- **Carteiras desativadas**: não aparecem no Para.
- **Nenhuma carteira possível no Para** (titular sem família ou sem carteiras do mesmo tipo na
  família): o campo Para mostra um aviso explicando o motivo, e não é possível confirmar.
- **Estorno de uma transferência antiga**: desfaz exatamente o valor que ela gerou de dívida, mesmo
  que a dívida atual já tenha mudado de sentido.
- **Dívidas em bitcoin**: ficam separadas das em real (ver FR-004); a página mostra cada moeda em
  sua linha.
- **Saldo negativo**: continua permitido em qualquer carteira (comportamento atual); a transferência
  não depende do saldo.
- **Transferências existentes antes desta feature**: ver FR-005.

## Requirements *(mandatory)*

### Functional Requirements

**Dívidas entre pessoas**

- **FR-001**: Toda transferência entre carteiras de titulares diferentes MUST gerar uma dívida do
  titular da carteira de destino com o titular da carteira de origem, no valor transferido.
- **FR-002**: A dívida entre duas pessoas MUST ser líquida: transferências nos dois sentidos se
  compensam, e o resultado indica quem deve a quem e quanto.
- **FR-003**: Transferências entre carteiras do mesmo titular, depósitos, saques e conversões MUST
  NOT gerar dívida.
- **FR-004**: Dívidas MUST ser apuradas separadamente por moeda (real e bitcoin), sem conversão
  entre elas.
- **FR-005**: As dívidas MUST considerar todas as transferências entre titulares diferentes já
  registradas, inclusive as anteriores a esta feature.
- **FR-006**: O estorno de uma transferência MUST desfazer a dívida que ela gerou.
- **FR-007**: A página de uma pessoa MUST mostrar a lista das dívidas dela com cada outra pessoa,
  por moeda, com o nome da outra pessoa, o valor e o sentido ("deve a você" / "você deve" quando a
  página é da pessoa logada; "deve a [nome]" / "[nome] deve a ela" nas demais). Pares quites não
  aparecem.
- **FR-008**: As dívidas de uma pessoa MUST ser visíveis para quem já pode ver a página dela; as
  regras atuais de quem pode ver uma pessoa continuam valendo.
- **FR-009**: O assistente conectado por MCP MUST conseguir consultar as dívidas da pessoa
  conectada, com as mesmas regras de visibilidade.

**Regras de transferência**

- **FR-010**: Uma transferência MUST ser recusada se o titular da carteira de destino não for o
  próprio titular da origem nem uma pessoa que tenha pelo menos uma família em comum com ele. A
  mensagem é "Só é possível transferir para pessoas da sua família.".
- **FR-011**: Uma conversão (origem e destino de moedas diferentes) MUST ser recusada se as duas
  carteiras não forem do mesmo titular. A mensagem é "Conversão entre real e bitcoin só entre
  carteiras da mesma pessoa.".
- **FR-012**: As regras FR-010 e FR-011 MUST valer para todos os canais de lançamento (app, API e
  assistente MCP), inclusive para a pré-visualização da transferência.
- **FR-013**: A transferência para carteira de outra pessoa pelo código público MUST deixar de ser
  oferecida no app; o destino passa a ser escolhido apenas na lista do campo Para.

**Campos De e Para**

- **FR-014**: Cada opção do campo De MUST mostrar o ícone do tipo da carteira (real ou bitcoin), o
  primeiro nome do titular, o nome da carteira e o saldo atual.
- **FR-015**: O campo De MUST listar as carteiras ativas em que a pessoa logada pode lançar (as
  dela e as dos dependentes de quem é responsável).
- **FR-016**: O campo Para MUST listar apenas carteiras ativas, do mesmo tipo da carteira escolhida
  em De, cujos titulares sejam o próprio titular da origem ou pessoas da família dele, excluindo a
  carteira escolhida em De; cada opção no mesmo formato do De.
- **FR-017**: Para conversões entre as próprias carteiras, o campo Para MUST também listar as
  carteiras ativas do mesmo titular com o outro tipo, em um grupo separado identificado como
  conversão ("Converter").
- **FR-018**: No campo Para, o saldo de uma carteira MUST respeitar a visibilidade do extrato da
  família: quando a pessoa logada não pode ver o saldo, ele aparece oculto.
- **FR-019**: Ao trocar a carteira De, o destino escolhido MUST ser limpo se deixar de ser válido.

**Transferência de bitcoin em reais**

- **FR-020**: Em transferências com origem em bitcoin e destino em bitcoin, a pessoa MUST poder
  escolher informar o valor em reais.
- **FR-021**: Quando o valor é informado em reais, o sistema MUST convertê-lo para bitcoin pela
  cotação atual, truncando em 8 casas, e mostrar o valor em bitcoin e a cotação antes da
  confirmação.
- **FR-022**: A transferência MUST ser registrada em bitcoin (valor convertido); a dívida gerada é
  em bitcoin.
- **FR-023**: Se a cotação estiver indisponível, a opção em reais MUST mostrar o aviso e permitir
  voltar a informar em bitcoin.

**Botão flutuante**

- **FR-024**: O botão flutuante de lançamento MUST aparecer em todas as telas do app com sessão
  ativa, exceto nas próprias telas de lançamento (Depositar, Sacar, Transferir) e na tela de
  autorização de acesso do assistente.
- **FR-025**: No extrato de uma carteira, o botão MUST continuar pré-selecionando essa carteira.

### Key Entities

- **Dívida entre pessoas**: o saldo líquido entre duas pessoas em uma moeda — quem deve, a quem e
  quanto. É derivada das transferências entre carteiras de titulares diferentes (e de seus
  estornos); não é lançada diretamente.
- **Transferência** (existente): passa a ter as restrições de família e de conversão; a de bitcoin
  pode ter sido informada em reais (o registro continua em bitcoin, com a cotação usada).
- **Pessoas da família** (derivado): conjunto de pessoas que têm pelo menos uma família em comum
  com o titular de uma carteira.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para qualquer par de pessoas, a dívida mostrada é igual à soma das transferências de
  uma para a outra menos a soma no sentido contrário (descontados os estornos), em 100% dos casos
  de teste, por moeda.
- **SC-002**: 0 transferências registradas para pessoas sem família em comum com o titular da
  origem e 0 conversões entre titulares diferentes, por qualquer canal, após a entrada da feature.
- **SC-003**: Uma pessoa encontra quanto deve e a quem em até 2 toques a partir da Home.
- **SC-004**: Na tela de transferência, 100% das opções de De e Para mostram tipo, primeiro nome
  do titular e saldo (ou saldo oculto), e o Para nunca contém a carteira de origem nem carteiras de
  outro tipo fora do grupo de conversão.
- **SC-005**: Uma transferência de bitcoin informada em reais é concluída em até 30 segundos, e o
  valor em bitcoin registrado é o mesmo mostrado na confirmação.
- **SC-006**: O botão flutuante está presente em 100% das telas com sessão ativa listadas em
  FR-024.

## Assumptions

- "Página do usuário" é a página de uma pessoa já existente no app (aberta pela família ou pelas
  carteiras); a pessoa logada vê as próprias dívidas na página dela.
- A dívida é entre titulares das carteiras; quem apenas fez o lançamento (o responsável, por um
  dependente) não entra na dívida.
- Não há, nesta feature, um botão de "quitar" dívida: acertar as contas é fazer uma transferência
  no sentido contrário, que compensa a dívida.
- "Entre famílias" significa entre pessoas que têm pelo menos uma família em comum (a mesma
  família); transferências entre carteiras do mesmo titular continuam livres.
- A transferência em reais só se aplica a transferências bitcoin → bitcoin; depósitos e saques em
  bitcoin continuam sendo informados em bitcoin.
- O saldo das carteiras pode continuar negativo (comportamento atual).
- Dívidas antigas, de transferências feitas para pessoas que nunca foram da família (pelo código
  público), também aparecem, pois foram transferências reais entre pessoas.
