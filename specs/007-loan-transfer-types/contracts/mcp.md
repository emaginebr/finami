# Contrato MCP — feature 007

O catálogo continua com 40 ferramentas. Mudam parâmetros e descrições.

## `previa_transferencia` e `registrar_transferencia`

Parâmetros novos (opcionais):

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `tipo` | `emprestimo` \| `quitacao` \| `pagamento` | Obrigatório na prática quando o destino é de outra pessoa; sem ele, vale `emprestimo`. Não usar entre carteiras da mesma pessoa. |
| `moeda_da_divida` | `BRL` \| `BTC` | Só para `quitacao`: qual dívida está sendo quitada; padrão = moeda das carteiras. |
| `quitar_tudo` | bool | Só para `quitacao`: quita a dívida inteira; não informe `valor`/`valor_em_reais`. |

Mapeamento: `emprestimo → loan`, `quitacao → settlement`, `pagamento → payment`.

Texto de regras (`TRANSFER_RULES`), em substituição ao atual:

> Regras: o destino deve ser da própria pessoa ou de alguém da família (use
> destinos_de_transferencia); conversão entre real e bitcoin só entre carteiras da mesma pessoa.
> Entre pessoas diferentes, confirme o tipo com a pessoa: **emprestimo** (quem recebe passa a dever),
> **quitacao** (paga uma dívida de quem envia com quem recebe, total ou parcial; pode quitar dívida
> em real com bitcoin e vice-versa, pela cotação atual) ou **pagamento** (sem dívida). Veja
> dividas_da_pessoa antes de quitar.

Texto da prévia: inclui o tipo e, quando houver, o efeito na dívida. Exemplo: "Quitação: abate
R$ 100,00 da dívida de Bruno com Ana (de R$ 100,00 para R$ 0,00), pela cotação ₿ 1 = R$ 500.000,00.".

## `dividas_da_pessoa`

O contrato não muda. A descrição passa a dizer que a dívida vem de empréstimos menos quitações, e que
pagamentos não entram.

## Prompt `resumo_do_mes` e instruções do servidor

Trocar a frase "transferência entre pessoas vira dívida" por "empréstimo entre pessoas vira dívida;
quitação abate; pagamento não gera dívida".
