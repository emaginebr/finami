# Revisão de design — telas da feature 005 × mockups (T053)

Feature `005-pwa-webapp` · direção **Noite Roxa** · referência:
[`mockups/pwa-states.html`](./mockups/pwa-states.html), especificação em [`components.md` §9](./components.md),
textos e comportamento em `specs/005-pwa-webapp/contracts/ui.md`, Princípio IX (WCAG 2.1 AA) de
`.specify/memory/constitution.md`. Consumo: `frontend-react-developer` (todos os itens são `.tsx`/`.ts`/`.json`).

## Como foi feita

- **Revisão estática** do código contra mockup + spec + contrato, linha a linha (o app não foi executado nesta
  revisão; o build em `frontend/dist` não foi servido):
  - `components/pwa/`: `OfflineBanner`, `UpdatePrompt`, `InstallAppItem`, `InstallIosSheet`, `InstallInvite`,
    `OfflineContent`; `pages/OfflinePage.tsx`;
  - `components/layout/`: `AppShell`, `Fab`, `TabBar`, `LargeTitleHeader`, `RequireAuth` (e `AuthLayout`, onde o
    `UpdatePrompt` também aparece);
  - `hooks/useOnlineAction.ts`, `useCssHeightVar.ts`, `useAppUpdate.ts` (e `Contexts/InstallContext.tsx`,
    `Contexts/ConnectivityContext.tsx`, `utils/notify.ts`, que definem o comportamento dos componentes acima);
  - `components/ui/Button.tsx`, `SectionHeaderAction.tsx`, `Modal.tsx`, `Sheet.tsx`;
    `components/wallet/BalanceHero.tsx`; `index.css`; `index.html`; `main.tsx` (`Toaster`);
  - `i18n/pt-BR.json` (namespace `pwa`) contra `contracts/ui.md` e os textos *(proposta)* do §9;
  - uso nas páginas: `HomePage.tsx` (convite, `OfflineContent`), `AccountPage.tsx` (seção "App").
- **Contraste** recalculado com os tokens de `frontend/src/index.css` (fórmula WCAG). Nenhum token novo.
- Não verificável sem executar o app: queda de foco em botão que fica `disabled` durante `loading`
  (B-3) e a posição real do `UpdatePrompt` sobre o conteúdo no desktop (M-6) — registrados como "conferir no
  navegador".

Severidade: **alta** = quebra de layout, informação perdida ou falha de acessibilidade no fluxo principal;
**média** = divergência visível do mockup ou da regra de design, ou falha de a11y em fluxo secundário;
**baixa** = acabamento.

**Resultado: 1 item alto, 7 médios, 7 baixos.** Os dois pontos que o desenvolvedor já sabia que estavam
pendentes (convite e folha do iOS) estão em M-2, M-3 e M-4, com a prioridade explicada no fim.

---

## 1. Resumo — o que está fiel

| Área | Verificado |
|---|---|
| OfflineBanner | Região `role="status" aria-live="polite"` **sempre montada** no `AppShell`, só o conteúdo entra/sai; sem foco, sem botões. `sticky top-0 z-30`, fundo `bg-warning-soft` + `border-b border-warning/30`, sobe por baixo da barra de status (`-mt`/`pt` de `safe-area-inset-top`) e sangra até as bordas com o mesmo `max(gutter, inset)` do conteúdo (iPhone deitado). Desktop `md:top-4 md:rounded-lg md:border md:mb-4`. `WifiOff` 16 px `text-warning` `aria-hidden`; "Sem internet" em semibold; separador "·" `aria-hidden` + vírgula `sr-only`; data em `<time dateTime>`; `min-h-9` (cresce com zoom, nunca trunca). Entrada `motion-safe:animate-fade-in`. Aparece após 2 s (`OFFLINE_BANNER_DELAY_MS`), toast "Conexão restabelecida." com `Wifi` em `text-positive` só se a faixa chegou a aparecer. |
| Variáveis de altura | `useCssHeightVar` publica `--offline-banner-h` / `--update-prompt-h` no `<html>` via `ResizeObserver`, volta a `0px` ao sumir. Usadas no `padding-bottom` do `main`, no FAB, no `mobileOffset` do `Toaster` e no `scroll-padding` do `<html>` (o foco nunca fica atrás da faixa nem do cartão — bom acréscimo ao §9). |
| Fab offline | `aria-disabled="true"` (focável, anunciado), `aria-haspopup`/`aria-expanded` mantidos; visual `bg-surface-2 text-text-disabled border border-border shadow-none cursor-not-allowed`, sem hover/active/scale; toque → toast "Sem internet. Conecte-se para fazer lançamentos." com `WifiOff` `text-warning`. Sobe com o `UpdatePrompt` no celular (`+ var(--update-prompt-h) + 12px`), parado no desktop. |
| `useOnlineAction` | Padrão único (`offlineProps` + `guard`/`blockIfOffline`) aplicado em `AccountPage`, `WalletsPage`, `GroupPage`, `MemberPage`, `WalletStatementPage`, `TransactionSheet`, `TransactionDetailSheet`, `MemberManager`, `AddMemberSheet`, `PendingInvitations`, `NotificationItem`, `ConnectedAssistants`; textos "…lançamentos." / "…alterações." conforme o tipo. `Button` e `SectionHeaderAction` ganharam o estado `aria-disabled:` com o visual de desabilitado das regras comuns. |
| OfflineContent | Anatomia do `ErrorState`, `role="status"`, círculo 72 px `bg-surface-2 text-text-muted` + `WifiOff` 36 px, `<h2 text-headline>`, apoio `text-subhead text-text-muted max-w-[32ch]`, `Button secondary sm` com `RotateCw` "Tentar de novo" e prop `retrying` (mas ver M-5). |
| OfflinePage | Tela inteira fora do `AppShell`, `min-h-dvh grid place-items-center`, áreas seguras, `Logo h-14` (contêiner `rounded-lg overflow-hidden bg-brand` do próprio `Logo`), círculo 64 px `bg-warning-soft text-warning` + `WifiOff` 30 px `aria-hidden`, `<h1 tabIndex={-1}>` com foco inicial, texto `max-w-[30ch]`, `Button primary` "Tentar de novo". Mostrada pelo `RequireAuth` só sem sessão **e** offline; login/cadastro offline seguem com o erro de rede atual. |
| UpdatePrompt | Região `role="status"` sempre montada, `aria-labelledby` no texto, não move o foco; cartão `rounded-[14px] border border-border bg-surface-3 p-3 pl-3.5 shadow-modal motion-safe:animate-modal-in`, `RefreshCw` 20 px `text-accent`, "Agora não" `ghost sm` + "Atualizar" `primary sm` (44 px). Posição celular/desktop igual ao §9; "Atualizando…" com spinner `motion-safe:animate-spin`. Verificação a cada hora e ao voltar à aba, sem buscar offline. |
| InstallAppItem | Seção "App" entre "Pessoas que cadastrei" e "Sair" (`AccountPage.tsx:310`), some inteira quando não há o que instalar. Linha de 2 linhas `listRowClasses({ twoLines, withIcon, interactive })`, quadrado 30 px `bg-accent text-on-accent` + `Download` 18 px (11,68:1), sem chevron, `aria-describedby` na descrição, `aria-haspopup="dialog"` só no iOS. |
| `index.html` | `lang="pt-BR"`, `viewport-fit=cover` sem bloqueio de zoom, `theme-color #12021C`, `black-translucent`, 18 `apple-touch-startup-image` colados de `splash-links.txt`, manifest injetado pelo plugin. |
| BalanceHero | Cotação vinda do cache mostra "cotação de 01/11 às 18:42" em `<time dateTime>` ISO, mantendo o selo "desatualizada". |
| Textos pt-BR | Namespace `pwa` com acentos corretos e reticências tipográficas ("Atualizando…"). Divergências de texto em M-2, M-4 e B-5. |
| Movimento | Faixa, cartão, spinners e modal com `motion-safe:`; nada desliza ao entrar. |

### Contrastes recalculados (tokens de `index.css`)

| Par | Razão | Mínimo |
|---|---|---|
| `text` / `warning-soft` (texto da faixa) | 13,47 | 4,5 |
| `warning` / `warning-soft` (`WifiOff`, "·") | 9,76 | 3,0 (ícone) |
| `focus` / `warning-soft` (anel sobre a faixa, se algo focado passar por ela) | 7,63 | 3,0 |
| `text` / `surface-3` ("Nova versão disponível") | 14,01 | 4,5 |
| `accent` / `surface-3` (`RefreshCw`, "Agora não") | 8,73 | 4,5 |
| `on-accent` / `accent` ("Atualizar", tile do item "App") | 11,68 | 4,5 |
| `border` / `bg` (borda do cartão e do FAB offline) | 4,21 | 3,0 |
| `text-disabled` / `surface-2` (FAB e botões offline) | 3,58 | isento (1.4.3) |
| `muted` / `surface-2` (`OfflineContent`) | 8,06 | 4,5 |
| `muted` / `surface` (descrições do convite e do item) | 8,81 | 4,5 |
| `accent` / `surface-2` (ícones da folha do iOS, como está hoje) | 9,98 | 3,0 |
| `info` / `info-soft` · `on-accent` / `info` (ilustrações e selo pedidos em M-3) | 6,94 · 8,92 | 3,0 · 4,5 |

---

## 2. Ajustes

1. **A-1 · alta · o diálogo nativo de instalação faz o item da Conta e o convite da Home sumirem — e o foco
   cai no `<body>`** — `Contexts/InstallContext.tsx:106-110`, `:128-130`; efeito em
   `components/pwa/InstallAppItem.tsx:24` e `components/pwa/InstallInvite.tsx:24`.
   `promptInstall` faz `setDeferredPrompt(null)` **antes** de `prompt()`. Fora do iOS isso zera
   `canPromptNative` → `canInstall` e `showInvite` ficam `false` no mesmo instante: a seção "App" e o cartão
   da Home são desmontados enquanto o diálogo do Chrome/Edge ainda está aberto. Consequências: (a) o botão
   tocado some e, quando o diálogo fecha, o foco está no `<body>` (WCAG 2.4.3), aceitando ou não; (b) se a
   pessoa toca "Cancelar" no diálogo do navegador, **as duas entradas de instalação desaparecem até recarregar
   a página**, o que contraria o contrato ("Oculto quando instalado ou sem suporte") e FR-022; (c) com
   instalação aceita, o §9 pede foco no "Sair" (Conta) e no próximo elemento da Home — não acontece.
   Ajuste:
   - No contexto, só descartar o evento depois da escolha:
     `await deferredPrompt.prompt(); const choice = await deferredPrompt.userChoice; setDeferredPrompt(null);`
     (o `prompt()` duplo já é impedido porque o diálogo nativo é modal). Assim o item continua montado e o
     navegador devolve o foco ao botão.
   - Recusa no diálogo: no **convite**, tratar como dispensa (`dismissInvite()`), porque a pessoa já disse
     "agora não"; no **item da Conta**, manter a linha visível na sessão com um estado
     `nativePromptUsed` (`canInstall = !isInstalled && (canPromptNative || isIos || nativePromptUsed)`) e,
     ao tocar sem evento disponível, mostrar o toast informativo
     **"Use o ícone de instalar na barra de endereço ou o menu do navegador."** — chave nova
     `pwa.install.browserMenuHint` *(proposta)*. Se o Chrome disparar `beforeinstallprompt` de novo, o item
     volta ao diálogo nativo.
   - Quando o item/convite sair (aceito, ou convite recusado), mover o foco antes do desmonte com o helper de
     M-1 (Conta → botão "Sair"; Home → primeiro cabeçalho de seção).
2. **M-1 · média · dispensar o convite derruba o foco** — `components/pwa/InstallInvite.tsx:55-62`.
   O "X" chama `dismissInvite()`; o cartão é desmontado com o próprio botão focado e o foco vai para o
   `<body>` (WCAG 2.4.3). O §9 pede o foco no próximo elemento focável (primeiro cabeçalho de seção da Home).
   Ajuste: `ref` na `<section>` e, no clique, achar o próximo focável **antes** de dispensar:
   ```ts
   const next = Array.from(document.querySelectorAll<HTMLElement>(
     'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
   )).find((el) => !section.contains(el) &&
     section.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
   dismissInvite();
   requestAnimationFrame(() => (next ?? document.getElementById("conteudo"))?.focus());
   ```
   Extrair como `utils/focus.ts` (`focusNextAfter(element)`) para reusar em A-1 (convite e item da Conta).
3. **M-2 · média · passos do iOS incompletos e errados no iOS 26; título "iPhone" no iPad** —
   `components/pwa/InstallIosSheet.tsx:26-30`, `:44`; `i18n/pt-BR.json:491-495`.
   (a) "Toque em **Compartilhar** na barra do navegador." está errado no Safari do iOS 26, em que o
   Compartilhar fica dentro do menu ⋯ — é exatamente o passo em que a pessoa se perde. Faltam as linhas de
   ajuda do §9 (texto/tarefa). (b) No iPad o título continua "Instalar no iPhone" (texto incorreto;
   `InstallContext` só expõe `isIos`). (c) Passo 3 sem "no canto superior direito".
   Ajuste de textos (chaves novas marcadas):
   - `iosIntro`: "No Safari, são 3 toques para ter o Finami na tela de início."
   - `iosStepShare`: "Toque em <b>Compartilhar</b>." + `iosStepShareHint` *(nova)*: "Fica na barra do Safari;
     no iOS 26, dentro do menu ⋯."
   - `iosStepAddToHome`: "Toque em <b>Adicionar à Tela de Início</b>." + `iosStepAddToHomeHint` *(nova)*:
     "Role a lista se não aparecer de cara."
   - `iosStepConfirm`: "Toque em <b>Adicionar</b>, no canto superior direito."
   - `iosTitleIpad` *(nova)*: "Instalar no iPad".
   A dica entra como `<small className="mt-0.5 block text-footnote text-text-muted">` dentro do texto do
   passo (8,81:1 sobre `surface`). Para o iPad, expor `isIpad` no `InstallContext`
   (`/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)`, a mesma regra que já existe
   em `detectIos`) e escolher a chave do título.
4. **M-3 · média · "folha" do iOS é um modal central e os passos não seguem o desenho** —
   `components/pwa/InstallIosSheet.tsx:41-73`.
   No iPhone, todas as folhas do app sobem de baixo (`Sheet`); este passo a passo aparece como `Modal`
   central, com `max-w-sheet` e `w-[calc(100%-3rem)]` — fica estreito em 320 px e destoa do resto (consistência
   visual). Os passos são três cartões soltos com número e ícone em dois quadrados separados
   (`size-7` + `size-10`), em vez da lista agrupada do §9 com o número como selo da ilustração.
   Ajuste:
   - Trocar por `<Sheet open onOpenChange title={…} description={t("pwa.install.iosIntro")} leading={<span />}
     footer={<Button block data-autofocus onClick={() => onOpenChange(false)}>{t("pwa.install.iosDone")}</Button>}>`
     — `leading={<span />}` remove o "Cancelar" padrão (o §9 pede cabeçalho sem botão); `data-autofocus` põe o
     foco inicial em "Entendi"; o `Sheet` já vira modal central ≥ 768 px, trata `pb-safe` e devolve o foco
     ao gatilho. Como o `Sheet` deixa a descrição `sr-only`, repetir a introdução visível no corpo:
     `<p aria-hidden="true" className="m-0 mb-4 text-subhead text-text-muted">` (ou adicionar ao `Sheet` uma
     prop `descriptionVisible`).
   - Lista: `<ol className="m-0 list-none overflow-hidden rounded-lg bg-surface p-0">`; cada
     `<li className="list-row has-icon flex min-h-16 items-center gap-3 px-4 py-2.5 text-body">` (separador
     recuado 64 px como nas demais listas). Ilustração única `aria-hidden`:
     `<span className="relative grid size-9 shrink-0 place-items-center rounded-[10px] bg-info-soft text-info">`
     com o ícone 20 px e o selo
     `<span className="absolute -top-1.5 -left-1.5 grid size-[18px] place-items-center rounded-pill bg-info text-[11px] font-bold text-on-accent ring-2 ring-surface">{n}</span>`.
     `Check` com `strokeWidth={2.25}`.
5. **M-4 · média · convite da Home fora do §9: botão primário, título sem cabeçalho, texto diferente do item
   da Conta** — `components/pwa/InstallInvite.tsx:34-62`; `i18n/pt-BR.json:497-499`.
   - **Peso visual**: "Instalar" é `primary` (verde cheio) logo abaixo do saldo, competindo com o FAB e com a
     ação principal da tela; o contrato pede convite **discreto**. Usar `variant={ButtonVariant.Secondary}` com
     `icon={<Download className="size-[18px]" strokeWidth={1.75} />}` (`text`/`surface-2` 16,02:1).
   - **Leitor de tela**: o título é `<p>`; a Home tem `<h1>` e `<h2>` por seção, então o convite some da
     navegação por cabeçalhos. Usar `<h2 id={titleId} className="m-0 text-headline">` e
     `aria-describedby={bodyId}` na `<section>`.
   - **Texto**: "Instale o Finami" / "Abra mais rápido, direto da tela inicial, mesmo sem internet." diverge
     do item da Conta e do §9; a promessa "mesmo sem internet" não vale para telas nunca abertas
     (`OfflineContent`). Usar `inviteTitle` = "Instalar o Finami" e `inviteBody` = "Use o Finami como um app,
     direto da tela inicial." (os mesmos de `pwa.install.title`/`description` — pode reaproveitar as chaves).
   - **Marca e acabamento**: trocar o tile `Download` por
     `<AppIcon size={AppIconSize.Sm} className="mt-0.5 size-11 shadow-none" />` (`alt=""`, decorativo);
     contêiner `mt-4 flex items-start gap-3 rounded-lg bg-surface p-3.5 pr-1 shadow-card` com o "X" no fluxo
     (`size-11 -mt-1.5 shrink-0 rounded-full`, sem `absolute`/`pr-12`); descrição `text-subhead` e
     `mt-0.5 mb-2.5` (o botão sem `mt-3`).
6. **M-5 · média · "Tentar de novo" do `OfflineContent` some ao ser acionado** — uso em
   `pages/HomePage.tsx:114` + `:140-141` (e `WalletsPage.tsx:203`, `GroupPage.tsx:210`, `MemberPage.tsx:102`,
   `NotificationsPage.tsx:154`, `WalletStatementPage.tsx:284`; nenhum passa `retrying`).
   Na Home, `load()` volta a fase para `Loading`; sem dado guardado, `showSkeleton` é verdadeiro e o
   `OfflineContent` (com o botão focado) é trocado pelos skeletons; se continuar offline, o estado volta sem
   foco em nada (WCAG 2.4.3) — o mesmo problema do M-1 da REVIEW-004. O componente já tem `retrying`, só não
   é usado.
   Ajuste em cada página: lembrar que o último erro foi de rede e manter o ramo durante a nova tentativa —
   ex. na Home, `const offlineRetry = phase === LoadPhase.Loading && isOfflineError(loadError)` (sem limpar
   `loadError` no início do `load`, só no sucesso), `showSkeleton = … && !offlineRetry` e
   `<OfflineContent retrying={offlineRetry} … />`. O botão mostra o estado ocupado `secondary`
   (`text-muted`/`surface-3` 7,05:1). Conferir as outras cinco páginas pela mesma regra.
7. **M-6 · média · `UpdatePrompt` montado fora das cascas: cobre ações nas telas sem abas e conteúdo no
   desktop; ordem de foco errada** — `App.tsx:28`; `UpdatePrompt.tsx:33-36`; `AuthLayout.tsx:5-6`;
   `AppShell.tsx:74`; `index.css:186-188`.
   (a) Em `/entrar`, `/cadastro`, `/autorizar` e na `OfflinePage` não há TabBar, mas o cartão fica a
   49 px + 12 px do fundo, flutuando, e o `AuthLayout` não reserva espaço: em 320 px ele cobre "Autorizar"/
   "Negar" e o botão de entrar no fim da rolagem (consistência visual; alvo encoberto). (b) No desktop o
   `main` tem `md:pb-24` fixo e o cartão (360 px, `bottom: 104px`) se sobrepõe à coluna de 720 px nas
   larguras médias — as últimas linhas do extrato ficam por baixo dele, e o `scroll-padding-bottom` de 96 px
   não considera o cartão (conferir no navegador em 1024–1440 px). (c) Montado depois do `RouterProvider`,
   fica na ordem de Tab depois da TabBar e do FAB; o §9 pede entre o `main` e a TabBar.
   Ajuste:
   - Subir o estado para um `AppUpdateProvider` em `App.tsx` (um único `useRegisterSW`) e renderizar
     `<UpdatePrompt />` **dentro** do `AppShell`, entre `</main>` e `<TabBar />`, e no `AuthLayout`/`OfflinePage`
     com uma prop `placement="bare"` → `bottom-[calc(env(safe-area-inset-bottom)+12px)]` (celular) e o mesmo
     canto do desktop.
   - `AuthLayout`: `pb-[calc(env(safe-area-inset-bottom)+var(--update-prompt-h,0px)+min(var(--update-prompt-h,0px),1px)*24)]`.
   - `AppShell`: `md:pb-[calc(6rem+var(--update-prompt-h,0px)+min(var(--update-prompt-h,0px),1px)*24)]`; e
     no `index.css`, dentro do `@media (width >= 48rem)`:
     `scroll-padding-bottom: calc(96px + var(--update-prompt-h, 0px));`.
8. **M-7 · média · toast de reconexão/aviso com o offset da área segura contado duas vezes** —
   `main.tsx:56-58`.
   A altura publicada da faixa (`--offline-banner-h`) já inclui `env(safe-area-inset-top)` (a faixa tem
   `pt-[env(safe-area-inset-top)]`). Somar de novo o inset deixa um vão de ~47–59 px entre a faixa e o toast
   no iPhone instalado — o aviso "Sem internet. Conecte-se…" aparece solto no meio da tela.
   Ajuste: `top: "calc(max(env(safe-area-inset-top), var(--offline-banner-h, 0px)) + 8px)"` — com a faixa,
   8 px abaixo dela; sem a faixa, 8 px abaixo da barra de status.
9. **B-1 · baixa · toasts "Sem internet…" empilham a cada toque** — `utils/notify.ts:26-30`
   (chamado por `useOnlineAction.ts:42-46`).
   Tocar três vezes no FAB offline cria três toasts iguais (ruído visual e três anúncios). Ajuste:
   `toast.warning(message, { id: message, icon: … })` — o sonner substitui o toast com o mesmo `id`.
10. **B-2 · baixa · resto de hover/pressed em ações `aria-disabled`** — `components/ui/Button.tsx:28` e
    `:45-46`; `components/ui/SectionHeaderAction.tsx:24-26`.
    `destructive` mantém `hover:opacity-90 active:opacity-80` quando `aria-disabled`; a pílula
    "Adicionar membro" mantém `active:bg-surface-3`. A regra comum diz "sem hover". Ajuste: acrescentar
    `aria-disabled:hover:opacity-100 aria-disabled:active:opacity-100` em `ARIA_DISABLED_CLASSES` e
    `aria-disabled:active:bg-surface-2` na `SectionHeaderAction`.
11. **B-3 · baixa · "Atualizar" some ao ser tocado e "Atualizando…" pode não ser anunciado** —
    `components/pwa/UpdatePrompt.tsx:31` e `:39-59`; `hooks/useAppUpdate.ts:56-64`.
    O clique troca os botões pela linha "Atualizando…": o foco cai no `<body>`; e o `aria-busy="true"` no
    cartão, dentro da região viva, faz leitores de tela segurarem o anúncio até o fim — que nunca vem, porque
    a página recarrega. Se `updateServiceWorker` falhar, os botões voltam sem aviso e sem foco.
    Ajuste (e correção do §9 no próximo ciclo de design): manter o cartão, esconder só "Agora não" e usar
    `<Button loading={updating} loadingLabel={t("pwa.update.updating")}>` (o `Button` já põe `aria-busy`
    nele mesmo); tirar o `aria-busy` do cartão; no `catch`, toast de erro **"Não foi possível atualizar. Tente
    de novo."** — chave nova `pwa.update.failed` *(proposta)*. Conferir no navegador se o foco fica no botão
    `disabled` durante o loading.
12. **B-4 · baixa · `OfflinePage` sem título de página e "Tentar de novo" sem retorno** —
    `pages/OfflinePage.tsx:12`, `:22-24`, `:40-42`.
    O documento continua "Finami" (WCAG 2.4.2) e, ainda offline, o recarregamento só pisca a mesma tela.
    Ajuste: `document.title = \`${t("pwa.offline.pageTitle")} — Finami\`` no efeito de montagem; e, antes de
    recarregar, `await checkConnection()` com o botão em `loading loadingLabel="Verificando conexão…"`
    (chave `pwa.offline.checking` *(proposta)*): online → `location.reload()`; offline → manter a tela e
    devolver o foco ao `<h1>` (o leitor relê a situação).
13. **B-5 · baixa · texto com gênero** — `i18n/pt-BR.json:474`.
    "Abra esta tela de novo quando estiver **conectado**." refere-se à pessoa usuária no masculino; o resto do
    app usa linguagem neutra (REVIEW-004). A frase veio da minha proposta no §9 — corrigir lá também.
    Ajuste: "Abra esta tela de novo quando a conexão voltar.".
14. **B-6 · baixa · raio do tile do item "Instalar o Finami"** — `InstallAppItem.tsx:45`.
    Quadrado 30 px com `rounded-lg` (12 px, 40 % do lado); o mockup usa `.wicon.set` com 8 px, como os
    ícones das outras linhas de ajuste da Conta. Ajuste: `rounded-[8px]`.
15. **B-7 · baixa · telas de abertura só em retrato** — `index.html:16-52` (gerado por
    `scripts/generate-icons.mjs`).
    iPad aberto deitado mostra tela vazia na abertura. Ajuste opcional: gerar também as variantes
    `orientation: landscape` dos 7 iPads (largura/altura trocadas) e colar as tags.

---

## 3. Prioridade sugerida para o `frontend-react-developer`

**A-1 (com M-1 e o helper de foco) → M-2 → M-5 → M-6 → M-4 → M-3 → M-7 → baixos.**

Sobre os dois itens que o desenvolvedor já sabia que estavam pendentes:

- **InstallIosSheet**: o mais urgente são os **textos** (M-2) — sem a dica do menu ⋯, quem tem iOS 26 não
  acha o Compartilhar e não consegue instalar; o título "iPhone" no iPad é informação errada. Trocar
  `Modal` por `Sheet` (M-3) é consistência visual: o modal funciona (foco preso, Esc, foco inicial em
  "Entendi", foco volta ao gatilho), por isso fica depois.
- **InstallInvite** (M-4): o cabeçalho `<h2>` e o botão **secundário** são as partes que importam
  (navegação por cabeçalhos e convite discreto); `AppIcon` e espaçamentos são acabamento e podem entrar no
  mesmo commit. Fazer junto com A-1/M-1, já que os três mexem no mesmo componente.
