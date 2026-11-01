# Feature Specification: Frontend do Finami (mobile-first)

**Feature Branch**: `002-finami-frontend-mobile`
**Created**: 2026-11-01
**Status**: Draft
**Input**: User description: "Crie o frontend em React+Vite+Tailwind, voltado para celular mas funcionando no desktop; no mobile, menu com ícones na barra inferior igual ao iPhone; apenas layout escuro, com cores da logo `docs/logos/logo.png`; logotipo com a casa da logomarca no formato de ícone iOS; botão flutuante para criar transações; primeira tela com o saldo total do usuário em real em destaque e, abaixo, todas as carteiras, primeiro por família e depois as avulsas; menus Home (saldo), Carteiras (lista de carteiras e grupos, onde se criam carteiras e famílias) e Conta (configurações); clicar em uma carteira mostra o extrato; clicar em um grupo mostra o saldo de cada membro; clicar no usuário mostra o saldo de todas as carteiras de grupos a que ele pertence."

> Esta especificação descreve a interface do Finami. As regras de negócio (saldo, conversão de bitcoin, permissões de grupo, visibilidade de extrato) já existem no backend (`specs/001-finami-backend-core`) e a interface apenas as respeita e apresenta. Os termos "família" e "grupo" são sinônimos na interface; o texto exibido ao usuário usa "Família".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar e ver o saldo total (Priority: P1)

A pessoa abre o Finami no celular, entra com email e senha ou com a conta Google (ou se cadastra) e cai na tela Home, que mostra em destaque o saldo total dela em reais. Logo abaixo aparecem todas as suas carteiras: primeiro agrupadas por família (uma seção por família, com o nome dela) e depois as carteiras avulsas, que não pertencem a nenhuma família. Cada carteira mostra nome, moeda e saldo; carteiras de bitcoin mostram também o valor estimado em reais.

**Why this priority**: É a razão de abrir o app: saber quanto dinheiro se tem. Sem login e sem essa tela nada mais funciona.

**Independent Test**: Com um usuário que já tenha carteiras em BRL e BTC, uma delas ligada a uma família, entrar no app e conferir que o total exibido é igual à soma dos saldos em reais mais o valor estimado das carteiras de bitcoin, e que a lista está separada em "família" e "avulsas".

**Acceptance Scenarios**:

1. **Given** uma pessoa cadastrada com email e senha, **When** ela informa as credenciais corretas, **Then** é levada à Home e continua logada ao reabrir o app enquanto a sessão for válida.
2. **Given** uma pessoa com conta Google, **When** escolhe "Entrar com Google" e autoriza, **Then** entra no app (e é cadastrada automaticamente se for o primeiro acesso).
3. **Given** credenciais erradas, **When** tenta entrar, **Then** vê uma mensagem clara de erro sem perder o que digitou no email.
4. **Given** carteiras de R$ 1.000,00 e R$ 500,00 e uma carteira com 0,01 BTC com cotação de R$ 500.000,00, **When** abre a Home, **Then** o total exibido é R$ 6.500,00, com destaque visual maior que qualquer outro número da tela.
5. **Given** carteiras ligadas às famílias "Silva" e "Praia" e duas carteiras avulsas, **When** abre a Home, **Then** vê a seção "Silva", depois "Praia" (ordem alfabética) e por último "Avulsas".
6. **Given** que a cotação do bitcoin está indisponível, **When** abre a Home, **Then** o total mostra apenas a parte em reais e um aviso de que as carteiras de bitcoin não entraram no total.
7. **Given** uma pessoa sem nenhuma carteira, **When** abre a Home, **Then** vê saldo R$ 0,00 e um convite para criar a primeira carteira.

---

### User Story 2 - Registrar transações pelo botão flutuante (Priority: P1)

Em qualquer tela principal há um botão flutuante "+" sempre visível. Ao tocá-lo a pessoa escolhe o tipo de lançamento — **Entrada**, **Saída** ou **Transferência** — preenche carteira(s), valor e descrição e confirma. Na transferência entre moedas diferentes (real ↔ bitcoin) o app mostra antes de confirmar quanto será comprado ou vendido e a cotação usada. Na transferência para a carteira de outra pessoa, o app mostra nome da carteira e do titular para conferência.

**Why this priority**: Registrar movimentações é o uso diário do app; sem isso o saldo nunca muda.

**Independent Test**: Tocar no "+", lançar uma entrada de R$ 100,00 em uma carteira e ver o saldo da carteira e o total da Home subirem R$ 100,00.

**Acceptance Scenarios**:

1. **Given** a Home aberta, **When** toca no botão flutuante, **Then** abre uma folha (sheet) vinda de baixo com as opções Entrada, Saída e Transferência.
2. **Given** a opção Entrada, **When** informa carteira, valor R$ 100,00 e descrição e confirma, **Then** o lançamento é registrado, a folha fecha, aparece uma confirmação e os saldos exibidos são atualizados.
3. **Given** uma Saída maior que o saldo da carteira, **When** confirma, **Then** vê a mensagem "saldo insuficiente" e nada é registrado.
4. **Given** uma Transferência de uma carteira em reais para uma de bitcoin, **When** informa o valor, **Then** vê antes de confirmar a quantidade de bitcoin que será comprada e a cotação; ao confirmar, ambos os saldos mudam.
5. **Given** uma transferência para a carteira de outra pessoa, **When** a escolhe, **Then** vê o nome da carteira e do titular e precisa confirmar antes do envio.
6. **Given** que a cotação está indisponível ou desatualizada, **When** tenta uma transferência entre moedas, **Then** vê aviso de que a conversão não pode ser feita agora e o botão de confirmar fica bloqueado.
7. **Given** um valor com casas decimais demais (mais de 2 em reais, mais de 8 em bitcoin), **When** digita, **Then** o campo não aceita ou mostra o erro antes do envio.

---

### User Story 3 - Ver o extrato de uma carteira (Priority: P2)

Ao tocar em uma carteira (na Home ou na tela Carteiras), a pessoa vê o extrato daquela carteira: saldo inicial, entradas, saídas e saldo final do período e a lista de lançamentos (data, descrição, tipo, valor com sinal, contraparte e, em compras/vendas de bitcoin, a cotação). O período padrão é o mês corrente e pode ser trocado. Quem controla a carteira pode estornar um lançamento a partir dele.

**Why this priority**: Saber de onde veio e para onde foi o dinheiro é a segunda pergunta mais comum depois do saldo.

**Independent Test**: Tocar em uma carteira com lançamentos no mês e conferir que saldo final = saldo inicial + entradas − saídas e que os lançamentos aparecem do mais recente para o mais antigo.

**Acceptance Scenarios**:

1. **Given** uma carteira com lançamentos no mês, **When** a pessoa toca nela, **Then** vê o extrato do mês corrente com totais e lista de lançamentos.
2. **Given** o extrato aberto, **When** escolhe outro período (atalhos "Este mês", "Mês passado", "Últimos 30 dias" ou datas personalizadas), **Then** o extrato é recarregado para esse período; períodos acima de 366 dias são bloqueados com aviso.
3. **Given** um lançamento ainda não estornado em carteira que a pessoa controla, **When** escolhe "Estornar" e confirma, **Then** um estorno é registrado e aparece no extrato; o original fica marcado como estornado.
4. **Given** um período sem lançamentos, **When** abre o extrato, **Then** vê os saldos inicial e final iguais e a mensagem "Nenhum lançamento no período".

---

### User Story 4 - Gerenciar carteiras e famílias (Priority: P2)

A aba **Carteiras** lista as famílias da pessoa e todas as carteiras que ela controla (separadas como na Home). Nessa tela ela cria carteiras (nome, descrição, moeda Real ou Bitcoin, se é virtual e, opcionalmente, a família) e cria famílias. Dentro de uma família da qual é responsável, ela inclui membros (buscando pelo email ou cadastrando uma pessoa sem login, como uma criança), retira membros, renomeia a família, define quem pode ver o extrato da família e cria carteiras para membros. Ela também pode editar, desativar ou excluir carteiras que controla.

**Why this priority**: Sem criar carteiras e famílias o app não tem conteúdo, mas a pessoa pode começar com uma única carteira, por isso fica depois de saldo e lançamentos.

**Independent Test**: Criar a família "Silva", cadastrar "Pedro" sem login, incluí-lo, criar a carteira "Mesada" para ele dentro da família e ver a carteira aparecer na seção "Silva".

**Acceptance Scenarios**:

1. **Given** a aba Carteiras, **When** toca em "Nova carteira" e preenche nome e moeda, **Then** a carteira é criada e aparece na lista (na família escolhida ou em "Avulsas").
2. **Given** a aba Carteiras, **When** toca em "Nova família" e informa o nome, **Then** a família é criada com a pessoa como responsável e única integrante.
3. **Given** uma família da qual é responsável, **When** inclui um membro pelo email (busca exata) ou cadastra uma pessoa sem login, **Then** o membro aparece na lista da família.
4. **Given** uma família da qual **não** é responsável, **When** abre os detalhes, **Then** não vê as ações de incluir/retirar membros, renomear ou mudar a visibilidade.
5. **Given** a retirada de um membro, **When** a pessoa confirma, **Then** o app avisa antes que as carteiras desse membro deixarão de pertencer à família.
6. **Given** uma carteira com lançamentos, **When** a pessoa tenta excluir, **Then** o app explica que não é possível e oferece desativá-la.

---

### User Story 5 - Saldo por membro da família (Priority: P3)

Ao tocar em uma família, a pessoa vê o saldo total da família e o saldo de cada membro (soma das carteiras daquele membro ligadas à família, em reais, com bitcoin convertido pela cotação). Ao tocar em um membro, ela vê o saldo de todas as carteiras desse membro em todas as famílias a que ele pertence e que ela tem permissão de ver, agrupadas por família.

**Why this priority**: É o diferencial "familiar" do app, mas depende de famílias e carteiras já existirem.

**Independent Test**: Com a família "Silva" (Ana com R$ 300,00 e Pedro com R$ 100,00 em carteiras da família), abrir a família e ver Ana R$ 300,00, Pedro R$ 100,00 e total R$ 400,00; tocar em Pedro e ver as carteiras dele.

**Acceptance Scenarios**:

1. **Given** uma família visível para a pessoa, **When** toca nela, **Then** vê o total da família e uma linha por membro com o respectivo saldo; membros sem carteira aparecem com R$ 0,00.
2. **Given** um membro na tela da família, **When** a pessoa toca nele, **Then** vê o saldo total do membro e as carteiras dele agrupadas por família, apenas das famílias que a pessoa pode ver.
3. **Given** uma família com visibilidade "Somente o responsável" e a pessoa não é a responsável, **When** toca na família, **Then** vê apenas a lista de membros, sem valores, com a explicação de que o responsável restringiu a visualização.
4. **Given** uma família com visibilidade "Membros veem só os totais", **When** um membro que não é o responsável abre a família, **Then** vê os saldos, mas ao tocar em uma carteira de outro membro não consegue abrir o extrato detalhado.
5. **Given** a tela de um membro, **When** toca em uma das carteiras dele que a pessoa pode ver em detalhe, **Then** abre o extrato da carteira (US3).

---

### User Story 6 - Configurações da conta (Priority: P3)

A aba **Conta** mostra os dados da pessoa e permite editar nome, sobrenome e email, definir ou trocar a senha, ver se a conta Google está vinculada, ver as pessoas que ela cadastrou e sair do app.

**Why this priority**: Necessária, mas usada raramente.

**Independent Test**: Alterar o sobrenome na aba Conta, sair, entrar de novo e ver o novo sobrenome.

**Acceptance Scenarios**:

1. **Given** a aba Conta, **When** a pessoa altera nome ou sobrenome e salva, **Then** a alteração aparece no app imediatamente.
2. **Given** uma pessoa que já tem senha, **When** troca a senha, **Then** precisa informar a senha atual.
3. **Given** uma pessoa que entrou só com Google, **When** define uma senha, **Then** passa a conseguir entrar também com email e senha.
4. **Given** a aba Conta, **When** toca em "Sair" e confirma, **Then** volta para a tela de entrada e os dados da sessão são removidos do aparelho.

---

### Edge Cases

- **Sessão expirada**: qualquer ação com a sessão vencida leva de volta à tela de entrada com a mensagem "Sua sessão expirou"; após entrar de novo, a pessoa volta para a tela onde estava.
- **Sem conexão / servidor fora**: telas mostram o erro com opção "Tentar novamente"; formulários não perdem o que foi digitado.
- **Toque duplo em "Confirmar"**: o botão fica bloqueado durante o envio, evitando lançamento duplicado.
- **Cotação muda entre a prévia e a confirmação**: o valor efetivo é o que o servidor registrar; a confirmação exibe o valor final efetivado.
- **Carteira desativada**: aparece apenas na aba Carteiras, esmaecida e em seção "Inativas" recolhida; não aparece na Home nem como opção de lançamento, mas seu extrato continua acessível.
- **Telas grandes (desktop)**: o conteúdo não se estica de ponta a ponta; a navegação passa a uma barra lateral e o botão flutuante continua disponível.
- **Valores longos**: saldos com muitos dígitos (ex.: R$ 1.234.567,89 ou 0,12345678 BTC) não quebram o layout em telas de 320 px de largura.
- **Área segura do iPhone**: barra inferior e botão flutuante respeitam a área do indicador de início e o entalhe.
- **Pessoa sem família**: a Home mostra só "Avulsas"; a aba Carteiras mostra um convite para criar a primeira família.
- **Carteira de outra pessoa que a pessoa controla como responsável**: aparece na seção da família com o nome do titular.

## Requirements *(mandatory)*

### Functional Requirements

**Acesso**

- **FR-001**: O app MUST permitir entrar com email e senha e com conta Google, e permitir o auto-cadastro (nome, sobrenome, email, senha).
- **FR-002**: O app MUST manter a pessoa logada entre aberturas enquanto a sessão for válida e MUST redirecionar para a tela de entrada quando ela expirar.
- **FR-003**: O app MUST impedir o acesso a qualquer tela interna sem sessão válida.

**Navegação e aparência**

- **FR-004**: Em telas de celular, o app MUST exibir uma barra de navegação fixa na parte inferior, no estilo do iOS, com três itens com ícone e rótulo: **Home**, **Carteiras** e **Conta**, destacando o item ativo.
- **FR-005**: Em telas largas (a partir de tablet/desktop), o app MUST apresentar a mesma navegação em uma barra lateral e limitar a largura do conteúdo para manter a leitura confortável.
- **FR-006**: O app MUST usar apenas tema escuro, com a paleta derivada da logo: fundo roxo profundo, verde-limão como cor de destaque (saldos positivos, ações principais) e branco para textos principais; as cores azul, rosa e amarelo das figuras da logo MAY ser usadas para diferenciar famílias/membros.
- **FR-007**: O app MUST exibir a logo do Finami na tela de entrada e no cabeçalho/barra lateral.
- **FR-008**: O projeto MUST incluir um ícone de aplicativo no formato padrão do iOS (quadrado de cantos arredondados) com a casa da logomarca, usado como ícone ao adicionar o app à tela inicial do celular e como favicon.
- **FR-009**: O app MUST exibir um botão flutuante "+" nas telas Home, Carteiras e extrato, posicionado acima da barra inferior, que abre a criação de transações.
- **FR-010**: Todo alvo de toque MUST ter pelo menos 44×44 pt e o layout MUST funcionar a partir de 320 px de largura sem rolagem horizontal.

**Home**

- **FR-011**: A Home MUST exibir em destaque o saldo total da pessoa em reais: soma dos saldos das carteiras ativas de que ela é titular em reais mais o valor estimado em reais das carteiras de bitcoin de que é titular, pela cotação atual.
- **FR-012**: Quando não houver cotação disponível, a Home MUST mostrar o total sem as carteiras de bitcoin e um aviso explicando isso.
- **FR-013**: Abaixo do saldo, a Home MUST listar as carteiras ativas que a pessoa controla, agrupadas por família (seções em ordem alfabética pelo nome da família) e, por último, a seção "Avulsas" com as carteiras sem família.
- **FR-014**: Cada carteira listada MUST mostrar nome, moeda, saldo na moeda (BRL com 2 casas, BTC com 8 casas), indicação de virtual e, para BTC, o valor estimado em reais; quando o titular não for a própria pessoa, MUST mostrar o nome do titular.
- **FR-015**: A Home MUST mostrar a cotação atual do bitcoin e o horário em que foi obtida.

**Transações**

- **FR-016**: O botão flutuante MUST oferecer Entrada (dinheiro vindo de fora), Saída (dinheiro indo para fora) e Transferência (entre carteiras).
- **FR-017**: A Transferência MUST permitir escolher como destino uma carteira que a pessoa controla ou a carteira de outra pessoa informada pelo código da carteira, exibindo nome da carteira e titular para confirmação.
- **FR-018**: Para transferências entre moedas diferentes, o app MUST exibir uma prévia com valor de origem, valor convertido e cotação antes da confirmação.
- **FR-019**: O app MUST validar no formulário valor positivo e o limite de casas decimais da moeda da origem antes de enviar.
- **FR-020**: Após registrar uma transação, o app MUST atualizar os saldos e extratos exibidos sem que a pessoa precise recarregar a página.
- **FR-021**: O app MUST permitir estornar, a partir do extrato, um lançamento não estornado de carteira que a pessoa controla, pedindo confirmação.

**Extrato**

- **FR-022**: Tocar em uma carteira MUST abrir o extrato dela, com período padrão no mês corrente e opção de mudar o período (atalhos e datas personalizadas, limite de 366 dias).
- **FR-023**: O extrato MUST mostrar saldo inicial, total de entradas, total de saídas, saldo final e a lista de lançamentos do mais recente ao mais antigo, com data/hora, descrição, tipo, valor com sinal, contraparte, cotação (quando houver conversão) e indicação de estornado.

**Carteiras e famílias**

- **FR-024**: A aba Carteiras MUST listar as famílias da pessoa (com indicação de quando ela é responsável) e as carteiras que ela controla, incluindo uma seção recolhida com as inativas.
- **FR-025**: A aba Carteiras MUST permitir criar carteira (nome, descrição, moeda, virtual, família opcional e, para o responsável, titular entre os membros da família) e criar família.
- **FR-026**: O app MUST permitir editar nome, descrição e "virtual" de uma carteira, vinculá-la ou desvinculá-la de uma família conforme as permissões, desativá-la e excluí-la (quando não houver lançamentos); a moeda nunca é editável.
- **FR-027**: Para famílias em que a pessoa é responsável, o app MUST permitir renomear, incluir membro (busca exata por email ou cadastro de pessoa sem login), retirar membro (com aviso sobre as carteiras) e escolher a visibilidade: "Somente o responsável", "Todos os membros" ou "Membros veem só os totais".
- **FR-028**: O app MUST ocultar as ações que a pessoa não tem permissão de executar, e não apenas desabilitá-las.

**Saldo por membro**

- **FR-029**: Tocar em uma família MUST mostrar o saldo total da família e o saldo de cada membro, em reais, considerando somente as carteiras ligadas àquela família e respeitando a visibilidade definida pelo responsável.
- **FR-030**: Tocar em um membro MUST mostrar o saldo total e as carteiras desse membro, agrupadas por família, em todas as famílias a que ele pertence e que a pessoa tem permissão de ver.
- **FR-031**: Quando a visibilidade não permitir ver valores ou detalhes, o app MUST explicar o motivo em vez de mostrar uma tela de erro.

**Conta**

- **FR-032**: A aba Conta MUST permitir editar nome, sobrenome e email, definir/trocar senha (exigindo a senha atual quando já existir), mostrar se a conta Google está vinculada, listar as pessoas que a pessoa cadastrou e sair.

**Geral**

- **FR-033**: Todos os valores MUST ser exibidos no formato brasileiro (R$ 1.234,56; datas dd/mm/aaaa; horário de Brasília) e todos os textos da interface em português do Brasil.
- **FR-034**: Toda ação que grava dados MUST exibir estado de carregamento, impedir envio duplicado e mostrar mensagem de sucesso ou o erro devolvido pelo servidor em linguagem clara.
- **FR-035**: O app MUST NOT guardar a sessão em cookies nem conter segredos do servidor.

### Key Entities

- **Sessão**: identidade da pessoa logada e validade do acesso; armazenada no aparelho até sair ou expirar.
- **Pessoa (usuário)**: nome, sobrenome, email, se pode entrar, se tem senha e se tem Google vinculado.
- **Família (grupo)**: nome, responsável, membros e regra de visibilidade do extrato.
- **Carteira**: nome, descrição, moeda, virtual, ativa, titular, família opcional, saldo e valor estimado em reais.
- **Lançamento (transação)**: tipo, origem, destino, valores, cotação, descrição, data e vínculo de estorno.
- **Cotação do bitcoin**: preço em reais, horário e se está desatualizada.
- **Extrato**: período, saldos inicial e final, totais e lançamentos de uma carteira, de uma pessoa ou de uma família.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa já cadastrada vê o saldo total em menos de 3 segundos após abrir o app logado em uma conexão móvel 4G.
- **SC-002**: Registrar uma entrada ou saída leva no máximo 4 toques a partir da Home, além da digitação do valor.
- **SC-003**: O total exibido na Home é igual, centavo a centavo, à soma das carteiras em reais mais o valor estimado das de bitcoin informado pelo sistema, em 100% dos casos testados.
- **SC-004**: Todas as telas funcionam sem rolagem horizontal e sem texto cortado em larguras de 320 px a 1920 px.
- **SC-005**: Em teste com 5 pessoas da família-alvo, ao menos 4 conseguem, sem ajuda, criar uma carteira, lançar uma entrada e encontrar o extrato na primeira tentativa.
- **SC-006**: Nenhuma tela mostra valores de família que a regra de visibilidade definida pelo responsável não permite ver (verificado para as três opções).
- **SC-007**: Textos e números principais têm contraste mínimo de 4,5:1 sobre o fundo escuro.

## Assumptions

- O backend da feature `001-finami-backend-core` é a fonte de todos os dados e regras; o frontend não calcula saldos de conversão por conta própria, apenas soma os valores devolvidos pelo servidor para o total da Home.
- "Saldo total do usuário" considera apenas as carteiras ativas **de que a pessoa é titular**; carteiras de outros membros que ela controla como responsável aparecem na lista (seção da família), mas não entram no total dela.
- Para o saldo por membro (US5) pode ser necessária uma nova consulta no servidor que devolva saldos agregados por membro respeitando a visibilidade "Membros veem só os totais"; isso será avaliado no planejamento.
- "Logotipo com a casa da logomarca e botão padrão iOS" foi entendido como um ícone de app no formato iOS (quadrado arredondado) com a casa e a família da logo, sem o texto "Finami".
- O app será acessado pelo navegador e poderá ser adicionado à tela inicial do celular; funcionamento offline, notificações push e loja de aplicativos estão fora do escopo.
- Gráficos, metas, orçamentos e exportação de extrato estão fora do escopo desta versão.
- O destino de transferência para carteira de outra pessoa é informado pelo código numérico da carteira, como o backend já suporta; busca de carteiras de terceiros por nome está fora do escopo.
- Apenas português do Brasil; não haverá troca de idioma nem tema claro.
- O login Google usa o mesmo cliente OAuth configurado para o backend.
