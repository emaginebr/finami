# Quickstart — MCP do Finami com OAuth

## Ambiente

Homolog (Docker no WSL), com a migration `AddOAuthAndMcp` aplicada na subida da API:

```powershell
wsl --cd /mnt/c/repos/finami -e docker compose up -d --build
```

Frontend http://localhost:8080 · API http://localhost:5145 · **MCP http://localhost:5145/mcp**.
Variáveis novas no `.env`: `MCP_PUBLIC_URL=http://localhost:5145`,
`APP_PUBLIC_URL=http://localhost:8080`.

Verificações automáticas:

```powershell
cd backend;  dotnet test Finami.sln
cd frontend; npm run lint; npm test; npm run build
```

## Descoberta (curl)

```bash
curl -i -X POST http://localhost:5145/mcp            # 401 + WWW-Authenticate resource_metadata
curl http://localhost:5145/.well-known/oauth-protected-resource
curl http://localhost:5145/.well-known/oauth-authorization-server
```

## Roteiro com MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```
Transport "Streamable HTTP", URL `http://localhost:5145/mcp` → "Open Auth Settings" → "Quick OAuth
Flow".

| # | Passo | Esperado | Ref. |
|---|---|---|---|
| 1 | Iniciar o fluxo | Inspector se registra sozinho e abre `localhost:8080/autorizar?pedido=…` | US1-1 |
| 2 | Sem sessão | Vai ao login e volta para a autorização após entrar | US1-2 |
| 3 | Tela de autorização | Nome "MCP Inspector", host de retorno, duas opções de permissão | FR-006/007 |
| 4 | Autorizar com "Consultar e fazer alterações" | Inspector conectado; `tools/list` mostra 38 ferramentas | US1-3 |
| 5 | `saldo_total` | Igual ao total da Home | US2-1 |
| 6 | `extrato_carteira` com `limite=5` e cursores | Páginas sem repetir/pular; saldos inicial/final iguais ao app | US2-2/3 |
| 7 | `registrar_despesa` (R$ 80,00) com `chave_repeticao=abc` duas vezes | Um único lançamento; app mostra saldo novo | US3-1/3 |
| 8 | `registrar_despesa` com valor maior que o saldo | Erro `regra_de_negocio` com a mesma mensagem do app | US3-4 |
| 9 | `obter_carteira` com id de outra conta | `nao_encontrado`/`sem_permissao`, sem dados | US2-5 |
| 10 | Reconectar escolhendo só "Consultar" e chamar `registrar_despesa` | `permissao_insuficiente`; nada lançado | US3-6 |
| 11 | App → Conta → Assistentes conectados | Uma conexão "MCP Inspector", "Só consulta", último uso recente | US4-1 |
| 12 | Desconectar e chamar `saldo_total` no Inspector | 401 em até 5 s; renovação também recusada | US4-2, SC-004 |
| 13 | Negar na tela de autorização | Inspector recebe `access_denied` | US1-4 |
| 14 | Abrir `/autorizar?pedido=…` antigo (> 10 min) | "Este pedido de autorização venceu…" | edge |
| 15 | `listar_notificacoes` + `aceitar_convite` (conta convidada) | Família aparece no app; responsável notificado | US5-1/2 |

## Claude Code

```bash
claude mcp add --transport http finami http://localhost:5145/mcp
```
Em `/mcp`, autenticar `finami` → mesma tela de autorização → perguntar "qual meu saldo total no
Finami?".

## Produção

Depois do deploy: adicionar `https://{DOMAIN}/mcp` como conector personalizado no claude.ai
(Configurações → Conectores) e repetir os passos 3–5 e 11–12.

## Banco

```sql
select status, count(*) from oauth_grants group by 1;
select token_type, count(*) from oauth_tokens where revoked_at is null and expires_at > now() group by 1;
select tool_name, outcome, count(*) from mcp_audit_logs group by 1, 2;
```
