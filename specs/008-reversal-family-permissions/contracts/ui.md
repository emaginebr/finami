# Contrato de interface — feature 008

O `ux-designer` define o layout e os tokens antes da implementação (Princípio VIII). Tudo segue o
Princípio IX (WCAG 2.1 AA).

## Página da família (`/familias/:id`, `MemberManager`)

### Responsável

Em cada membro que não é o responsável, há dois interruptores:

- "Pode lançar" (`role="switch"`, `aria-checked`), com a ajuda "Receitas, despesas e transferências
  nas carteiras da família.";
- "Pode estornar", com a ajuda "Desfazer qualquer lançamento das carteiras da família.".

Comportamento:

- **Ao mudar**: o app envia o PUT com os dois valores. Enquanto envia, o interruptor fica
  `aria-busy`. Depois aparece o toast "Permissões de Caio atualizadas.".
- **Erro**: o interruptor volta ao estado anterior e aparece a mensagem.
- **Offline**: os interruptores ficam desabilitados com "Sem conexão" (feature 005).
- **Linha do responsável**: não tem interruptores e mostra "Todas as permissões".

### Membro

- Junto ao **próprio nome**, um resumo: "Somente leitura", "Pode lançar", "Pode estornar" ou "Pode
  lançar · Pode estornar".
- Nos **outros membros**, o mesmo resumo, só para leitura.
- **Nenhum controle** de adicionar, convidar, remover ou mudar permissões (já é assim hoje).

## Lançar (`/depositar`, `/sacar`, `/transferir`)

- **Carteiras de origem** (e a carteira única do depósito e do saque): só as que têm
  `canCreateTransactions`.
- **Destino da transferência**: inalterado. Receber não depende de permissão.
- **Sem nenhuma carteira permitida**:
  - estado vazio "Você só pode consultar a família {nome}." (ou "Você não tem carteiras em que possa
    lançar." quando for mais de uma família);
  - o botão principal fica desabilitado.
- **Atalhos da Home e da carteira** (Depositar, Sacar, Transferir): somem quando a carteira não tem
  `canCreateTransactions`.
- **403 por permissão no envio** (a permissão mudou durante o preenchimento): toast com a mensagem
  da API, e o formulário recarrega as carteiras.

## Detalhe do lançamento e estorno (`TransactionDetailSheet`)

- **"Estornar"**: aparece se `transaction.canReverse`. Substitui a regra antiga `canControl`.
- **Confirmação** (`ConfirmModal` existente), com o efeito:
  - "R$ 80,00 voltam para Mesada." (despesa);
  - "R$ 500,00 voltam para Nubank e ₿ 0,00100000 saem de Ledger." (conversão);
  - em empréstimo e quitação: "Dívida de Bruno com Ana: R$ 70,00 → R$ 100,00.".
- **Ligações**:
  - o original estornado mostra "Estornado por #id";
  - o estorno mostra "Estorno de #id", com link para abrir o original.

## Notificações

| Tipo | Texto |
|---|---|
| `MemberPermissionsChanged` | "{ator} mudou suas permissões na família {família}: {resumo}." |
| `TransactionReversed` | "{ator} estornou um lançamento da sua carteira {carteira}." (toque abre a carteira) |

## i18n (`pt-BR.json`): chaves novas

| Chave | Texto |
|---|---|
| `group.permissions.create` / `reverse` | "Pode lançar" / "Pode estornar" |
| `group.permissions.createHelp` / `reverseHelp` | textos de ajuda acima |
| `group.permissions.readOnly` / `all` | "Somente leitura" / "Todas as permissões" |
| `group.permissions.updated` | "Permissões de {{name}} atualizadas." |
| `transaction.readOnlyFamily` / `noWritableWallet` | "Você só pode consultar a família {{name}}." / "Você não tem carteiras em que possa lançar." |
| `statement.reverseEffect.*` | frases do efeito na confirmação |
| `statement.reversalOf` | "Estorno de #{{id}}" |
| `notifications.memberPermissionsChanged` / `transactionReversed` | textos acima |
