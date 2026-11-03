# Revisão de design — telas da feature 006 × especificação (T045)

Feature `006-family-debts-transfers` · direção **Noite Roxa** · referência:
[`mockups/family-debts-transfers.html`](./mockups/family-debts-transfers.html), especificação em
[`components.md` §10](./components.md), comportamento e textos em `specs/006-family-debts-transfers/contracts/ui.md`,
Princípio IX (WCAG 2.1 AA) de `.specify/memory/constitution.md`. Consumo: `frontend-react-developer` (todos os itens
são `.tsx`/`.ts`/`.json`).

## Como foi feita

- **Revisão estática** linha a linha de `components/debt/DebtList.tsx`, `components/transaction/WalletOption.tsx`,
  `AmountUnitToggle.tsx`, `FormStep.tsx`, `PreviewStep.tsx`, `sheetModel.ts` (`walletOptionLabel`),
  `components/ui/MoneyInput.tsx`, `pages/MemberPage.tsx`, `pages/TransactionPage.tsx`, `components/layout/AppShell.tsx`
  e `i18n/pt-BR.json` (chaves `debts.*` e `transaction.*` novas), mais os componentes de apoio usados por eles
  (`Avatar`, `Skeleton`, `Banner`, `RetryBanner`, `Button`, `listRow`, `utils/money.ts`).
- **No app de homolog** (`http://localhost:8080`, API `:5145`), com Chrome headless via DevTools Protocol:
  - dados criados pela API: Ana (responsável) com Bruno e Maximiliano na família, carteiras em real e bitcoin,
    dívidas nos dois sentidos e nas duas moedas; Carla sozinha, com uma carteira (caso "sem destinos");
  - telas em 390 px, 320 px e zoom 200 % (195 px CSS); navegação real (clique nas linhas, teclado no alternador,
    `ArrowDown` no seletor), foco medido com `document.activeElement` a cada passo, nomes acessíveis lidos da
    árvore de acessibilidade do Chrome (`Accessibility.getFullAXTree`), rede lenta emulada (2,5 s de latência);
  - **axe-core** (regras WCAG 2.0/2.1 A e AA) em: página da pessoa, formulário, seletor De, seletor Para,
    formulário em "Reais", prévia e "sem destinos".
- Não verificado no navegador: a resposta 503 da cotação (o fluxo "Informar em bitcoin" foi conferido só pelo
  código: `TransactionPage.tsx:402-409` + `FormStep.tsx:251`, correto) e o estado offline sem cache dos destinos.
- **Contraste**: nenhum token novo; as combinações usadas são as da tabela do §10 (todas ≥ 4,5:1 para texto e
  ≥ 3:1 para bordas/ícones). Anel de foco medido no alternador: `outline solid rgb(92 200 255)` (token `focus`).

Severidade: **bloqueante** = falha WCAG 2.1 AA ou informação errada no fluxo principal da feature — corrigir antes
do merge; **importante** = falha de acessibilidade em fluxo secundário ou divergência visível da especificação;
**menor** = acabamento.

**Resultado: 2 bloqueantes, 3 importantes, 4 menores.**

---

## 1. Resumo — o que está fiel

| Área | Verificado |
|---|---|
| Seção "Dívidas" | `<section aria-labelledby>` + `<h2>` com a tipografia do cabeçalho das famílias, sem ponto colorido, entre o `BalanceHero` e a primeira família, `mt-7`. Requisição própria; recarrega com `ledgerVersion` e ao reconectar; o erro não derruba hero nem famílias. |
| DebtRow | Link de 60 px (`listRowClasses` 2 linhas + ícone), avatar `md` `aria-hidden` com `colorIndex = counterpartUserId`, nome da contraparte em semibold, valor `text-headline` `tabular-nums` com **sinal** ("+R$ 70,00" / "−R$ 1.234,56", U+2212), chevron `aria-hidden`. Frases conferidas na tela: página da Ana "Bruno deve a você" / "Você deve a Maximiliano"; página do Bruno "Bruno deve a Ana" com sinal "−" (ponto de vista da pessoa da página). Nome acessível sem `aria-label`, igual ao texto: "Bruno deve a você , +R$ 70,00". `NavState` com `backLabel` = primeiro nome da pessoa da página ("‹ Ana"). |
| Bitcoin nas dívidas | 5 casas (`+₿ 0,00047`); valor que zeraria passa a 8 casas (`hidesInDisplay` + `formatSigned(…, full)`). |
| Estados da seção | Esqueleto de 2 linhas com `aria-busy` + `sr-only role="status"`; vazio em cartão discreto (`debts.empty`); erro em `RetryBanner` com `WifiOff` quando offline. |
| WalletOption | Ícone do tipo `aria-hidden`, nome `line-clamp-2`, primeiro nome do titular sempre exibido, saldo que nunca quebra, negativo com "−" + `text-negative`, saldo oculto "—" `aria-hidden` + `walletOptionHidden` ("…, saldo oculto" — sugestão do §10 adotada). Slot de 20 px do ✓ sempre reservado; seleção por `aria-selected` + ✓ verde, sem fundo. |
| Campos De/Para | `SelectorRow` com `aria-haspopup="listbox"` e `aria-labelledby` = rótulo + texto `sr-only` ("De Ledger, de Ana, bitcoin, saldo ₿ 0,00187"); conteúdo visível `aria-hidden`. Para `disabled` sem origem. Modo "código da carteira" removido. |
| Grupos "Família" / "Converter" | Um `role="listbox"` com `role="group"` + cabeçalho `role="presentation"` referenciado por `aria-labelledby`; grupo vazio não renderiza; ícone do outro tipo no grupo "Converter". Esqueleto de 3 linhas, erro com `RetryBanner`, offline sem cache com `Banner` `WifiOff`. |
| Aviso sem destinos | `Banner tone="info" role="status"` com `Users` no lugar do campo Para; texto em `text-text`; botão principal `disabled` + `aria-describedby` apontando para o aviso (mas ver M-1). |
| AmountUnitToggle | Só com De e Para em bitcoin; `role="group" aria-label="Informar valor em"`; dois botões `aria-pressed`, 88 × 44 px, na ordem normal de Tab; tocar no pressionado não faz nada; troca limpa o valor e **mantém o foco no botão** (medido); campo passa a `R$`, placeholder `0,00`, descrição "em reais", ajuda "Disponível: ₿ 0,00187" continua em bitcoin. Em 320 px e zoom 200 % o alternador fica numa linha própria, sem corte nem rolagem horizontal. |
| PreviewStep (Reais) | BTC com 8 casas fixas no cartão e no `<dl>`; "= R$ 200,00 informados" logo abaixo da saída; ordem do `<dl>` igual ao §10 (Tipo · Valor informado · Valor em bitcoin · Cotação · Obtida às · Titular do destino); botão "Registrar transferência"; voltar da prévia preserva "Reais" e o valor. "Informar em bitcoin" dentro do `Banner` de alerta, com foco no Valor ao voltar. |
| Fab | Presente em Família, Conta, Notificações e página da pessoa; ausente em `/transferir` (medido). `<main>` reserva o espaço do Fab nessas rotas. |
| i18n | Todas as chaves do contrato presentes, com acentos e reticências corretos; chaves sugeridas no §10 (`walletOptionHidden`, `amountUnit.label`, `preview.amountBrl/amountBtc/enteredBrl`) adotadas. |
| axe-core | 0 violações na página da pessoa e na prévia. Nas telas com carteiras, só `label-content-name-mismatch` (ver M-3). |

---

## 2. Achados

### Bloqueantes

1. **B-1 · bloqueante · ao tocar numa dívida, a página da contraparte mostra a pessoa anterior até a resposta chegar**
   — `pages/MemberPage.tsx:94-114` (o `load` não descarta `result`) e `:170` (`if (!result)` só cobre a primeira carga);
   efeito em `:184-274`.
   A feature cria, pela primeira vez, navegação `/pessoas/:id → /pessoas/:outroId` na **mesma** rota: o React Router
   reaproveita o componente e `result` continua sendo o da pessoa anterior. Medido com 2,5 s de latência: URL já em
   `/pessoas/32` (Bruno), título **"Ana Revisão"**, avatar com a cor do Bruno (`navState.colorIndex`), "‹ Ana",
   saldo da Ana e o botão **"Adicionar carteira" ativo para a Ana** — o `WalletForm` abriria com o titular errado.
   Só a seção "Dívidas" mostra esqueleto. Leitor de tela não recebe nenhum aviso de carregamento e o foco cai no
   `<body>` (o link tocado é desmontado). Informação errada no fluxo principal (WCAG 1.3.1/4.1.2 na prática; e risco
   de ação na pessoa errada).
   Correção: tratar dado de outra pessoa como "carregando" — `const current = result?.userId === userId ? result : null`
   e usar `current` no lugar de `result` (o ramo `!current` mostra o `BalanceHeroSkeleton` com `aria-busy` e
   `role="status"`, como já faz); alternativa equivalente: montar a página com `key={userId}` na rota. Depois que a
   nova pessoa carregar, mandar o foco para o `<h1>` do `LargeTitleHeader` (`tabIndex={-1}`), para o leitor anunciar
   a nova página.

2. **B-2 · bloqueante · em 320 px a frase da dívida é cortada e perde quem deve a quem** —
   `components/debt/DebtList.tsx:99` (`line-clamp-2`), com o layout em linha única de `:93-113`.
   Na largura de referência do critério 1.4.10 (320 px CSS) as frases aparecem como **"Bruno deve a…"** e
   **"Você deve …"**: o nome do credor/devedor some e não há como ver o resto (falha de 1.4.10 Reflow; em zoom 200 %
   num celular de 390 px é igual). O sinal do valor continua, mas "quem" é a informação principal da linha.
   A causa é da especificação (§10 pedia `line-clamp-2` e valor que nunca quebra, sem prever que avatar + valor +
   chevron deixam ~110 px para a frase); corrijo o §10 no próximo ciclo.
   Correção: **tirar o `line-clamp-2`** da frase e deixar frase + valor quebrarem como bloco:
   envolver frase e valor num `<span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">`,
   frase com `min-w-[9rem] flex-1 break-words` (sem clamp), valor com `shrink-0 whitespace-nowrap` (o `sr-only ","`
   fica entre os dois). Acima de ~360 px nada muda; em 320 px / zoom o valor desce para baixo da frase, alinhado à
   direita, e a linha cresce (`min-h-row-2` já permite).

### Importantes

3. **I-1 · importante · o foco se perde a cada troca de passo da transferência** — `pages/TransactionPage.tsx:119-128`
   (o efeito procura `[data-autofocus]`), `:508-511` e `:525-533` (escolha nos seletores), `:389-395` (entrar na
   prévia), `:411-414` (voltar); `components/transaction/FormStep.tsx:196` e `:219-227` (só o De vazio e o Valor
   recebem `data-autofocus`).
   Medido: depois de escolher a origem, depois de escolher o destino, ao entrar na prévia e ao voltar da prévia,
   `document.activeElement` é o **`<body>`**. Quem usa teclado ou leitor de tela recomeça do topo da página a cada
   passo (WCAG 2.4.3). Já existia para o De antes da 006, mas agora o fluxo principal passa por dois seletores
   e uma prévia.
   Correção: guardar qual campo abriu o seletor (`returnFocusTo: "source" | "destination" | "primary"`) e passar
   `dataAutofocus` ao `SelectorRow` correspondente quando o passo volta para `Form` (o botão "Voltar" do seletor
   devolve ao mesmo campo); na prévia, `data-autofocus` + `tabIndex={-1}` no `<h2>` do passo ("Confirmar
   transferência"), para o leitor ler o título e seguir para os valores; ao voltar da prévia, foco no botão
   "Continuar". O `focusAmount` atual ("Informar em bitcoin") continua com prioridade.

4. **I-2 · importante · `role="listbox"` sem setas: cada opção é uma parada de Tab** — `FormStep.tsx:301` e
   `:408-437`; `WalletOption.tsx:251-258`.
   As opções são `<button role="option">` com `tabIndex 0` (medido: todas) e `ArrowDown` não move o foco (medido).
   O leitor anuncia "caixa de listagem", o usuário tenta as setas e nada acontece; com a família inteira no Para,
   são N tabs até o fim. O padrão APG *Listbox* pede uma única parada de Tab e navegação por setas.
   Correção (preferida): roving tabindex no listbox — só a opção selecionada (ou a primeira) com `tabIndex={0}`, as
   demais `-1`; `ArrowDown/ArrowUp` passam para a próxima/anterior **atravessando os grupos**, `Home/End` para a
   primeira/última, `Enter`/`Espaço` selecionam (o `click` do botão já cobre). Um `onKeyDown` no contêiner
   `role="listbox"` resolve os dois seletores. Alternativa mais simples: tirar `listbox`/`option`/`group` e usar uma
   lista de botões comuns com `aria-pressed`/`aria-current="true"` na escolhida e os cabeçalhos como `<h3>` —
   nesse caso trocar `aria-haspopup="listbox"` do `SelectorRow` por nada (ele navega para um sub-passo).

5. **I-3 · importante · esqueleto do avatar das dívidas sai quadrado** — `DebtList.tsx:121`; causa em
   `components/ui/Skeleton.tsx` (classe base `rounded-sm`) + `utils/cn.ts` (só concatena, não resolve conflito).
   Capturado em rede lenta: os dois blocos de 40 px aparecem como quadrados arredondados, não círculos — a
   transição esqueleto → avatar "pula" de forma e o esqueleto lembra o ícone de carteira, não uma pessoa
   (o §10 pede `rounded-pill`). `rounded-[10px]`/`rounded-md` em outros esqueletos funcionam por acaso da ordem do CSS.
   Correção: `className="size-10 shrink-0 !rounded-pill"` aqui; e, de forma geral, aceitar `rounded` como prop do
   `Skeleton` (sem a classe base quando vier) para não depender da ordem das regras.

### Menores

6. **M-1 · menor · "sem destinos": botão diz "Registrar transferência" e o `aria-describedby` não é alcançável por
   Tab** — `TransactionPage.tsx:445` e `:448-450`, `:552-562`.
   O §10 previa "Continuar" `disabled` com descrição; o rótulo cai em "Registrar transferência" porque sem destino
   `needsPreview` é falso. E um botão `disabled` sai da ordem de Tab, então a descrição só é lida no modo de leitura
   (erro da minha especificação). O aviso está logo acima e é `role="status"`, por isso é menor.
   Correção: com `noDestinations`, usar o rótulo `transaction.submit.continue`; manter `disabled` (não usar
   `aria-disabled` aqui — não há o que avisar ao tocar). Corrijo o texto do §10 ("para quem chega nele pelo teclado"
   → "para quem lê o botão no modo de leitura").

7. **M-2 · menor · foco cai no `<body>` quando a nova tentativa dá certo** — `DebtList.tsx:140-151` (troca o
   `RetryBanner` pela lista) e `FormStep.tsx:374-378` (troca pelo listbox).
   O `RetryBanner` só devolve o foco quando a tentativa **falha**; quando dá certo ele é desmontado com o foco
   dentro. Correção: em `DebtList`, ao sair do estado de erro por um clique em "Tentar de novo", focar o `<h2>` da
   seção (`tabIndex={-1}`); no seletor do Para, focar a opção com `data-autofocus` (o mesmo mecanismo de I-1).

8. **M-3 · menor · nome acessível das carteiras não contém o texto visível na mesma sequência** —
   `WalletOption.tsx:255`, `FormStep.tsx:93-98`, `sheetModel.ts:43-52`.
   axe acusa `label-content-name-mismatch` (regra experimental, 2.5.3): visível "Ledger · Ana · ₿ 0,00187", nome
   "Ledger, de Ana, bitcoin, saldo ₿ 0,00187". Como o nome **começa** pelo nome da carteira e as palavras visíveis
   aparecem na mesma ordem, comando de voz ("clicar Ledger") funciona — não é falha de 2.5.3 na prática. Registro
   para não virar falso positivo no CI caso o `vitest-axe` passe a rodar regras experimentais: manter o texto do
   contrato e, se necessário, desligar essa regra só nesses testes, com comentário apontando para este item.

9. **M-4 · menor · espaço antes da vírgula no nome do link da dívida** — `DebtList.tsx:103`.
   A árvore do Chrome calcula "Bruno deve a você **,** +R$ 70,00" (o `sr-only` é `position: absolute` e vira um
   bloco à parte). Leitores de voz não pronunciam a diferença; em linha braille aparece. Correção: colocar a vírgula
   no fim do próprio texto da frase — `<span className="sr-only">,</span>` **dentro** do `<span>` da frase, logo
   depois do `<DebtPhrase>`, e o espaço entre os blocos fica natural.

---

## 3. Prioridade sugerida para o `frontend-react-developer`

**B-1 → B-2 → I-1 → I-2 → I-3 → menores.**

- B-1 e B-2 estão na página da pessoa e são pequenos (uma variável `current` em `MemberPage`; um contêiner com
  `flex-wrap` em `DebtRow`). B-1 é o único achado com risco de ação errada (adicionar carteira para a pessoa anterior).
- I-1 e I-2 mexem no mesmo lugar (`TransactionPage` + `FormStep`): fazer juntos — o roving tabindex do I-2 define
  qual opção recebe `data-autofocus`, e o retorno de foco do I-1 usa o mesmo mecanismo.
- Correções de especificação que ficam comigo (`components.md` §10, próximo ciclo de design): regra de quebra da
  `DebtRow` (B-2), texto do `aria-describedby` do botão desabilitado (M-1) e o retorno de foco entre passos (I-1).

---

## 4. Correções

Feitas pelo `frontend-react-developer` em 2026-11-03 (caminhos relativos a `frontend/src/`). Testes novos/ajustados
em Vitest + Testing Library + vitest-axe.

| Achado | Situação | O que mudou | Arquivos |
|---|---|---|---|
| **B-1** | Corrigido | `current = result?.userId === userId ? result : null`; o ramo `!current` mostra o esqueleto com `aria-busy` + `role="status"` (sem nome, saldo nem "Adicionar carteira" da pessoa anterior). Respostas atrasadas de outra pessoa (saldos e dívidas) são descartadas. Depois que a nova pessoa carrega, o foco vai para o `<h1>` (`LargeTitleHeader` ganhou `titleRef`, que deixa o título com `tabIndex={-1}`). | `pages/MemberPage.tsx`, `components/layout/LargeTitleHeader.tsx`; teste em `pages/MemberPage.test.tsx` |
| **B-2** | Corrigido | Frase sem `line-clamp-2` (`min-w-[9rem] flex-1 break-words`); frase + valor num contêiner `flex flex-wrap … justify-between`; valor `ml-auto shrink-0 whitespace-nowrap` desce para baixo da frase, à direita, em 320 px / zoom. §10 atualizado (tabela da `DebtRow` e regra "320 px / zoom 200 %"). | `components/debt/DebtList.tsx`, `docs/design/components.md`; teste em `components/debt/DebtList.test.tsx` |
| **I-1** | Corrigido | `returnFocus` (`FocusReturn.Source/Destination/Primary`, em `sheetModel.ts`): escolher uma opção ou "‹ Voltar" do seletor devolve o foco ao campo De/Para que o abriu; na prévia, `<h2>` do passo com `tabIndex={-1}` + `data-autofocus`; ao voltar da prévia (ou erro dela), foco no "Continuar". "Informar em bitcoin" mantém a prioridade do Valor. Lista do Para que chega depois de o seletor abrir também recebe o foco (se ele estiver no `<body>`). §10 atualizado. | `pages/TransactionPage.tsx`, `components/transaction/FormStep.tsx`, `components/transaction/sheetModel.ts`, `docs/design/components.md`; teste em `pages/TransactionPage.test.tsx` |
| **I-2** | Corrigido | Roving tabindex no padrão APG *Listbox* (com grupos): hook `useRovingListbox` no contêiner `role="listbox"` dos dois seletores — uma parada de Tab (selecionada ou primeira), `ArrowDown/ArrowUp` atravessando "Família" → "Converter", `Home/End`; `Enter`/`Espaço` pelo clique nativo; `aria-selected` mantido. §10 atualizado. | `components/transaction/useRovingListbox.ts` (novo), `components/transaction/WalletOption.tsx`, `components/transaction/FormStep.tsx`, `docs/design/components.md`; testes em `pages/TransactionPage.test.tsx` |
| **I-3** | Corrigido | `Skeleton` ganhou a prop `rounded` (padrão `rounded-sm`), que **substitui** a classe base em vez de competir com ela; todos os esqueletos que passavam `rounded-*` no `className` migrados (avatar das dívidas com `rounded="rounded-pill"`). | `components/ui/Skeleton.tsx`, `components/debt/DebtList.tsx`, `components/transaction/FormStep.tsx`, `components/wallet/WalletCard.tsx`, `components/account/ConnectedAssistants.tsx`, `pages/NotificationsPage.tsx`, `pages/AuthorizePage.tsx`, `docs/design/components.md`; teste em `components/debt/DebtList.test.tsx` |
| **M-1** | Corrigido (especificação alterada) | Sem destinos, o botão diz "Continuar" e usa `aria-disabled="true"` (não `disabled`): continua na ordem de Tab, a descrição (`aria-describedby` → aviso) é lida ao chegar nele pelo teclado e tocar/Enter não faz nada. Diverge da correção sugerida acima ("manter `disabled`") por pedido explícito: assim a explicação fica alcançável. §10 reescrito. | `pages/TransactionPage.tsx`, `docs/design/components.md`; teste em `pages/TransactionPage.test.tsx` |
| **M-2** | Corrigido | `DebtList`: "Tentar de novo" bem-sucedido leva o foco ao `<h2>` "Dívidas" (`tabIndex={-1}`); se falhar, o `RetryBanner` continua devolvendo ao botão. Seletor do Para: a lista que chega depois do "Tentar de novo" recebe o foco na opção inicial. | `components/debt/DebtList.tsx`, `components/transaction/FormStep.tsx`, `docs/design/components.md`; asserção em `pages/MemberPage.test.tsx` |
| **M-3** | Não alterado (como recomendado no item) | O texto do nome acessível é do contrato ("Ledger, de Ana, bitcoin, saldo ₿ 0,00187") e já começa pelo nome visível da carteira, com as palavras visíveis na mesma ordem — comando de voz funciona. Fazer o nome *conter* o texto visível contíguo exigiria mudar o texto do contrato ou montar o nome a partir do conteúdo com pedaços `sr-only`, o que traz de volta o problema de espaço antes da vírgula do M-4 no Chrome. A regra é experimental e não roda no `vitest-axe` (só `region` e `color-contrast` estão desligadas; experimentais ficam fora por padrão); comentário em `WalletOption.tsx` aponta para este item. | `components/transaction/WalletOption.tsx` (comentário) |
| **M-4** | Corrigido | `<span className="sr-only">,</span>` dentro do `<span>` da frase, logo depois do `<DebtPhrase>`; o espaço fica entre os blocos. §10 atualizado. Verificado em jsdom (estrutura + nome acessível); a árvore do Chrome não foi medida de novo. | `components/debt/DebtList.tsx`, `docs/design/components.md`; teste em `components/debt/DebtList.test.tsx` |
