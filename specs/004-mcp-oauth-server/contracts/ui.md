# Contrato de UI — Autorização de assistentes (feature 004)

Mockups: **ux-designer** (`docs/design/mockups/oauth-consent.html`,
`account-connections.html`). Implementação: **frontend-react-developer**. Textos em pt-BR via
i18n (namespace `oauth`). Princípio IX vale para tudo.

## Tela `/autorizar?pedido={requestKey}` (fora das abas, layout `AuthLayout`)

| Estado | Conteúdo |
|---|---|
| Sem sessão | Redireciona ao login com retorno para `/autorizar?pedido=…` |
| Carregando | Esqueleto + `aria-busy` |
| Pronto | Logo Finami · título "**{Assistente}** quer acessar sua conta" · linha "Você vai voltar para {redirectHost}" · conta atual ("Entrando como Ana Silva · Trocar de conta") · grupo de rádio "O que o assistente pode fazer": **Consultar** ("Ver saldos, carteiras, extratos, família e notificações") e **Consultar e fazer alterações** ("Também lançar receitas, despesas e transferências, gerenciar carteiras, família e convites") — padrão = o que foi pedido · aviso "Você pode desconectar quando quiser em Conta → Assistentes conectados." · botões **Autorizar** (primário) e **Negar** |
| Enviando | Botões desabilitados, `aria-live` "Conectando…" |
| Vencido/inexistente (404/410) | Ícone de alerta, mensagem da API e "Volte ao assistente e tente conectar de novo." Sem botões de ação. |
| Erro de rede | Banner com "Tentar de novo" |

Após Autorizar/Negar: `window.location.assign(redirectUrl)`; antes, texto "Voltando para
{redirectHost}…". Se só `finami:read` foi pedido, o rádio "alterações" não aparece.
"Trocar de conta" faz logout e volta ao login mantendo o retorno.

## Conta → seção "Assistentes conectados"

- Título da seção + texto "Assistentes de IA que podem acessar sua conta pelo MCP."
- Lista: nome do assistente, selo "Só consulta" ou "Consulta e alterações", "Conectado em 01/11/2026",
  "Último uso há 5 min" (ou "Ainda não usado"), botão "Desconectar" (aria-label "Desconectar
  {nome}") → `ConfirmModal` "Desconectar {nome}? O assistente perde o acesso na hora." → toast
  "{nome} desconectado.".
- Com 2+ conexões: botão "Desconectar todos" com confirmação.
- Vazia: "Nenhum assistente conectado." + "Para conectar, adicione este endereço no seu assistente
  (ex.: Claude → Conectores):" + campo somente leitura com `mcpUrl` e botão "Copiar" (toast
  "Endereço copiado.").

## Página de erro do `/oauth/authorize` (HTML da API, sem JS)

Fundo escuro do app, logo, "Não foi possível conectar este assistente." e o motivo
("Endereço de retorno não autorizado." / "Assistente não registrado."). `lang="pt-BR"`, contraste AA.

## Testes esperados (Vitest + axe)

`/autorizar`: sem sessão redireciona; mostra nome/host/escopos; escolher "Consultar" envia só
`finami:read`; Negar chama deny e redireciona; 410 mostra mensagem sem botões; axe sem violações.
Conta: lista, desconectar com confirmação, desconectar todos, estado vazio com copiar; axe.
