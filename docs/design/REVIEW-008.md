# Revisão de design — telas da feature 008 × especificação (T052)

Feature `008-reversal-family-permissions` · direção **Noite Roxa** · referência:
[`mockups/family-permissions.html`](./mockups/family-permissions.html), especificação em
[`components.md` §12](./components.md), comportamento e textos em
`specs/008-reversal-family-permissions/contracts/ui.md`, Princípio IX (WCAG 2.1 AA) de
`.specify/memory/constitution.md`. Consumo: `frontend-react-developer` (todos os itens são `.tsx`/`.ts`/`.json`).

## Como foi feita

- **Revisão estática** linha a linha de `components/ui/Switch.tsx`, `components/ui/ConfirmModal.tsx`,
  `components/group/MemberPermissions.tsx`, `permissionSummary.ts`, `MemberManager.tsx`, `MemberRow.tsx`,
  `pages/GroupPage.tsx` (junção das permissões e condição da folha "Gerenciar família"),
  `components/statement/ReverseEffect.tsx`, `TransactionDetailSheet.tsx`, `pages/TransactionPage.tsx` (estado
  "só consultar" e 403), `components/notification/NotificationItem.tsx` e as chaves novas/alteradas de
  `i18n/pt-BR.json` (`groups.permissions.*`, `groups.members.onlyResponsible`, `notifications.*`,
  `statement.reverseEffect.*`, `statement.reversalOf/reversedByLink/openOriginal/openReversal/reversing`,
  `transaction.readOnlyFamily/noWritableWallet/readOnlyHint`). Apoio: `Contexts/GroupContext.tsx`
  (`setMemberPermissions` faz `upsert` do `GroupInfo` devolvido, e o `GroupPage` lê a família do contexto —
  a atualização otimista não "pisca" de volta), `hooks/useOnlineAction.ts`, `ui/listRow.ts`, `ui/EmptyState.tsx`,
  `ui/Modal.tsx` e `index.css` (separadores `.list-row + .list-row`).
- **Não verificado no navegador** (sem app rodando nesta revisão): medidas em 320 px / zoom 200 % são estimadas
  pelas classes (gutter 16 px, `px-4`, `Avatar md` 40 px, `gap-3`); anúncios de leitor de tela são inferidos da
  árvore ARIA.
- **Contraste**: nenhum token novo; as combinações usadas são as da tabela do §12 (texto ≥ 4,5:1, trilho e
  contorno ≥ 3:1; `opacity-60` só em estados `aria-disabled`, isentos por 1.4.3/1.4.11).

Severidade: **bloqueante** = falha WCAG 2.1 AA ou informação errada no fluxo principal da feature — corrigir antes
do merge; **importante** = falha de acessibilidade em fluxo secundário, informação errada fora do fluxo principal ou
divergência visível da especificação; **menor** = acabamento.

**Resultado: 0 bloqueantes, 2 importantes, 6 menores.**

---

## 1. Resumo — o que está fiel

| Área | Verificado |
|---|---|
| `SwitchRow` | Props `busy`, `ariaDisabled`, `describedBy`, `onBlockedClick` opcionais; "Carteira virtual" (sem ajuda) segue `items-center py-2`. Rótulo virou `<label htmlFor>` (tocar no texto alterna; nome acessível pelo `<label>`, ajuda fora dele e no `aria-describedby`). Área de toque 59 × 47 px por `before:-inset-x-1 -inset-y-2` sem mexer no trilho. Ocupado: `aria-busy`, `Loader2` 14 px `text-brand motion-safe:animate-spin` `aria-hidden`, cliques ignorados, botão continua focado (não vira `disabled`). `aria-disabled` com `opacity-60`/`cursor-not-allowed` e clique → `onBlockedClick`. Anel `outline-focus` 2 + 2 px no trilho, sem corte pelo `overflow-hidden` do cartão (16 px de folga). |
| Cartões da "Gerenciar família" | Um cartão por membro `role="group"` + `aria-labelledby` = nome; cabeçalho com `listRowClasses`, "membro" e "Retirar" inalterados; separadores recuados de 16 px pelo `.list-row` irmão (cabeçalho → interruptores → erro). Responsável sem interruptores nem "Retirar", subtítulo `[Responsável] · você · Todas as permissões`. Os interruptores ficam só na folha (lista de saldos continua com links simples — sem controle aninhado). |
| `MemberPermissions` | Otimista (o trilho já mostra o novo estado), um envio por membro (o outro interruptor fica `aria-disabled` só enquanto o PUT do mesmo membro corre; outros membros livres). Sucesso: toast "Permissões de Caio atualizadas." e `GroupInfo` devolvido no contexto. Erro: volta ao salvo, `<p role="alert">` com `CircleAlert` dentro do cartão, ligado aos **dois** interruptores até o próximo sucesso, sem toast. Rede caída durante o envio: recarrega o grupo em vez de reverter às cegas. Status `sr-only role="status"` "Salvando…" por cartão. `aria-describedby` só com ids existentes (offline → alcance → erro). |
| Nota de alcance | Usa a visibilidade **salva** (`group.statementVisibility`, não o rascunho do `VisibilityPicker`), aparece uma vez abaixo dos cartões, `Info` `text-info`, e entra no `aria-describedby` de todo "Pode estornar". Some com `AllMembers`. |
| Offline | Nota com `WifiOff` `text-warning` abaixo de "MEMBROS (n)", só para o responsável e só offline; interruptores `aria-disabled` + nota no `aria-describedby`; toque → toast da §9. **Desvio aceito**: o texto é `pwa.offline.writeBlocked` ("Sem internet. Conecte-se para fazer alterações.") em vez de `groups.permissions.offline`. Aceitável — é a mesma frase do toast e do banner da feature 005, o que resolve a divergência 5 do §12 a favor da uniformidade; a nota continua explicando *por que* os interruptores estão apagados. |
| Resumo na lista Membros | `GroupPage` junta `group.members` pelo `userId`; sem família carregada não renderiza a linha. Linha 2 = permissões (`text-footnote text-text-muted`, só texto), linha 3 = você/saldo; responsável só com o selo. Também no `Hidden` (a linha estática mostra o texto). `aria-label` do link com o resumo logo depois do nome (2.5.3 atendido). Rodapé `onlyResponsible` com "mudar permissões". Mas ver I-1. |
| Lançar sem carteira permitida | Origem = `isActive && canCreateTransactions`; estado vazio só quando a pessoa controla carteiras ativas e nenhuma permite lançar. `EmptyState` `Eye` `pt-8 pb-6` dentro de `<div id={readOnlyId}>`; mensagem por família única × várias; De/Para/Tipo/Valor/Descrição não renderizados; botão com o rótulo de sempre ("Depositar"/"Sacar"/"Transferir"), `aria-disabled` + `aria-describedby` → estado vazio, sem ação. 403 no envio: toast com a mensagem da API, volta ao formulário, recarrega carteiras, De fica vazio se a origem sumiu e cai no estado vazio se nada sobrar; o foco fica no botão (mesmo elemento entre os passos). **Desvio aceito**: sem atalhos por carteira na Home/extrato — nada a apontar aqui. |
| `ConfirmModal` + `ReverseEffect` | `details` entre descrição e botões, dentro do mesmo `Dialog.Description` (o `alertdialog` lê descrição + efeito ao abrir); foco inicial em "Cancelar"; `loadingLabel` "Estornando…". Bloco `bg-surface` sobre a modal `bg-surface-2`, título `text-footnote uppercase text-text-muted`, uma frase por `<p>`, valores `font-semibold whitespace-nowrap tabular-nums`, BTC com 8 casas (`formatMoneyFull`). Frases certas por tipo: despesa "voltam para", receita "saem de", transferência/conversão "voltam para … e … saem de", pagamento só a frase da transferência; devedor/credor certos (empréstimo: devedor = titular do Para; quitação: devedor = titular do De). **Desvio aceito**: dívida como "A dívida de Bruno com Ana diminui/aumenta R$ 100,00." sem antes → depois. Aceitável — é exatamente a frase de reserva do §12, não engana (o servidor continua a autoridade e "Estornar" fica ativo), e evita uma busca extra que poderia mudar a altura da modal. |
| `TransactionDetailSheet` | "Estornar" só com `transaction.canReverse` e só depois do `TransactionInfo` chegar. Ligações "Estornado por #id" / "Estorno de #id" como `<button>` de lista (tile `Undo2` `bg-surface-3`, título `text-accent`, subtítulo, `ChevronRight`), no lugar do banner antigo (`statement.reversedBy` removida). Troca na mesma folha com esqueleto, "‹ Voltar" com pilha de 1 nível, foco no resumo ao abrir e na ligação ao voltar (só depois de carregar). Sinal do valor invertido no ligado. 403 ao abrir: `Banner` de erro com "‹ Voltar". Estorno mostra "Estorno de quitação" e "Devolvido à dívida" (REVIEW-007 I-4 resolvido). 403/409/422 no estorno: toast, modal fecha, detalhe recarrega. |
| Notificações | `ShieldCheck` `bg-info-soft text-info` e `Undo2` `bg-surface-3 text-text-muted`; frases com `<b>`; resumo sempre com os dois lados em minúsculas, "somente leitura" com os dois desligados; variações curtas sem `permissions` / sem `walletName`; toque leva à família ou ao extrato da carteira (`walletId`), item estático sem o dado; `emptyBody` atualizado. |
| i18n | Todas as chaves do §12 (prefixo `groups.permissions.*`, divergência 1) presentes, com acentos, reticências (`…`) e pontuação corretos; `actions.saving` e `transaction.preview.debtRestored` reaproveitados. |

---

## 2. Achados

### Bloqueantes

Nenhum.

### Importantes

1. **I-1 · importante · o resumo de permissões some (truncado) em 320 px e com zoom 200 %** —
   `components/group/MemberRow.tsx:65` (`truncate`); mesma causa no subtítulo do responsável em
   `components/group/MemberManager.tsx:84`.
   Na lista Membros, a coluna de texto divide a linha com o total e o chevron. Em 320 px: 288 (gutter) − 32 (`px-4`)
   − 52 (avatar 40 + `gap-3`) − 30 (chevron + gap) − ~107 ("R$ 3.150,00" 17 px semibold + gap) ≈ **70–100 px**
   (estimado; não medido). "Pode lançar · Pode estornar" precisa de ~165 px e "Somente leitura" de ~95 px em 13 px:
   aparece "Pode la…" / "Somente l…". É justamente a informação da US5 ("junto ao próprio nome, o membro vê o que
   pode fazer"), e não existe em outro lugar visível (a tela do membro não mostra permissões); o `aria-label`
   completo salva só quem usa leitor. Na folha, o subtítulo do responsável "[Responsável] · você · Todas as
   permissões" (~265 px) também corta "Todas as permi…" em ~204 px. WCAG 1.4.10 (Reflow — perda de informação).
   O `truncate` veio da minha especificação e do mockup (`.perm-sum` com `nowrap`) — erro meu.
   Correção:
   - `MemberRow.tsx:65`: trocar `truncate` por `break-words` e renderizar cada parte como
     `<span className="whitespace-nowrap">` (o separador " · " fica entre elas), para quebrar **entre**
     "Pode lançar ·" e "Pode estornar", nunca no meio. Sugestão: `permissionSummary` ganhar uma variante que
     devolve `string[]` (`permissionParts`) e o componente une com `" · "`. A linha cresce para 2 linhas só
     quando precisa (`min-h-row-2` já permite).
   - `MemberManager.tsx:84`: no subtítulo, `truncate` → `flex flex-wrap items-center gap-x-1` (ou
     `break-words`), mantendo o `Badge` inteiro; "Todas as permissões" desce para a linha seguinte se faltar espaço.
   Corrijo o §12 e o `.perm-sum` do mockup no próximo ciclo.

2. **I-2 · importante · erro "não confirmado" ao mudar permissão fala de "lançamento" e "extrato"** —
   `components/group/MemberPermissions.tsx:179`.
   Quando a rede cai durante o PUT, a linha de erro do cartão mostra `pwa.offline.writeUnconfirmed` = "Não foi
   possível confirmar o lançamento. Verifique o extrato quando a conexão voltar." — não houve lançamento nem há
   extrato a verificar; o que ficou incerto foi a permissão (e o app já recarrega a família). Informação errada,
   fora do fluxo principal (a mensagem também chega pelo `role="alert"` e fica no `aria-describedby` dos dois
   interruptores). Pedido da minha especificação (§12, "Erro 'não confirmado'") — erro meu.
   Correção: chave nova `groups.permissions.unconfirmed` = "Não foi possível confirmar a mudança. Confira as
   permissões de {{name}} quando a conexão voltar." e
   `setError(t("groups.permissions.unconfirmed", { name: member.firstName }))`. O recarregamento (`reloadGroup`)
   continua.

### Menores

3. **M-1 · menor · o "·" do resumo é lido de forma ambígua (ou nem é lido)** —
   `components/group/MemberRow.tsx:96` (`aria-label` com `permissionText.toLowerCase()`),
   `components/group/permissionSummary.ts:274` (resumo da notificação) e `i18n/pt-BR.json`
   (`groups.permissions.separator`).
   No nome acessível do link o resumo entra como "pode lançar · pode estornar". Com a pontuação no nível padrão,
   NVDA e VoiceOver não falam o ponto médio: sai "Bruno Silva, pode lançar pode estornar, total…". Na notificação,
   "pode lançar · não pode estornar" vira "pode lançar não pode estornar" — dá para entender, mas o "não" parece
   emendado. O mockup usa vírgula no `aria-label` ("Bruno Silva, pode lançar, pode estornar, total…").
   Correção: no `aria-label` do `MemberRow`, montar com as partes separadas por `", "` (com a `permissionParts`
   de I-1). Na notificação, que é texto visível, manter o " · " na tela e trocar o separador falado:
   `notificationPermissionSummary` devolve as partes e a frase usa um componente `<sep/>` →
   `<span aria-hidden="true"> · </span><span className="sr-only">, </span>` (ou, mais simples, unir com
   `t("notifications.permissionSummary.separator")` = `", "` e aceitar a vírgula também na tela).

4. **M-2 · menor · a mesma mensagem de erro duas vezes seguidas não é anunciada de novo** —
   `components/group/MemberPermissions.tsx:223-231`.
   O `<p role="alert">` fica montado entre tentativas. Se o segundo envio falha com o mesmo texto (dois 500
   seguidos, por exemplo), o conteúdo não muda e o leitor não anuncia nada: a pessoa ouve só "Salvando…" e o
   interruptor voltando. Correção: um contador `errorTick` incrementado a cada falha e `key={errorTick}` no `<p>`
   (remonta o alerta). Alternativa: `setError(null)` no início de `change()` — mas isso tira o erro do
   `aria-describedby` durante o envio, então prefiro o `key`.

5. **M-3 · menor · 403 por ter deixado de ser responsável apaga a mensagem junto com a folha** —
   `components/group/MemberPermissions.tsx:183`; folha condicionada em `pages/GroupPage.tsx:386`.
   No 403 o componente mostra o erro no cartão e recarrega a família. Se o motivo é que a pessoa deixou de ser
   responsável, o recarregamento põe `isResponsible = false`, a folha "Gerenciar família" desmonta e leva o erro e
   o interruptor focado junto: a pessoa vê a folha sumir sem explicação, e o foco cai no `body`. Raro, mas é
   exatamente o exemplo do §12. Correção: no ramo `RELOAD_STATUSES`, além do erro no cartão, `notifyError(err)`
   (o toast sobrevive à folha — exceção justificada ao "sem toast de erro"); no `GroupPage`, quando a folha fecha
   porque `isResponsible` virou `false`, devolver o foco ao título da página (`h1` com `tabIndex={-1}`).

6. **M-4 · menor · depois de um erro definitivo no estorno o foco vai para o contêiner da folha** —
   `components/statement/TransactionDetailSheet.tsx:190-192`.
   Em 403/409/422 a modal fecha e o Radix devolve o foco ao "Estornar"; o recarregamento (`setReloadKey`) zera o
   `transaction`, o botão desmonta e o `FocusScope` da folha joga o foco no contêiner — o leitor relê "Detalhe do
   lançamento, diálogo" e a pessoa perde o lugar. Correção: no ramo dos erros definitivos,
   `setFocusTarget("summary")` junto com o `setReloadKey` (o efeito de foco já existe; o resumo é o primeiro
   conteúdo e já tem `tabIndex={-1}`).

7. **M-5 · menor · "O que acontece" vira um *landmark* dentro da confirmação** —
   `components/statement/ReverseEffect.tsx:84`.
   `<section aria-labelledby>` com nome acessível é `role="region"`: a lista de landmarks ganha "O que acontece,
   região" dentro de um `alertdialog`, e alguns leitores anunciam "região" no meio da descrição lida ao abrir.
   Mesmo erro de especificação da REVIEW-007 M-1 (o §12 pediu `<section>`) — meu. Correção: `<div>` no lugar de
   `<section>` e sem `aria-labelledby`; o `<h3>` continua (ajuda a navegar por títulos) e o texto entra na
   descrição do mesmo jeito. Corrijo o §12.

8. **M-6 · menor · a mensagem do estado vazio pode trocar de texto logo depois de aparecer** —
   `pages/TransactionPage.tsx:158-166`.
   Abrindo `/depositar` direto pela URL, as carteiras podem chegar antes das famílias: `groups.find` não acha o
   nome e o título mostra "Você não tem carteiras em que possa lançar."; quando `loadGroups` termina, vira
   "Você só pode consultar a família Silva." — o `<h2>` muda sob os olhos (e sob o leitor, se ele já estava lendo
   o `aria-describedby` do botão). Correção: com uma única família e o nome ainda desconhecido, esperar as
   famílias — não renderizar o `EmptyState` (o botão segue `aria-disabled`, sem `aria-describedby` enquanto o id
   não existe) até `groups` carregar; só cair em `noWritableWallet` se a família continuar sem nome depois disso.

   Acabamento junto com este item, no `components/ui/Switch.tsx:93-99`: ao ligar, o spinner salta direto para a
   direita (`translate-x-5` sem transição) enquanto o botão branco ainda desliza (`after:transition-transform`),
   e por ~150 ms o ícone fica "fora" do botão. Acrescentar `motion-safe:transition-transform` ao `<span>` do
   spinner.

---

## 3. Prioridade sugerida para o `frontend-react-developer`

**I-1 → I-2 → M-1 → menores.**

- I-1 e M-1 mexem no mesmo lugar: criar `permissionParts(t, permissions): string[]` em `permissionSummary.ts`,
  usar no `MemberRow` (visível com `whitespace-nowrap` por parte; `aria-label` com vírgulas) e no subtítulo do
  `MemberManager`. Cobrir com teste de estrutura/classe como na REVIEW-006 I-3.
- I-2 é uma chave nova no `pt-BR.json` e uma linha no `MemberPermissions`.
- M-2 a M-6 são pequenos e locais (um `key`, um `notifyError`, um `setFocusTarget`, uma tag, uma condição).
- Correções de especificação que ficam comigo (`components.md` §12 e mockup, próximo ciclo de design): resumo que
  quebra em vez de truncar (I-1), mensagem "não confirmado" das permissões (I-2), separador falado (M-1),
  `<section>` do efeito (M-5), e registrar os desvios aceitos (nota offline com `pwa.offline.writeBlocked`; dívida
  sem antes → depois; sem atalhos por carteira).

---

## 4. Resumo

A implementação segue o §12 e o contrato nos interruptores (rótulo clicável, área de toque 59 × 47 px, ocupado
otimista com `aria-busy`, um envio por membro, erro no cartão com `role="alert"` ligado aos dois interruptores,
offline `aria-disabled` com nota), nos cartões por membro da "Gerenciar família", na nota de alcance pela
visibilidade salva, no resumo da lista Membros com o dado vindo de `group.members`, no estado "só consultar" do
lançar (botão `aria-disabled` explicado, 403 tratado), na confirmação do estorno com o efeito dentro da descrição do
`alertdialog`, nas ligações estorno ↔ original e nas duas notificações novas. Os três desvios aceitos pelo
coordenador produzem resultado aceitável. Não há bloqueantes. Os dois importantes são o resumo de permissões
truncado em 320 px/zoom (I-1) e a mensagem "não confirmado" que fala de lançamento ao mudar permissões (I-2).
Nenhum token novo foi introduzido.
