# Revisão de design — telas da feature 004 × mockups (T062)

Feature `004-mcp-oauth-server` · direção **Noite Roxa** · referência:
[`mockups/oauth-consent.html`](./mockups/oauth-consent.html),
[`mockups/account-connections.html`](./mockups/account-connections.html),
[`mockups/oauth-error.html`](./mockups/oauth-error.html), especificação em [`components.md` §8](./components.md),
textos em `specs/004-mcp-oauth-server/contracts/ui.md`, Princípio IX (WCAG 2.1 AA) de
`.specify/memory/constitution.md`. Consumo: `frontend-react-developer` (itens de `.tsx`/`.ts`) e
`dotnet-senior-developer` (observação do backend).

## Como foi feita

- **Revisão estática** do código contra mockup + spec, linha a linha (o app React não foi executado nesta
  revisão):
  - `frontend/src/pages/AuthorizePage.tsx` (e `hooks/useOAuthRequest.ts`);
  - `frontend/src/components/account/ConnectedAssistants.tsx` e sua posição em `pages/AccountPage.tsx`;
  - `frontend/src/i18n/pt-BR.json` (namespace `oauth`) contra `contracts/ui.md` e os textos *(proposta)* do §8;
  - componentes compartilhados alterados: `components/ui/Badge.tsx`, `ConfirmModal.tsx`, `variants.ts`
    (e os usados por eles: `Button`, `Banner`, `Modal`, `TextField`, `Avatar`, `Skeleton`, `listRow`).
- **Página de erro da API**: `backend/Finami.API/Resources/oauth-error.html` comparada por `diff` com o mockup
  (a única diferença é o marcador `{{REASON}}`) e renderizada no Chrome headless (DevTools Protocol) em
  **320 × 640, 390 × 844 e 1440 × 900** com o motivo "Endereço de retorno não autorizado.": sem rolagem
  horizontal (`scrollWidth` = largura da janela), título em 3 linhas a 320 px, cartão de 288/358/384 px.
  Uso no `OAuthController` conferido (CSP `default-src 'none'; style-src 'unsafe-inline'; img-src data:`,
  `no-store`, `HtmlEncoder.Default.Encode` no motivo).
- **Contraste** recalculado com os tokens de `frontend/src/index.css` (fórmula WCAG): todos os pares de texto do
  §8 batem com a spec (ver tabela abaixo). Nenhum token novo.
- Não verificável sem executar o app: comportamento real de foco quando um botão focado fica `disabled`
  (B-8) e o anel em foco programático — registrados como "conferir no navegador".

Severidade: **alta** = quebra de layout, informação perdida ou falha de acessibilidade; **média** = divergência
visível do mockup ou da regra de design, ou falha de a11y em fluxo secundário; **baixa** = acabamento.

**Resultado: nenhum item de severidade alta.** 3 médios, 8 baixos, 1 observação de backend.

---

## 1. Resumo — o que está fiel

| Área | Verificado |
|---|---|
| Rota e moldura | `/autorizar` fora do `RequireAuth`/abas (`routes.tsx:30`), `AuthLayout` do login, sem TabBar/Sidebar/Fab. Sem sessão → `<Navigate to="/entrar">` com `from` incluindo `search` (`?pedido=…` preservado). `lang="pt-BR"` e viewport sem bloqueio de zoom (`index.html`). |
| Cabeçalho | Logo `h-12` em cápsula `rounded-[12px] bg-brand`, `mt-2 mb-7`. `<h1>` `font-display 28/34 font-normal` com `<b class="font-bold">{clientName}</b>` + " quer acessar sua conta", `[overflow-wrap:anywhere]`. Linha do host com `ExternalLink` 16 px `aria-hidden` e host em `font-semibold text-text` quebrável. |
| AccountCard | `flex flex-wrap min-h-16 bg-surface rounded-lg py-2 pr-1 pl-4`, avatar 40 px `aria-hidden`, "Entrando como" `whitespace-nowrap`, "Trocar de conta" `ghost sm ml-auto px-3` (44 px, `accent`/`surface` 10,91:1), desabilitado durante o envio. Logout mantém o retorno. |
| ScopeChoice (write) | `<fieldset>` + `<legend>` no estilo de cabeçalho; rádios **nativos** `sr-only` dentro de `<label>` (1 parada de Tab, setas trocam); círculo 22 px `aria-hidden`, marcado `bg-accent` + `Check` 14 px traço 3; padrão = o que foi pedido; anel `has-[input:focus-visible]` com `outline-offset-[-2px] rounded-[12px]`; separador recuado 16 px igual ao mockup. Envio `["finami:read"]` / `["finami:read","finami:write"]`. |
| ScopeChoice (só read) | Sem rádio; `<section aria-labelledby>` + `<h2>` "O que o assistente vai poder fazer"; item estático com tile 32 px `bg-info-soft text-info` + `Eye` (6,94:1); rodapé "O assistente pediu só para consultar. Ele não poderá fazer alterações.". |
| Aviso e ações | `Banner info` com `ShieldCheck` e trecho "Conta → Assistentes conectados" em negrito inline (`<Trans>`); Autorizar `submit` primário + Negar secundário, empilhados, `block` (48 px). |
| Envio / voltando | Autorizar em loading com rótulo **visível** "Conectando…" (`on-accent`/`accent-pressed` 8,19:1), `aria-busy`; `fieldset disabled`. Região `role="status" aria-live="polite"` **sempre montada**; no "Voltando" a mesma região vira a linha visível com spinner `motion-safe:animate-spin` + "Voltando para {host}…" e só então `location.assign`. |
| Erro ao enviar | `Banner error role="alert"` acima das ações (`WifiOff` em erro de rede), escolha preservada, botões reabilitados e **foco devolvido ao botão tocado** (`AuthorizePage.tsx:146-150`). 404/410 durante o envio levam ao estado terminal. |
| 404 / 410 / sem `pedido` | Contêiner `role="alert"`, círculo 72 px `bg-warning-soft text-warning` (9,76:1) + `TriangleAlert` 36 px, `<h1 text-title-3>` com a frase por status e instrução `max-w-[34ch]`; sem botões; sem `pedido` não chama a API. |
| Carregando (consentimento) | Logo real + skeletons no formato da tela, contêiner `aria-busy`, "Carregando…" `sr-only`, blocos `aria-hidden` (no próprio `Skeleton`). |
| Seção na Conta | Posição correta: entre "Segurança" e "Pessoas que cadastrei" (`AccountPage.tsx:260-263`). `<section aria-labelledby aria-describedby>`, `<h2>` no estilo das demais seções, linha de apoio `-mt-1 mb-2 px-4 text-footnote text-text-muted`. Carrega sozinha. |
| ConnectionItem | `<li>` `flex-wrap items-start px-4 pt-3.5 pb-1.5` → `md:flex-nowrap md:items-center md:py-3 md:pr-2`; tile 36 px `rounded-[10px] bg-surface-2 text-accent` + `Bot` 20 px `aria-hidden`; `<h3>` com nome quebrável; selo; meta com `<time dateTime>` ISO e separador `aria-hidden`; "Desconectar" `DestructiveGhost sm px-4` em `basis-full pl-8` (texto alinhado ao nome; 64 px = 16 + 36 + 12), `aria-label="Desconectar {nome}"` (começa pelo texto visível, WCAG 2.5.3) e `aria-haspopup="dialog"`. Separador recuado 64 px (`.list-row.has-icon`). |
| ScopeBadge | Variantes novas em `variants.ts`/`Badge.tsx`: "Consulta e alterações" `bg-warning-soft text-warning` + `Pencil` (9,76:1), "Só consulta" `bg-surface-3 text-text-muted` + `Eye` (7,05:1); ícone 12 px + texto (nunca só cor). |
| Desconectar todos | Só com 2+; lista própria `mt-4`, `<button>` `listRowClasses` 44 px com `Unplug` 20 px + texto `text-negative` (7,76:1), `aria-haspopup="dialog"`, anel interno. |
| ConfirmModal | `role="alertdialog"`, `TriangleAlert` no título, foco inicial em "Cancelar", Esc/scrim bloqueados durante o envio; nova prop `loadingLabel` mostra "Desconectando…"; erro mantém o modal aberto e a lista intacta; toasts "{nome} desconectado." / "Assistentes desconectados.". |
| Foco após desconectar | Vai para o "Desconectar" do item que ocupou a posição (ou do anterior); sem itens, para o `<h3 tabIndex={-1}>` "Nenhum assistente conectado." (`ConnectedAssistants.tsx:72-86`). O `Modal` não tem animação de saída, então o retorno de foco do Radix não disputa com o `setTimeout`. |
| Vazio + copiar | Cartão `bg-surface rounded-lg p-4`, `TextField` com `<label>` visível "Endereço do MCP", `readOnly`, `font-mono text-body` (17 px), `spellCheck={false}`, seleciona tudo ao focar, visual de campo comum mantido (`read-only:border-border! read-only:bg-surface-2!`); "Copiar" `secondary sm` + `Copy`, `aria-label="Copiar endereço do MCP"`; falha da área de transferência foca/seleciona o campo e mostra o toast de erro. Ordem de foco campo → Copiar. |
| Textos pt-BR | Namespace `oauth` idêntico ao contrato e às propostas do §8; acentos corretos ("Você", "Não", "família", "alterações", "Endereço", "Só", "Último", "será"); reticências tipográficas (`…`) e travessão (`—`) em `documentTitle`. **Linguagem neutra**: nenhum texto se refere à pessoa usuária com gênero ("Entrando como", "Você vai voltar", "Você pode desconectar"); a concordância masculina em "{nome} desconectado." e "Conectado em" refere-se a *o assistente*, não a pessoas — aceito. |
| Página de erro da API | Idêntica ao mockup (só o motivo é variável), `lang="pt-BR"`, `color-scheme: dark`, `noindex`, sem JS nem recurso externo, CSP aplicada pelo controller, motivo sempre codificado. Contrastes do comentário conferidos (18,74 · 17,50 · 9,43 · 8,81 · 6,71 · 15,12). Sem elementos interativos. |
| Movimento | Todos os spinners e o shimmer com `motion-safe:`. |

### Contrastes recalculados (tokens de `index.css`)

| Par | Razão | Mínimo |
|---|---|---|
| `text-muted` / `surface` (descrições, meta) | 8,81 | 4,5 |
| `accent` / `surface` ("Trocar de conta") | 10,91 | 4,5 |
| `border` / `surface` (círculo do rádio, borda do campo) | 3,93 | 3,0 |
| `focus` / `surface` · / `surface-3` (anel) | 9,92 · 7,94 | 3,0 |
| `info` / `info-soft` (aviso, tile `Eye`) | 6,94 | 4,5 |
| `warning` / `warning-soft` (selo write, alerta 410) | 9,76 | 4,5 |
| `text-muted` / `surface-3` (selo "Só consulta") | 7,05 | 4,5 |
| `negative` / `surface` ("Desconectar") | 7,76 | 4,5 |
| `negative` / `negative-soft` (faixas de erro) | 6,71 | 4,5 |
| `text` / `surface-2` (campo do endereço) | 16,02 | 4,5 |
| `text-disabled` / `surface-2` (botões desabilitados) | 3,58 | isento (1.4.3) |

---

## 2. Ajustes

1. **M-1 · média · "Tentar de novo" some ao ser acionado e o foco cai no `<body>`** —
   `pages/AuthorizePage.tsx:154` e `:170-178` (com `hooks/useOAuthRequest.ts:41-42`);
   `components/account/ConnectedAssistants.tsx:51-57`, `:145-184`.
   Ao tocar "Tentar de novo", `load()` zera o erro e liga `loading`; a tela troca a faixa pelos skeletons e o
   botão focado é desmontado. Quem usa teclado ou leitor de tela perde a posição (WCAG 2.4.3) e, se o GET falhar
   de novo, a nova faixa aparece sem foco em nada. O mockup (`c-net-load` e `k-error`) pede o **próprio botão em
   loading "Carregando…"** com a faixa no lugar.
   Ajuste: manter o estado de erro montado durante a nova tentativa e usar
   `<Button loading={retrying} loadingLabel={t("app.loading")}>`. No hook, limpar `error` só no sucesso (não no
   início do `load`) e trocar a condição da página para `if (loading && !request && !error)`; na seção da Conta,
   um `retrying` local que mantém o ramo `loadError` visível enquanto `loadConnections()` roda. Se a nova
   tentativa der certo, o conteúdo entra normalmente; se falhar, o foco continua no botão.
2. **M-2 · média · rádios desabilitados não parecem desabilitados** — `pages/AuthorizePage.tsx:308-338`.
   Durante "Conectando…/Negando…/Voltando" o `<fieldset disabled>` bloqueia os rádios, mas a linha continua
   com o texto em `text`/`text-muted`, o círculo cheio e o `hover:bg-surface-3` ainda acende sob o ponteiro.
   O mockup (`c-sending`, `c-redirecting`; `mockup.css` `.opt:has(input:disabled)`) apaga título e descrição
   para `text-disabled`, o círculo com `opacity: .5` e tira o hover. Ajuste nas classes do `<label>`:
   `has-[input:disabled]:hover:bg-transparent`; no título e na descrição,
   `group-has-[input:disabled]:text-text-disabled` (com `group` no label) ou condicional por `busy`; no círculo,
   `group-has-[input:disabled]:opacity-50`. Contraste `text-disabled`/`surface` 3,91 (isento por estar desabilitado).
3. **M-3 · média · estado vazio sem o endereço quando o GET do MCP demora ou falha** —
   `components/account/ConnectedAssistants.tsx:66-69` e `:193-215`.
   `loadMcpInfo().catch(() => undefined)` engole o erro e o bloco só renderiza o campo com `mcpUrl` presente:
   enquanto carrega, o cartão diz "adicione este endereço no seu assistente…:" seguido de nada; se falhar, fica
   assim para sempre, sem aviso nem nova tentativa — a única informação útil do estado vazio se perde.
   Ajuste: enquanto `mcpUrl` for `null` e a busca estiver em andamento, mostrar um `Skeleton` com a altura do
   campo (`h-12` + rótulo) dentro de um contêiner `aria-busy`; em erro, `Banner tone="error" role="alert"`
   "Não foi possível carregar o endereço do MCP." + `Button secondary sm` "Tentar de novo" (`RotateCw`)
   — chave nova `oauth.connections.mcpLoadError` *(proposta)*.
4. **B-1 · baixa · "Tentar de novo" fora da faixa** — `AuthorizePage.tsx:162-178`,
   `ConnectedAssistants.tsx:148-164`. Nos mockups o botão fica **dentro** da faixa de erro, abaixo do texto; no
   código ele vem depois do `Banner`, com `mt-3`. Funciona, mas separa a ação do aviso. Ajuste: passar o
   botão como parte de `children` do `Banner` (`<>{texto}<Button … className="mt-2" /></>`). Fazer junto com M-1.
5. **B-2 · baixa · rótulo de loading cinza em botões que não são primários** — `ui/Button.tsx:60` e `:74-76`,
   usado por `AuthorizePage.tsx:394-404` ("Negando…") e `ui/ConfirmModal.tsx:80-89` ("Desconectando…").
   O estilo "ocupado" (`disabled:bg-accent-pressed disabled:text-on-accent`) só existe para `primary`; nos demais
   o botão em loading cai no visual de desabilitado (`text-disabled`/`surface-2` 3,58:1) e o destrutivo perde o
   vermelho, ficando igual ao "Cancelar" desabilitado ao lado. É isento por estar desabilitado, mas o texto é o
   próprio aviso de progresso. Ajuste no `Button` (componente compartilhado): estilo ocupado por variante —
   `destructive`: `disabled:bg-negative disabled:text-on-accent disabled:opacity-80 disabled:cursor-progress`
   (`on-accent`/`negative` 8,31:1); `secondary`: `disabled:bg-surface-3 disabled:text-text-muted
   disabled:cursor-progress` (7,05:1). Vale para todos os usos de `loadingLabel`.
6. **B-3 · baixa · "Copiar" 4 px mais baixo que o campo no desktop** — `ConnectedAssistants.tsx:194` e
   `:205-213`. Com `items-end`, o botão `sm` (44 px) alinha pela base do campo (48 px) e o topo fica desnivelado;
   no mockup (`.copy-row`, `align-items: stretch`) os dois têm 48 px. Ajuste: `className="md:min-h-12"` no
   botão (no celular ele fica abaixo, sem efeito).
7. **B-4 · baixa · "Último uso há 5 min." e "Último uso agora"** — `utils/dates.ts:253-274`.
   Com `style: "short"`, o `Intl.RelativeTimeFormat("pt-BR")` devolve "há 5 min." (ponto de abreviação no meio
   da linha de meta, parece fim de frase) e, abaixo de 1 minuto, "agora" — "Último uso agora" soa truncado.
   Ajuste: `style: "long"` ("há 5 minutos", "há 2 horas", "ontem", "há 3 dias"; cabe em 320 px porque a meta
   quebra) e, para < 1 min, "Último uso agora há pouco" (chave `oauth.connections.lastUsedJustNow`
   *(proposta)*). O teste `ConnectedAssistants.test.tsx:69` (`/Último uso há 5 min/`) continua passando.
8. **B-5 · baixa · peso de "Desconectar todos"** — `ConnectedAssistants.tsx:293`. Código em `font-semibold`;
   mockup em regular (`.disconnect-all .row { font-weight: 400 }`). O código segue o "Sair" da mesma página
   (`AccountPage.tsx:302`, também `font-semibold`), então **sem ajuste no código** — a correção é no mockup,
   no próximo ciclo de design.
9. **B-6 · baixa · `document.title` só é definido no estado pronto** — `AuthorizePage.tsx:131-138`.
   Carregando, erro de rede e 404/410 ficam com o título genérico "Finami" (WCAG 2.4.2: título deve descrever a
   página). Ajuste: sem `request`, usar `t("oauth.pageTitle")` + " — Finami" ("Autorizar assistente — Finami").
10. **B-7 · baixa · acabamentos de espaçamento** —
    `ConnectedAssistants.tsx:233-235`: tile sem o `margin-top: 2px` do mockup (`.conn .wicon`) — usar `mt-0.5`
    para alinhar o ícone ao `<h3>` de 22 px no celular;
    `AuthorizePage.tsx:79`: círculo do estado terminal com `mb-5` (20 px); no mockup são 16 px
    (`gap 8` + `margin-bottom 8`) — usar `mb-4`;
    `AuthorizePage.tsx:96-97`: skeleton do título `h-8` (32 px) × 2 em `w-full`/`w-2/3`; mockup 28 px em
    88 % / 52 % — usar `h-7 w-[88%]` e `h-7 w-[52%]` para não "pular" na troca pelo `<h1>` de 34 px.
11. **B-8 · baixa (conferir no navegador) · foco quando a confirmação falha** — `ui/ConfirmModal.tsx:51-58`.
    O botão de confirmar recebe `disabled` durante o `loading`; se o navegador tirar o foco dele, um erro da API
    deixa o modal aberto sem nada focado (o `AuthorizePage` já trata isso para Autorizar/Negar). O jsdom não
    reproduz. Ajuste preventivo: `ref` no botão de confirmar e, no `catch` de `handleConfirm`, devolver o foco a
    ele.

### Observação fora do escopo do front (backend)

- **Motivo da página de erro sai com entidades numéricas** — `Finami.API/Controllers/OAuthController.cs:237`.
  `HtmlEncoder.Default` só deixa passar Basic Latin; conferido com `dotnet fsi`:
  `"Assistente não registrado."` → `"Assistente n&#xE3;o registrado."`. O navegador mostra o texto certo (sem
  impacto visual ou de leitor de tela), mas o teste `Finami.Tests/API/McpOAuthFlowTests.cs:323`
  (`html.Should().Contain("Assistente não registrado.")`) compara o HTML cru e tende a falhar. Sugestão para o
  `dotnet-senior-developer`: `HtmlEncoder.Create(UnicodeRanges.All).Encode(reason)` (mantém o escape de
  `< > & " '`) ou decodificar no teste. Não alterado nesta revisão.

### Prioridade sugerida para o `frontend-react-developer`
M-1 (com B-1) → M-3 → M-2 → B-2 → demais baixos.
