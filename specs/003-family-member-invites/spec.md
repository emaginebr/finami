# Feature Specification: Inclusão de membros na família com convites e notificações

**Feature Branch**: `003-family-member-invites`
**Created**: 2026-11-01
**Status**: Draft
**Input**: User description: "Na tela de família, não encontrei uma forma de incluir um novo usuário. Tem que incluir: eu devo poder digitar os dados do usuário, primeiro o email; se o email dele já existir, não deve deixar cadastrar dois emails iguais; eu posso criar usuários sem email ou posso convidar usuários existentes pelo email; se eu convidar, o usuário convidado deve aceitar o convite; deve incluir uma nova área de notificações, onde o usuário pode aceitar o convite; o convite vem para uma família/grupo."

> Contexto: hoje a inclusão de membros fica escondida dentro de "Gerenciar família" e um usuário
> já cadastrado entra na família imediatamente, sem consentimento. Esta feature torna a inclusão
> visível, separa **criar uma pessoa nova** de **convidar uma pessoa existente** e exige o aceite
> do convidado. Na interface, "família" e "grupo" são a mesma coisa.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adicionar membro começando pelo email (Priority: P1)

Na tela da família, o responsável vê um botão "Adicionar membro" bem visível. Ao tocá-lo, o
primeiro campo é o **email**. Ao continuar, o app verifica o email:

- **Email não cadastrado**: o responsável completa nome e sobrenome e a pessoa é cadastrada com
  esse email e já entra na família.
- **Email já cadastrado**: o app mostra o nome da pessoa encontrada e oferece **"Convidar para a
  família"** — nunca permite cadastrar uma segunda pessoa com o mesmo email.
- **Sem email**: um atalho "Adicionar sem email" leva direto a nome e sobrenome (ex.: uma criança),
  e a pessoa entra na família na hora.

**Why this priority**: É o problema relatado: hoje não se encontra como incluir alguém, e a regra
de email único precisa ser visível no fluxo.

**Independent Test**: Como responsável da família "Silva", tocar em "Adicionar membro", informar
um email novo com nome "Pedro Silva" e ver Pedro na lista de membros; repetir com o mesmo email e
ver que o app oferece convite em vez de cadastro.

**Acceptance Scenarios**:

1. **Given** o responsável na tela da família, **When** a tela abre, **Then** o botão "Adicionar membro" aparece na própria tela, sem precisar abrir outro menu.
2. **Given** um membro que não é o responsável, **When** abre a tela da família, **Then** o botão "Adicionar membro" não aparece.
3. **Given** o fluxo de adicionar, **When** o responsável informa `pedro@exemplo.com` (não cadastrado) e depois nome e sobrenome, **Then** Pedro é cadastrado com esse email, entra na família e aparece na lista de membros.
4. **Given** o fluxo de adicionar, **When** o responsável informa um email já usado por outra pessoa, **Then** o app mostra "Esse email já pertence a Ana Souza" e oferece apenas "Convidar para a família" — não há como cadastrar outra pessoa com o mesmo email.
5. **Given** o fluxo de adicionar, **When** o responsável escolhe "Adicionar sem email" e informa nome e sobrenome, **Then** a pessoa é cadastrada sem email e entra na família.
6. **Given** um email digitado com letras maiúsculas ou espaços (ex.: ` Ana@Exemplo.com `), **When** o app verifica, **Then** ele é tratado como o mesmo email `ana@exemplo.com`.
7. **Given** um email com formato inválido, **When** o responsável tenta continuar, **Then** o app mostra o erro no campo e não avança.
8. **Given** o email de alguém que já é membro da família, **When** o responsável informa esse email, **Then** o app avisa "já é membro desta família" e não oferece convite.

---

### User Story 2 - Convidar pessoa existente e aceitar o convite (Priority: P1)

Quando o email já pertence a alguém, o responsável envia um convite para a família. A pessoa
convidada **só entra na família depois de aceitar**. O convite aparece para ela na área de
notificações, com o nome da família e quem convidou, e ela pode **aceitar** ou **recusar**.
Enquanto o convite está pendente, a tela da família mostra o convidado numa seção "Convites
pendentes", e o responsável pode cancelar o convite.

**Why this priority**: Incluir alguém que já tem conta sem o consentimento dele exporia os dados
financeiros dessa pessoa ao responsável da família; o aceite é obrigatório.

**Independent Test**: Ana (responsável) convida o email de Bruno, que já tem conta; Bruno entra no
app, abre as notificações, aceita e passa a ver a família "Silva"; na tela da família de Ana, Bruno
sai de "Convites pendentes" e aparece em "Membros".

**Acceptance Scenarios**:

1. **Given** o email de uma pessoa cadastrada que não é membro, **When** o responsável toca em "Convidar para a família", **Then** um convite pendente é criado e a pessoa aparece em "Convites pendentes" na tela da família, com a data do convite.
2. **Given** um convite pendente, **When** o convidado ainda não aceitou, **Then** ele não aparece como membro, não vê os dados da família e suas carteiras não podem ser ligadas a ela.
3. **Given** um convite pendente para a mesma pessoa e a mesma família, **When** o responsável tenta convidar de novo, **Then** o app avisa que já existe um convite pendente e não cria outro.
4. **Given** um convite pendente, **When** o convidado toca em "Aceitar" na área de notificações, **Then** ele passa a ser membro da família imediatamente e a família aparece nas telas dele.
5. **Given** um convite pendente, **When** o convidado toca em "Recusar", **Then** ele não entra na família, o convite sai da lista de pendentes do responsável e o responsável pode convidar de novo no futuro.
6. **Given** um convite pendente, **When** o responsável toca em "Cancelar convite" e confirma, **Then** o convite deixa de aparecer para o convidado e não pode mais ser aceito.
7. **Given** um convite que já foi aceito, recusado ou cancelado, **When** alguém tenta respondê-lo de novo, **Then** o app informa que o convite não está mais disponível.
8. **Given** a família foi excluída ou o convidante deixou de ser o responsável, **When** o convidado abre o convite, **Then** o app informa que o convite não está mais disponível.

---

### User Story 3 - Área de notificações (Priority: P2)

O app ganha uma área de **Notificações**, acessível por um ícone de sino com contador de não
lidas, visível em todas as telas principais. Nela a pessoa vê, do mais recente para o mais antigo:

- **Convite recebido** para uma família — com os botões Aceitar e Recusar enquanto pendente.
- **Convite aceito** ou **convite recusado** — avisando ao responsável a resposta do convidado.

Abrir a área marca as notificações exibidas como lidas e zera o contador.

**Why this priority**: É o lugar onde o convite é aceito (US2), mas a área é útil por si para
avisos futuros; o aceite em si já é P1.

**Independent Test**: Com um convite pendente para Bruno, ver o sino com "1" nas telas dele, abrir
as notificações, ver o convite com Aceitar/Recusar e, após abrir, ver o contador zerado.

**Acceptance Scenarios**:

1. **Given** uma pessoa com 2 notificações não lidas, **When** ela está em qualquer tela principal, **Then** vê o sino com o número 2; sem notificações não lidas, o sino aparece sem número.
2. **Given** a área de notificações aberta, **When** há um convite pendente, **Then** a notificação mostra o nome da família, quem convidou, a data e os botões Aceitar e Recusar.
3. **Given** um convite já respondido ou cancelado, **When** a pessoa vê a notificação dele, **Then** ela mostra o estado final ("Você aceitou", "Você recusou" ou "Convite cancelado") sem botões.
4. **Given** o convidado aceitou ou recusou, **When** o responsável abre as notificações, **Then** vê "Bruno Lima aceitou o convite para Família Silva" (ou "recusou").
5. **Given** notificações não lidas, **When** a pessoa abre a área de notificações, **Then** o contador do sino zera.
6. **Given** nenhuma notificação, **When** a pessoa abre a área, **Then** vê a mensagem "Nenhuma notificação por enquanto".
7. **Given** uma notificação de convite aceito, **When** o responsável toca nela, **Then** vai para a tela da família correspondente.

---

### Edge Cases

- **Email de quem só entra com Google**: conta como email cadastrado — a pessoa é convidada, não recadastrada.
- **Pessoa cadastrada pelo responsável com email** (US1-3): pode entrar no app depois com a conta Google desse email ou definir senha, como qualquer usuário com email; ela já é membro, sem convite.
- **O responsável informa o próprio email**: o app avisa que ele já é membro da família.
- **Convidado já é membro de outras famílias**: não muda nada; aceitar um convite não afeta as outras famílias.
- **Convidar alguém que saiu ou foi retirado da família**: permitido, como um convite novo.
- **Responsável retira um membro com convite pendente para outra família**: os convites de outras famílias não são afetados.
- **Dois convites para a mesma pessoa em famílias diferentes**: permitidos; cada um é aceito ou recusado separadamente.
- **Duplo toque em Aceitar/Convidar**: só um convite é criado e só uma aceitação é registrada.
- **Sessão do convidado aberta durante o convite**: o sino é atualizado ao voltar para o app ou ao trocar de tela, sem precisar sair e entrar.
- **Muitas notificações**: a área mostra as mais recentes primeiro e carrega as antigas sob demanda.

## Requirements *(mandatory)*

### Functional Requirements

**Adicionar membro**

- **FR-001**: A tela da família MUST exibir, apenas para o responsável, uma ação "Adicionar membro" visível diretamente na tela (fora de menus secundários).
- **FR-002**: O fluxo de adicionar MUST começar pelo email, com a opção alternativa "Adicionar sem email".
- **FR-003**: O sistema MUST normalizar o email (ignorar espaços nas pontas e diferenças de maiúsculas/minúsculas) antes de qualquer verificação.
- **FR-004**: O sistema MUST impedir que duas pessoas tenham o mesmo email; quando o email informado já pertencer a alguém, o fluxo MUST oferecer apenas o convite, nunca um novo cadastro.
- **FR-005**: Para email não cadastrado, o responsável MUST informar nome e sobrenome; a pessoa é cadastrada com o email e incluída na família imediatamente.
- **FR-006**: Pela opção "Adicionar sem email", o responsável MUST informar nome e sobrenome; a pessoa é cadastrada sem email e incluída na família imediatamente.
- **FR-007**: Quando o email pertencer a quem já é membro da família (inclusive o próprio responsável), o fluxo MUST informar isso e não oferecer convite.
- **FR-008**: Ao encontrar uma pessoa pelo email, o fluxo MUST mostrar apenas nome e sobrenome dela (sem outros dados).

**Convites**

- **FR-009**: Somente o responsável da família MUST poder convidar, e somente pessoas já cadastradas que não sejam membros.
- **FR-010**: O sistema MUST manter no máximo um convite pendente por pessoa e família.
- **FR-011**: Um convite MUST ter um destes estados: pendente, aceito, recusado ou cancelado; só convites pendentes podem ser respondidos ou cancelados, e cada convite é respondido uma única vez.
- **FR-012**: A pessoa convidada MUST tornar-se membro somente ao aceitar; enquanto pendente, ela não tem acesso a nada da família e suas carteiras não podem ser vinculadas a ela.
- **FR-013**: Somente a pessoa convidada MUST poder aceitar ou recusar o próprio convite.
- **FR-014**: O responsável MUST poder cancelar um convite pendente, com confirmação.
- **FR-015**: A tela da família MUST mostrar ao responsável a seção "Convites pendentes" com nome do convidado, data do convite e ação de cancelar; membros que não são o responsável não veem essa seção.
- **FR-016**: Um convite MUST deixar de poder ser aceito se a família deixar de existir ou se quem convidou deixar de ser o responsável; nesse caso, o convidado vê a informação de que o convite não está mais disponível.

**Notificações**

- **FR-017**: O app MUST ter uma área de Notificações acessível por um ícone de sino em todas as telas principais (celular e desktop), com o número de notificações não lidas quando houver.
- **FR-018**: O sistema MUST gerar uma notificação para o convidado quando um convite é criado, e uma notificação para o responsável quando o convidado aceita ou recusa.
- **FR-019**: A notificação de convite MUST mostrar o nome da família, o nome de quem convidou e a data, com as ações Aceitar e Recusar enquanto o convite estiver pendente; após a resposta ou cancelamento, MUST mostrar o estado final sem ações.
- **FR-020**: As notificações MUST ser listadas da mais recente para a mais antiga e carregadas aos poucos quando forem muitas.
- **FR-021**: Abrir a área de notificações MUST marcar como lidas as notificações exibidas.
- **FR-022**: Tocar numa notificação de convite aceito MUST levar à tela da família correspondente.
- **FR-023**: O contador de não lidas MUST ser atualizado ao trocar de tela e ao voltar para o app, sem precisar sair e entrar.
- **FR-024**: Cada pessoa MUST ver apenas as próprias notificações.

**Geral**

- **FR-025**: Todas as ações de gravar (adicionar, convidar, aceitar, recusar, cancelar) MUST impedir envio duplicado e mostrar confirmação de sucesso ou o motivo do erro em linguagem clara.
- **FR-026**: As novas telas e ações MUST seguir os padrões de acessibilidade já adotados no app (rótulos, foco por teclado, anúncio de mensagens, contraste).

### Key Entities

- **Pessoa (usuário)**: já existente; o email continua único entre todas as pessoas e é opcional.
- **Convite de família**: família, pessoa convidada, quem convidou, estado (pendente, aceito, recusado, cancelado), data de criação e data da resposta.
- **Notificação**: destinatário, tipo (convite recebido, convite aceito, convite recusado), referência ao convite e à família, data, lida ou não.
- **Família (grupo)**: já existente; ganha a lista de convites pendentes, visível apenas ao responsável.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em teste com 5 responsáveis de família, ao menos 4 encontram e concluem "Adicionar membro" sem ajuda na primeira tentativa.
- **SC-002**: Adicionar uma pessoa nova (com ou sem email) leva no máximo 3 telas/etapas a partir da tela da família.
- **SC-003**: Em 100% das tentativas, informar um email já cadastrado resulta em convite, nunca em uma segunda pessoa com o mesmo email.
- **SC-004**: Em 100% dos casos, uma pessoa convidada só aparece como membro e só vê dados da família depois de aceitar.
- **SC-005**: O convidado vê o convite (sino com contador) no máximo ao trocar de tela ou voltar ao app, sem precisar sair e entrar de novo.
- **SC-006**: Aceitar um convite leva no máximo 2 toques a partir de qualquer tela principal (sino → Aceitar).

## Assumptions

- A verificação de email no fluxo é feita por correspondência exata (após normalização), como a busca por email já existente; não há busca por nome ou por parte do email.
- Mostrar o nome da pessoa dona de um email já cadastrado é aceitável dentro do fluxo do responsável (o produto já permite buscar pessoas por email exato).
- Convites não expiram automaticamente; ficam pendentes até serem aceitos, recusados ou cancelados.
- Não há envio de email nem notificação push nesta versão: o convidado é avisado apenas dentro do app, na área de notificações.
- Pessoas cadastradas pelo responsável (com ou sem email) entram na família diretamente, sem convite, porque o cadastro é feito pelo próprio responsável.
- A pessoa cadastrada com email pelo responsável poderá entrar no app com a conta Google desse email (o vínculo por email já existe) ou depois de definir uma senha; o fluxo de recuperação/definição de senha por email está fora do escopo.
- Os tipos de notificação desta versão são apenas os ligados a convites; a área é pensada para receber outros tipos no futuro.
- A ação atual "Incluir membro por email" (que inclui a pessoa sem consentimento) é substituída pelo convite; pessoas incluídas antes desta feature continuam membros.
