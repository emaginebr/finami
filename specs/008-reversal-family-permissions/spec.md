# Feature Specification: Estorno e permissões dos membros na família

**Feature Branch**: `008-reversal-family-permissions`
**Created**: 2026-11-03
**Status**: Draft
**Input**: User description: "Criar estorno: deve criar estorno para todos os tipos de transação; sempre deve ficar o registro da transação original e do estorno. Crie permissões que o responsável pela família [concede]: apenas o responsável pode adicionar membros naquela família; permissão de criar transações (se não tiver essa é apenas leitura naquela família); permissão de estorno."

## Contexto

O Finami já registra estornos (feature 001): o estorno é um lançamento novo, no sentido contrário,
ligado ao original, e nada é apagado. Hoje, porém:

- **quem pode estornar** é qualquer pessoa que controla a carteira (o titular ou o responsável pela
  família), sem que o responsável possa restringir isso;
- **todo membro** de uma família pode lançar receitas, despesas e transferências nas carteiras dele
  naquela família, sem que o responsável possa deixá-lo só olhando;
- a regra "só o responsável adiciona membros" existe, mas não está escrita como permissão da família.

Esta feature consolida o estorno para **todos os tipos de lançamento** (receita, despesa,
transferência entre carteiras da mesma pessoa, transferência entre pessoas — empréstimo, quitação e
pagamento —, compra e venda de bitcoin), sempre preservando o original e o estorno, e cria
**permissões por membro, por família**, que o responsável concede ou retira:

- **Criar lançamentos**: sem ela, o membro só consulta aquela família (somente leitura).
- **Estornar**: sem ela, o membro não estorna lançamentos naquela família.

Termos:

- **Família**: o grupo familiar (feature 003). Toda família tem um único **responsável**.
- **Membro**: pessoa da família que não é o responsável.
- **Carteira da família**: carteira vinculada àquela família.
- **Lançamento**: qualquer transação registrada (receita, despesa, transferência, compra ou venda
  de bitcoin, estorno).

## Clarifications

### Session 2026-11-03

- Q: Com a permissão "Estornar", o membro estorna só lançamentos das carteiras dele ou qualquer
  lançamento das carteiras da família? → A: Qualquer lançamento das carteiras da família (FR-012).
- Q: Com que permissões os membros começam (atuais e novos)? → A: Só "Criar lançamentos" ligada;
  "Estornar" desligada até o responsável liberar (FR-014).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Estornar qualquer tipo de lançamento, mantendo o histórico (Priority: P1)

Bruno lançou por engano uma despesa de R$ 80,00. Ele abre o lançamento no extrato e toca em
**Estornar**. O Finami mostra o que vai acontecer (o valor volta para a carteira) e, ao confirmar,
registra um estorno. No extrato aparecem os dois: a despesa original, marcada como estornada, e o
estorno, ligado a ela. O saldo volta ao que era antes da despesa.

O mesmo vale para receitas, transferências (inclusive empréstimos, quitações e pagamentos entre
pessoas) e compras ou vendas de bitcoin.

**Why this priority**: corrigir erros sem apagar nada é a base da confiança no histórico financeiro
da família; sem isso, as permissões de estorno não têm o que controlar.

**Independent Test**: registrar um lançamento de cada tipo, estornar cada um e conferir que o saldo
e as dívidas voltam ao valor anterior e que o extrato mostra original e estorno.

**Acceptance Scenarios**:

1. **Given** uma despesa de R$ 80,00 na carteira de Bruno, **When** Bruno a estorna, **Then** a
   carteira volta a ter os R$ 80,00, a despesa aparece como "Estornado" e o estorno aparece ligado
   a ela.
2. **Given** um empréstimo de R$ 100,00 de Ana para Bruno, **When** é estornado, **Then** o dinheiro
   volta para Ana e a dívida de Bruno com Ana diminui R$ 100,00.
3. **Given** uma compra de bitcoin (R$ 500,00 por ₿ 0,00100000), **When** é estornada, **Then** a
   carteira em real recebe R$ 500,00 de volta e a de bitcoin perde ₿ 0,00100000, nos valores
   originais, sem usar a cotação atual.
4. **Given** um lançamento já estornado, **When** alguém tenta estorná-lo de novo, **Then** o Finami
   recusa com "Esta transação já foi estornada.".
5. **Given** um estorno, **When** alguém tenta estorná-lo, **Then** o Finami recusa com "Um estorno
   não pode ser estornado.".
6. **Given** qualquer lançamento estornado, **When** se consulta o histórico, **Then** o original e
   o estorno continuam existindo, com seus valores e datas, e nenhum dos dois pode ser apagado ou
   editado.

---

### User Story 2 - Responsável define quem pode lançar na família (Priority: P1)

Ana é responsável pela família "Silva". Caio, filho dela, é membro e tem carteiras na família. Ana
abre a página da família, entra no membro Caio e desliga **Criar lançamentos**. A partir daí Caio
continua vendo as carteiras e o extrato que já via, mas não consegue lançar receitas, despesas nem
transferências nas carteiras daquela família. Quando Ana religa, Caio volta a lançar.

**Why this priority**: é o pedido central de controle do responsável: poder deixar um membro só
olhando.

**Independent Test**: desligar a permissão de um membro, tentar lançar como ele (app, API e
assistente MCP) e ver a recusa; religar e ver o lançamento funcionar.

**Acceptance Scenarios**:

1. **Given** Caio sem "Criar lançamentos" na família Silva, **When** abre Receita, Despesa ou
   Transferir, **Then** as carteiras da família Silva não aparecem como origem e, se não houver outra
   carteira disponível, o app explica "Você só pode consultar a família Silva."
2. **Given** Caio sem a permissão, **When** tenta lançar numa carteira da família Silva por outro
   caminho (API ou assistente), **Then** é recusado com "Você não tem permissão para criar
   lançamentos na família Silva.".
3. **Given** Caio sem a permissão, **When** abre a Home, as carteiras e o extrato, **Then** continua
   vendo tudo o que via antes (a permissão não muda o que ele pode consultar).
4. **Given** Caio sem a permissão, **When** Ana transfere dinheiro para uma carteira de Caio,
   **Then** a transferência é registrada normalmente (receber não depende da permissão de Caio).
5. **Given** Ana religou a permissão, **When** Caio lança uma despesa, **Then** o lançamento é
   registrado.
6. **Given** Caio tem uma carteira pessoal fora de qualquer família, **When** está sem a permissão
   na família Silva, **Then** continua lançando normalmente na carteira pessoal.

---

### User Story 3 - Responsável define quem pode estornar (Priority: P2)

Ana quer que só ela desfaça lançamentos. Ela desliga **Estornar** para Bruno. Bruno continua
lançando, mas o botão Estornar não aparece para ele nos lançamentos da família Silva. Ana continua
podendo estornar qualquer lançamento das carteiras da família.

**Why this priority**: protege o histórico de estornos indevidos; depende do estorno (US1) e
complementa a permissão de lançar.

**Independent Test**: desligar "Estornar" de um membro e conferir que ele não consegue estornar por
nenhum caminho; religar e estornar com sucesso.

**Acceptance Scenarios**:

1. **Given** Bruno sem "Estornar", **When** abre um lançamento de uma carteira dele na família
   Silva, **Then** não vê a ação Estornar.
2. **Given** Bruno sem "Estornar", **When** tenta estornar pela API ou pelo assistente, **Then** é
   recusado com "Você não tem permissão para estornar lançamentos na família Silva.".
3. **Given** Bruno com "Estornar", **When** estorna um lançamento de qualquer carteira da família
   Silva (dele, de Caio ou de Ana), **Then** o estorno é registrado, com Bruno como autor.
4. **Given** qualquer configuração de permissões, **When** Ana (responsável) estorna um lançamento
   de carteira da família, **Then** o estorno é registrado.
5. **Given** um membro que já existia antes da feature, **When** a feature entra, **Then** ele
   continua lançando, mas não estorna até Ana ligar "Estornar".

---

### User Story 4 - Só o responsável adiciona membros (Priority: P2)

Bruno, membro da família Silva, abre a página da família. Ele vê os membros, mas não vê as ações de
adicionar, convidar ou remover membros, nem as permissões. Só Ana, a responsável, adiciona membros
(por convite ou criando um membro dependente), remove membros e muda permissões.

**Why this priority**: já é a regra atual; a feature a explicita e a estende às permissões novas.

**Independent Test**: entrar como membro e tentar adicionar, convidar, remover ou mudar permissões
pelo app, pela API e pelo assistente; tudo é recusado.

**Acceptance Scenarios**:

1. **Given** Bruno é membro, **When** abre a família, **Then** não vê "Adicionar membro",
   "Convidar", "Remover" nem os controles de permissão.
2. **Given** Bruno é membro, **When** tenta adicionar ou convidar alguém pela API ou pelo
   assistente, **Then** é recusado com "Apenas o responsável pelo grupo pode realizar esta
   operação.".
3. **Given** Bruno é membro, **When** tenta mudar a própria permissão ou a de outro membro, **Then**
   é recusado com a mesma mensagem.
4. **Given** Ana é responsável, **When** abre a família, **Then** vê, para cada membro, as
   permissões "Criar lançamentos" e "Estornar" e pode ligar ou desligar cada uma.

---

### User Story 5 - Membro sabe o que pode fazer (Priority: P3)

Caio abre a página da família e vê, junto ao próprio nome, o que pode fazer: "Somente leitura" ou
"Pode lançar · Pode estornar". Ao perder uma permissão, ele recebe uma notificação no Finami.

**Why this priority**: evita confusão quando um botão some; não bloqueia o uso.

**Independent Test**: mudar a permissão de um membro e conferir a notificação e o resumo na página
da família.

**Acceptance Scenarios**:

1. **Given** Ana mudou as permissões de Caio, **When** Caio abre as notificações, **Then** vê
   "Ana mudou suas permissões na família Silva: …" com o estado novo.
2. **Given** Caio sem nenhuma permissão, **When** abre a família, **Then** vê "Somente leitura"
   junto ao nome dele.

---

### Edge Cases

- **Membro em várias famílias**: as permissões valem por família. Caio pode lançar na família
  Silva e ser somente leitura na família Souza.
- **Transferência entre famílias**: para lançar, quem envia precisa da permissão de criar
  lançamentos na família da carteira de origem. A carteira de destino não exige permissão de quem
  recebe.
- **Estorno de transferência entre pessoas**: o estorno movimenta as duas carteiras. Pode estornar
  quem tem "Estornar" (ou é o responsável) na família de pelo menos uma das carteiras envolvidas.
- **Estorno feito por outro membro**: quando um membro estorna um lançamento de carteira de outra
  pessoa, o titular dessa carteira recebe uma notificação no Finami ("Bruno estornou …").
- **Permissão retirada no meio de um lançamento**: se a permissão é retirada enquanto o membro está
  no formulário, o envio é recusado com a mensagem de permissão e nada é gravado.
- **Responsável**: sempre tem todas as permissões na própria família; elas não aparecem como
  editáveis para ele.
- **Membro dependente** (criado pelo responsável, sem login próprio): os lançamentos dele são feitos
  pelo responsável, que tem todas as permissões. As permissões do dependente existem, mas só valem
  se um dia ele passar a entrar no Finami.
- **Membro removido e readicionado**: volta com as permissões padrão de membro novo.
- **Estorno sem internet**: continua exigindo conexão, como hoje (feature 005).
- **Carteira sem família** (pessoal): as permissões não se aplicam; o titular lança e estorna
  normalmente.
- **Dívidas**: estornar um empréstimo ou quitação desfaz o efeito na dívida exatamente (feature
  007), sem nova cotação.

## Requirements *(mandatory)*

### Functional Requirements

**Estorno**

- **FR-001**: O sistema MUST permitir estornar lançamentos de todos os tipos: receita, despesa,
  transferência entre carteiras da mesma pessoa, transferência entre pessoas (empréstimo, quitação,
  pagamento) e compra ou venda de bitcoin.
- **FR-002**: O estorno MUST ser um lançamento novo, ligado ao original, que inverte exatamente os
  valores do original (inclusive o efeito na dívida e os valores convertidos), sem usar a cotação
  atual.
- **FR-003**: O sistema MUST manter sempre o registro do original e do estorno; nenhum dos dois pode
  ser apagado ou editado por nenhum caminho (app, API, assistente).
- **FR-004**: O sistema MUST recusar estornar um lançamento já estornado ("Esta transação já foi
  estornada.") e estornar um estorno ("Um estorno não pode ser estornado."), inclusive com pedidos
  simultâneos.
- **FR-005**: O extrato e o detalhe do lançamento MUST mostrar o original marcado como estornado,
  com ligação para o estorno, e o estorno com ligação para o original.
- **FR-006**: Antes de estornar, o app MUST pedir confirmação mostrando o efeito do estorno
  (valores que voltam a cada carteira e, quando houver, o efeito na dívida).

**Permissões na família**

- **FR-007**: Cada membro MUST ter, em cada família, duas permissões independentes: **Criar
  lançamentos** e **Estornar**.
- **FR-008**: Somente o responsável pela família MUST poder adicionar membros (convite ou membro
  dependente), remover membros e mudar permissões; qualquer outra pessoa é recusada.
- **FR-009**: O responsável MUST ter sempre todas as permissões na própria família.
- **FR-010**: Sem **Criar lançamentos**, o membro MUST ser impedido de registrar receitas, despesas,
  transferências e compras ou vendas de bitcoin que tenham como origem (ou como carteira única)
  uma carteira daquela família, em todos os caminhos (app, API, assistente).
- **FR-011**: A falta de **Criar lançamentos** MUST NOT reduzir o que o membro pode consultar
  (saldos, extratos, dívidas) nem impedir que ele receba transferências.
- **FR-012**: Sem **Estornar**, o membro MUST ser impedido de estornar lançamentos de carteiras
  daquela família, em todos os caminhos. Com a permissão, ele estorna qualquer lançamento das
  carteiras da família, inclusive de outros membros; o estorno registra quem o fez, e o titular da
  carteira afetada é notificado quando o autor é outra pessoa.
- **FR-013**: O responsável MUST poder estornar qualquer lançamento das carteiras da família.
- **FR-014**: Membros que já estão nas famílias quando a feature entrar e membros novos MUST
  começar com **Criar lançamentos ligada** e **Estornar desligada**.
- **FR-015**: O app MUST esconder as ações que o membro não pode usar (carteiras de origem sem
  permissão, botão Estornar) e explicar o motivo quando a tela ficaria vazia.
- **FR-016**: A página da família MUST mostrar ao responsável as permissões de cada membro, com
  controles para ligar e desligar, e mostrar a cada membro um resumo das próprias permissões.
- **FR-017**: Ao mudar as permissões de um membro, o sistema MUST notificar o membro no Finami.
- **FR-018**: As permissões MUST ser verificadas no momento do registro, valendo imediatamente
  após a mudança (sem esperar novo login).
- **FR-019**: O assistente (MCP) MUST respeitar as mesmas permissões e oferecer ao responsável a
  consulta e a mudança das permissões dos membros.
- **FR-020**: Toda mudança de permissão MUST ficar registrada com quem mudou, quando, e o estado
  antes e depois.

### Key Entities

- **Lançamento**: transação registrada; tem tipo, carteiras de origem e destino, valores, data e
  quem registrou. Pode estar estornado (ligado a um estorno).
- **Estorno**: lançamento que desfaz exatamente outro; ligado a um único original; não pode ser
  estornado.
- **Permissão do membro na família**: para um membro e uma família, se pode criar lançamentos e se
  pode estornar; quem mudou por último e quando.
- **Registro de mudança de permissão**: histórico das mudanças (quem, quando, antes, depois).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos tipos de lançamento podem ser estornados, e após o estorno saldos e dívidas
  voltam exatamente aos valores anteriores ao lançamento original.
- **SC-002**: Em nenhum caso um lançamento ou estorno some do histórico; a contagem de lançamentos
  só aumenta.
- **SC-003**: Um membro sem "Criar lançamentos" não consegue registrar nenhum lançamento em
  carteiras da família por nenhum caminho (app, API, assistente) — 0 lançamentos aceitos nos
  testes de recusa.
- **SC-004**: Um membro sem "Estornar" não consegue estornar nenhum lançamento da família por
  nenhum caminho.
- **SC-005**: O responsável muda uma permissão em menos de 30 segundos a partir da página da
  família, e a mudança vale no próximo envio do membro.
- **SC-006**: Após a entrada da feature, nenhum membro perde acesso de consulta nem a possibilidade
  de lançar que tinha antes; só o estorno passa a depender da liberação do responsável.

## Assumptions

- O estorno continua com as regras atuais (feature 001/007): mesmo valor do original, sem nova
  cotação, um estorno por lançamento, estorno não estornável. A feature completa o que faltar para
  todos os tipos e no app (confirmação, ligação nos dois sentidos).
- "Apenas leitura naquela família" significa que o membro não registra lançamentos com origem nas
  carteiras daquela família; consultas não mudam.
- A permissão vale para quem **inicia** o lançamento; receber uma transferência nunca depende de
  permissão.
- **Mudança de comportamento aceita**: membros que hoje estornam lançamentos das próprias carteiras
  deixam de poder estornar até o responsável ligar "Estornar" (Q2). O responsável não é afetado.
- Carteiras pessoais (sem família) não são afetadas: o titular estorna nelas como hoje.
- Criar e gerenciar carteiras não faz parte destas permissões (continua como hoje).
- Não há outros papéis além de responsável e membro; não há transferência de responsabilidade nesta
  feature.
- O idioma da interface é o português do Brasil, e as telas seguem WCAG 2.1 AA.
