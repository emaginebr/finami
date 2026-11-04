# Contrato MCP — feature 008

O catálogo passa de **40** para **41** ferramentas.

## Nova: `alterar_permissoes_membro`

- **Título**: "Alterar permissões de um membro". Não é só leitura, não é destrutiva e é idempotente.
- **Descrição**: "Liga ou desliga as permissões de um membro da família: lançar (receitas, despesas
  e transferências nas carteiras da família) e estornar (qualquer lançamento das carteiras da
  família). Só o responsável pela família pode usar. Sem 'lançar', o membro fica só consultando
  aquela família. Confirme com a pessoa antes de mudar."
- **Parâmetros**:

| Nome | Tipo | Descrição |
|---|---|---|
| `familia_id` | long | Id da família (`listar_familias`) |
| `pessoa_id` | long | Id do membro (`obter_familia`) |
| `pode_lancar` | bool | Pode criar lançamentos na família |
| `pode_estornar` | bool | Pode estornar lançamentos da família |

- **Resposta**: texto com o estado novo ("Caio agora: só consulta · pode estornar.") e a família
  atualizada. Os erros são as mesmas mensagens da API.

## Alteradas

- **`obter_familia`**:
  - cada membro traz `pode_lancar` e `pode_estornar`;
  - traz também `minhas_permissoes`;
  - a descrição explica as permissões.
- **`registrar_receita`, `registrar_despesa`, `registrar_transferencia`, `previa_transferencia`**:
  a descrição avisa que é preciso ter permissão de lançar na família da carteira de origem, e o erro
  vem com a mensagem da API.
- **`estornar_lancamento`**: a descrição muda para "Estorna qualquer tipo de lançamento. Precisa ser
  o responsável pela família, ter permissão de estornar nela ou ser o titular de uma carteira
  pessoal do lançamento." A mensagem de erro é a da API.
- **`FinamiPrompts`**: a regra de permissões entra no texto de orientação.
