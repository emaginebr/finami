# Feature Specification: Tipos de transferência — empréstimo, quitação e pagamento

**Feature Branch**: `007-loan-transfer-types`
**Created**: 2026-11-03
**Status**: Draft
**Input**: User description: "Melhorias em transferências: devem existir 3 tipos de transferência — Empréstimo (gera uma dívida que deve ser paga depois), Quitação (pagamento de um empréstimo; desconta parte ou toda a dívida) e Pagamento (passa da conta de um usuário para outro, não entra como dívida). O empréstimo pode ser pago de forma total ou parcial. Empréstimo feito em real deve ser pago em real; feito em bitcoin, pago em bitcoin. Quando o empréstimo for pago com outra moeda, o valor é convertido na cotação atual. Em tela, o empréstimo em real pode ser pago em bitcoin e vice-versa, mas por trás é convertido na cotação atual."

## Contexto

Desde a feature 006, **toda** transferência entre carteiras de titulares diferentes vira dívida:
quem recebe passa a dever a quem enviou, e transferências no sentido contrário compensam. Isso não
distingue três situações bem diferentes do dia a dia de uma família:

- **emprestar** dinheiro, que precisa voltar;
- **devolver** um empréstimo, total ou parcialmente;
- **pagar** alguém (mesada, presente, divisão de uma conta), sem que ninguém fique devendo.

Esta feature faz a pessoa dizer, ao transferir para outra pessoa, qual é o caso. Só empréstimos
criam dívida; quitações a reduzem; pagamentos não mexem nela. A quitação pode ser feita na outra
moeda (uma dívida em real paga com bitcoin, ou o contrário), com a conversão pela cotação atual.

Termos usados nesta especificação (os da feature 006 continuam valendo):

- **Titular**: a pessoa dona da carteira.
- **Credor / devedor**: em uma dívida, quem tem a receber e quem tem a pagar.
- **Moeda da dívida**: a moeda em que o empréstimo foi feito (real ou bitcoin).
- **Moeda do pagamento**: a moeda das carteiras usadas na quitação.

## Clarifications

### Session 2026-11-03

- Q: A quitação abate o saldo total da dívida entre as duas pessoas ou um empréstimo específico? →
  A: O saldo total entre as duas pessoas, por moeda (FR-011).
- Q: O que acontece com uma quitação maior que a dívida? → A: É recusada com "O valor é maior que a
  dívida ([valor])."; "Quitar tudo" preenche o valor exato (FR-009).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Escolher o tipo ao transferir para outra pessoa (Priority: P1)

Ana vai transferir R$ 100,00 da carteira dela para a carteira de Bruno. Como o destino é de outra
pessoa, a tela pede o tipo da transferência: **Empréstimo**, **Quitação** ou **Pagamento**.

- Se ela escolhe **Empréstimo**, Bruno passa a dever R$ 100,00 a Ana.
- Se escolhe **Pagamento**, o dinheiro passa para Bruno e ninguém fica devendo.

Transferências entre carteiras da mesma pessoa (inclusive conversões) não pedem tipo.

**Why this priority**: é a base da feature — sem o tipo, toda transferência vira dívida, e a
família não consegue registrar mesadas, presentes ou divisão de contas sem criar dívidas falsas.

**Independent Test**: transferir de Ana para Bruno uma vez como Empréstimo e outra como
Pagamento, e conferir que só o empréstimo aparece nas dívidas das duas pessoas.

**Acceptance Scenarios**:

1. **Given** Ana escolheu uma carteira dela em De e uma carteira de Bruno em Para, **When** olha o
   formulário, **Then** vê a escolha do tipo (Empréstimo, Quitação, Pagamento) e não consegue
   continuar sem escolher.
2. **Given** Ana escolheu duas carteiras dela mesma, **When** olha o formulário, **Then** a escolha
   do tipo não aparece.
3. **Given** nenhuma dívida entre Ana e Bruno, **When** Ana transfere R$ 100,00 para Bruno como
   Empréstimo, **Then** a página de Bruno mostra que ele deve R$ 100,00 a Ana.
4. **Given** nenhuma dívida entre Ana e Bruno, **When** Ana transfere R$ 100,00 para Bruno como
   Pagamento, **Then** nenhuma dívida aparece, e os saldos das carteiras mudam normalmente.
5. **Given** uma transferência registrada, **When** alguém abre o extrato ou o detalhe dela,
   **Then** vê o tipo (Empréstimo, Quitação ou Pagamento).

---

### User Story 2 - Quitar um empréstimo, total ou parcialmente, na mesma moeda (Priority: P1)

Bruno deve R$ 100,00 a Ana. Ele abre Transferir, escolhe uma carteira dele em real e uma carteira
de Ana em real, e escolhe **Quitação**. A tela mostra quanto ele deve a Ana (R$ 100,00) e oferece
quitar tudo com um toque. Ele paga R$ 30,00: a dívida cai para R$ 70,00. Depois paga os R$ 70,00
restantes e a dívida some.

**Why this priority**: sem a quitação, o empréstimo nunca sai da lista; é a outra metade do
empréstimo.

**Independent Test**: com um empréstimo de R$ 100,00 de Ana para Bruno, registrar uma quitação de
R$ 30,00 e depois uma de R$ 70,00, conferindo a dívida após cada uma.

**Acceptance Scenarios**:

1. **Given** Bruno deve R$ 100,00 a Ana, **When** escolhe Quitação para uma carteira de Ana,
   **Then** vê "Você deve R$ 100,00 a Ana" e a ação "Quitar tudo", que preenche o valor total.
2. **Given** Bruno deve R$ 100,00 a Ana, **When** quita R$ 30,00, **Then** a dívida passa a
   R$ 70,00.
3. **Given** Bruno deve R$ 70,00 a Ana, **When** quita R$ 70,00, **Then** a dívida fica zerada e
   deixa de aparecer.
4. **Given** Bruno deve R$ 70,00 a Ana, **When** tenta quitar R$ 80,00, **Then** a quitação é
   recusada com a mensagem "O valor é maior que a dívida (R$ 70,00)." e nada é registrado.
5. **Given** Bruno não deve nada a Ana, **When** escolhe Quitação para uma carteira de Ana,
   **Then** vê "Você não tem dívida com Ana." e não consegue continuar como Quitação.

---

### User Story 3 - Quitar na outra moeda, com conversão pela cotação (Priority: P2)

Bruno deve R$ 100,00 a Ana, mas quer pagar com bitcoin. Ele escolhe uma carteira de bitcoin dele e
uma carteira de bitcoin de Ana, escolhe Quitação e indica que está quitando a dívida em real. O
Finami usa a cotação atual: com ₿ 1 = R$ 500.000,00, quitar tudo são ₿ 0,00020000. A confirmação
mostra o valor em bitcoin enviado, o valor em reais abatido da dívida e a cotação. Ao confirmar, o
bitcoin sai da carteira de Bruno, entra na de Ana, e a dívida em real cai pelo valor convertido.
O mesmo vale ao contrário: uma dívida em bitcoin pode ser quitada com real.

**Why this priority**: amplia a quitação, mas a quitação na mesma moeda (US2) já resolve o caso
principal.

**Independent Test**: com uma dívida de R$ 100,00, quitar parte com bitcoin e conferir que a dívida
em real caiu exatamente o valor em reais mostrado na confirmação, pela cotação mostrada.

**Acceptance Scenarios**:

1. **Given** Bruno deve R$ 100,00 a Ana e a cotação é ₿ 1 = R$ 500.000,00, **When** quita com
   bitcoin a dívida em real e escolhe "Quitar tudo", **Then** a confirmação mostra ₿ 0,00020000
   enviados, R$ 100,00 abatidos e a cotação; ao confirmar, a dívida em real some.
2. **Given** a mesma dívida e cotação, **When** Bruno quita com ₿ 0,00010000, **Then** a dívida em
   real cai R$ 50,00 e passa a R$ 50,00.
3. **Given** Bruno deve ₿ 0,00100000 a Ana, **When** quita essa dívida com real (carteira em real
   dele para carteira em real de Ana), **Then** a confirmação mostra o valor em reais enviado, o
   valor em bitcoin abatido e a cotação, e a dívida em bitcoin cai por esse valor.
4. **Given** a cotação está indisponível, **When** Bruno tenta quitar na outra moeda, **Then** vê o
   aviso de cotação indisponível e pode quitar só na moeda da dívida.
5. **Given** uma quitação na outra moeda já registrada, **When** a cotação muda depois, **Then** o
   valor abatido da dívida não muda (vale a cotação do momento da quitação).

---

### User Story 4 - Ver empréstimos e quitações nas dívidas (Priority: P3)

Na seção Dívidas (Home e página da pessoa), cada dívida continua mostrando quem deve a quem e
quanto, por moeda. Pagamentos não aparecem nela. O assistente conectado por MCP também registra
transferências com tipo e consulta as dívidas com a nova regra.

**Why this priority**: a exibição das dívidas já existe (feature 006); aqui só muda a regra de
cálculo e o registro pelo assistente.

**Independent Test**: registrar um empréstimo, um pagamento e uma quitação entre duas pessoas e
conferir que a dívida mostrada (no app e pelo assistente) é empréstimos menos quitações.

**Acceptance Scenarios**:

1. **Given** Ana emprestou R$ 100,00 a Bruno, pagou R$ 50,00 a ele e Bruno quitou R$ 30,00,
   **When** alguém vê as dívidas de Bruno, **Then** aparece "deve R$ 70,00 a Ana".
2. **Given** o assistente conectado como Ana, **When** registra uma transferência para Bruno
   informando o tipo Pagamento, **Then** nenhuma dívida é criada.
3. **Given** o assistente consulta as dívidas de Ana, **When** a resposta chega, **Then** os valores
   batem com os da página de Ana.

---

### Edge Cases

- **Estorno**: estornar um empréstimo desfaz a dívida criada por ele; estornar uma quitação devolve
  à dívida o valor que ela abateu (na moeda da dívida, pelo valor registrado na quitação, sem nova
  cotação); estornar um pagamento não mexe em dívidas. Se o estorno de um empréstimo já quitado
  em parte deixar o saldo no sentido contrário, a dívida passa a ser do credor com o devedor.
- **Empréstimos nos dois sentidos**: Ana empresta R$ 100,00 a Bruno e Bruno empresta R$ 30,00 a Ana
  → a dívida mostrada é "Bruno deve R$ 70,00 a Ana" (compensação, como na feature 006).
- **Quitação maior que a dívida**: recusada (ver FR-009); na outra moeda, a comparação é feita
  depois da conversão.
- **Quitar tudo na outra moeda**: o valor enviado é arredondado para cima até a menor unidade da
  moeda do pagamento (centavo ou satoshi), para zerar a dívida; o abatimento nunca passa do saldo
  da dívida.
- **Valor convertido que vira zero** (ex.: R$ 0,0001 em bitcoin): recusado com "Valor pequeno demais
  para conversão.".
- **Dívidas nas duas moedas** entre as mesmas pessoas: ao escolher Quitação, a pessoa indica qual
  dívida está quitando (em real ou em bitcoin); a sugestão inicial é a dívida na moeda das carteiras
  escolhidas, se existir.
- **Pessoas que saíram da família**: a dívida continua aparecendo; novas transferências entre elas
  (de qualquer tipo) seguem a regra da feature 006 e são recusadas sem família em comum.
- **Responsável lançando por um dependente**: o tipo e a dívida valem para os titulares das
  carteiras, não para quem faz o lançamento (como na feature 006).
- **Transferências anteriores a esta feature**: ver FR-016.

## Requirements *(mandatory)*

### Functional Requirements

**Tipo da transferência**

- **FR-001**: Toda transferência entre carteiras de titulares diferentes MUST ter um tipo:
  **Empréstimo**, **Quitação** ou **Pagamento**.
- **FR-002**: Transferências entre carteiras do mesmo titular (inclusive conversões real ↔
  bitcoin) MUST NOT ter tipo e MUST NOT afetar dívidas.
- **FR-003**: No app, a escolha do tipo MUST aparecer apenas quando o destino é de outro titular, e
  MUST ser obrigatória (sem tipo pré-selecionado) para continuar.
- **FR-004**: O tipo MUST aparecer no extrato, no detalhe da transferência, na confirmação e na
  mensagem de sucesso.
- **FR-005**: As regras de transferência da feature 006 (só dentro da família; conversão só entre
  carteiras do mesmo titular) MUST continuar valendo para os três tipos.

**Dívidas**

- **FR-006**: Um **Empréstimo** MUST aumentar a dívida do titular do destino com o titular da
  origem, na moeda da transferência.
- **FR-007**: Um **Pagamento** MUST NOT afetar dívidas.
- **FR-008**: Uma **Quitação** MUST reduzir a dívida do titular da origem com o titular do destino
  na moeda da dívida escolhida, pelo valor quitado (convertido, se a moeda do pagamento for outra).
- **FR-009**: Uma Quitação MUST ser recusada quando o titular da origem não deve nada ao titular do
  destino na moeda escolhida ("Você não tem dívida com [nome] nesta moeda.") ou quando o valor
  abatido passaria do saldo da dívida ("O valor é maior que a dívida ([valor]).").
- **FR-010**: A dívida entre duas pessoas, por moeda, MUST ser: empréstimos de A para B − empréstimos
  de B para A − quitações de B para A + quitações de A para B, desconsiderando transferências
  estornadas. O sinal indica quem deve a quem.
- **FR-011**: A quitação MUST ser aplicada sobre o saldo total da dívida entre as duas pessoas
  naquela moeda (um saldo por par de pessoas e moeda, como hoje); empréstimos individuais não têm
  saldo próprio.
- **FR-012**: O estorno de uma transferência MUST desfazer o efeito dela nas dívidas (ver Edge
  Cases).

**Quitação em outra moeda**

- **FR-013**: Uma dívida em real MUST poder ser quitada com bitcoin (carteira de bitcoin do devedor
  para carteira de bitcoin do credor), e uma dívida em bitcoin MUST poder ser quitada com real
  (carteira em real do devedor para carteira em real do credor).
- **FR-014**: Na quitação em outra moeda, o sistema MUST converter o valor pela cotação atual,
  mostrar antes da confirmação o valor enviado (moeda do pagamento), o valor abatido (moeda da
  dívida) e a cotação, e registrar a cotação usada junto com a transferência. O valor abatido fica
  fixo, mesmo que a cotação mude depois.
- **FR-015**: A conversão MUST usar a precisão de cada moeda (2 casas para real, 8 para bitcoin).
  Na opção "Quitar tudo", o valor enviado MUST ser o menor valor na moeda do pagamento que zera a
  dívida; nos demais casos, o abatimento é truncado na precisão da moeda da dívida.

**Dados existentes e canais**

- **FR-016**: Transferências entre titulares diferentes registradas antes desta feature MUST ser
  tratadas como **Empréstimo**, de modo que as dívidas mostradas hoje não mudem.
- **FR-017**: O tipo e as regras de quitação MUST valer em todos os canais (app, API e assistente
  MCP), inclusive na pré-visualização da transferência.
- **FR-018**: Pelo assistente MCP, a pessoa MUST conseguir informar o tipo ao registrar uma
  transferência para outra pessoa, e o assistente MUST explicar os três tipos.
- **FR-019**: A tela de transferência MUST manter o comportamento atual dos campos De e Para, do
  alternador Bitcoin | Satoshis | Reais e da pré-visualização; o tipo é uma escolha adicional.

### Key Entities

- **Transferência** (existente): passa a ter um **tipo** (Empréstimo, Quitação, Pagamento) quando os
  titulares são diferentes. Uma Quitação também guarda a **moeda da dívida** quitada, o **valor
  abatido** nessa moeda e, quando as moedas diferem, a **cotação** usada.
- **Dívida entre pessoas** (derivada, existente): saldo líquido por par de pessoas e moeda, agora
  calculado a partir de empréstimos e quitações (FR-010), não mais de toda transferência.
- **Cotação** (existente): preço do bitcoin em reais no momento da quitação em outra moeda.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos casos de teste, a dívida mostrada entre duas pessoas é igual à soma dos
  empréstimos menos as quitações (descontados estornos), por moeda; pagamentos não alteram o valor.
- **SC-002**: Após a entrada da feature, as dívidas mostradas para dados já existentes são as mesmas
  de antes (0 diferenças).
- **SC-003**: Uma pessoa registra a quitação total de uma dívida em até 4 toques a partir do botão
  Transferir, sem digitar o valor.
- **SC-004**: Em quitações em outra moeda, o valor abatido registrado é igual ao mostrado na
  confirmação em 100% dos casos, e "Quitar tudo" deixa a dívida exatamente zerada.
- **SC-005**: 0 quitações registradas acima do saldo da dívida ou sem dívida, por qualquer canal.

## Assumptions

- A escolha do tipo só existe em transferências; depósitos e saques não mudam.
- Para clientes da API que não informarem o tipo numa transferência entre titulares diferentes, o
  tipo assumido é Empréstimo (comportamento atual), para não quebrar integrações existentes; o app
  sempre informa o tipo.
- Na quitação em outra moeda, o dinheiro sempre se move entre carteiras da mesma moeda (regra da
  feature 006: conversão entre pessoas diferentes continua proibida); a conversão é só do valor
  abatido da dívida.
- A cotação é a mesma usada hoje nas conversões e na transferência em reais.
- Não há juros, prazos ou vencimentos nos empréstimos.
- A seção Dívidas (Home e página da pessoa) continua com o mesmo formato da feature 006.
