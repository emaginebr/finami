# Contrato MCP — feature 006

Ferramentas no padrão existente (`McpToolBase`, nomes em português, escopos `finami:read` /
`finami:write`, auditoria e `chave_repeticao` nas de escrita).

## Nova — `dividas_da_pessoa` (somente leitura, `finami:read`)

- **Descrição**: "Mostra quanto a pessoa deve a cada pessoa da família e quanto cada uma deve a
  ela, separado por moeda. Toda transferência entre pessoas diferentes vira dívida de quem recebeu
  com quem enviou; transferências no sentido contrário compensam."
- **Parâmetros**: `pessoa_id` (long, opcional — padrão: a pessoa conectada).
- **Retorno**: o mesmo JSON de `GET /api/users/{userId}/debts`.
- **Erros**: pessoa que não pode ser vista → `nao_encontrado`.

## Nova — `destinos_de_transferencia` (somente leitura, `finami:read`)

- **Descrição**: "Lista para onde é possível transferir a partir de uma carteira: carteiras da mesma
  moeda da própria pessoa e das pessoas da família, e as carteiras da própria pessoa na outra moeda
  (conversão)."
- **Parâmetros**: `carteira_origem_id` (long).
- **Retorno**: o mesmo JSON de `GET /api/wallets/{id}/transfer-destinations`.

## Alteradas — `previa_transferencia` e `registrar_transferencia`

- `valor` passa a ser opcional (`decimal?`); novo parâmetro `valor_em_reais` (`decimal?`):
  "Opcional: valor em reais para transferir bitcoin (origem e destino em bitcoin); o Finami converte
  pela cotação atual. Informe `valor` ou `valor_em_reais`, nunca os dois."
- Descrição de `carteira_destino_id`: trocar "pode ser de outra pessoa" por "deve ser da própria
  pessoa ou de alguém da família; use destinos_de_transferencia".
- Descrição das ferramentas: incluir as regras "só para pessoas da família", "conversão real ↔
  bitcoin só entre carteiras da mesma pessoa" e "transferência entre pessoas gera dívida
  (dividas_da_pessoa)".
- Erros novos chegam como `regra_de_negocio` / `validacao` com as mensagens do contrato da API.

## Prompt `FinamiPrompts`

Acrescentar ao texto de orientação: dívidas entre pessoas, as duas restrições e a opção de informar
bitcoin em reais.
