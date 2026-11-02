# Contrato de UI — PWA (feature 005)

Mockups: **ux-designer** (`docs/design/mockups/pwa-states.html`). Implementação:
**frontend-react-developer**. Textos pt-BR via i18n (namespace `pwa`). Princípio IX em tudo.

## Manifest (gerado no build)

`name` "Finami", `short_name` "Finami", `description` "Finanças da família: saldos, carteiras e
extratos.", `id` "/", `start_url` "/?source=pwa", `scope` "/", `display` "standalone",
`lang` "pt-BR", `theme_color`/`background_color` `#12021C`, `categories` ["finance"].
Ícones: `any` 192/512 + `maskable` 192/512. Atalhos: "Novo lançamento" (`/?acao=novo-lancamento`),
"Carteiras" (`/carteiras`). Screenshots: 2 `narrow` + 1 `wide`, com `label` em pt-BR.

## `OfflineBanner` (layout autenticado, todas as telas com abas e de detalhe)

- Faixa fixa logo abaixo do cabeçalho (celular) / topo do conteúdo (desktop), cor de aviso,
  ícone `WifiOff`, texto "Sem internet · dados de {01/11 às 18:42}" (ou "Sem internet" sem data).
- `role="status"` + `aria-live="polite"`; não recebe foco; respeita área segura.
- Aparece após 2 s offline; some na reconexão com anúncio "Conexão restabelecida." (toast curto).

## `UpdatePrompt`

- Faixa acima da barra de abas (celular) / canto inferior (desktop): "Nova versão disponível" +
  botões **Atualizar** e **Agora não**. `role="status"`, não modal, não rouba foco, alvos 44 px.
- Durante "Atualizar": "Atualizando…".

## Instalação

- **Conta → item "Instalar o Finami"** (seção "App"): ícone `Download`, descrição "Use o Finami
  como um app, direto da tela inicial." Oculto quando instalado ou sem suporte e fora do iOS.
  - Nativo: dispara o diálogo do navegador; aceito → toast "Finami instalado."
  - iOS/iPadOS: abre folha (Radix) "Instalar no iPhone" com 3 passos ilustrados: tocar em
    **Compartilhar** (ícone), **Adicionar à Tela de Início**, **Adicionar**; botão "Entendi".
- **Convite na Home** (`InstallInvite`): cartão discreto abaixo do saldo total, uma vez, com
  "Instalar" e botão fechar (`aria-label` "Dispensar convite de instalação"); dispensado → 30 dias.

## Sem internet

- **`OfflineContent`** (tela/trecho sem dados guardados): ícone, "Este conteúdo não está
  disponível sem internet." e **Tentar de novo**.
- **`OfflinePage`** (abertura sem nenhum dado e sem sessão verificável): logo, "Sem internet",
  "Conecte-se para usar o Finami pela primeira vez neste aparelho." e **Tentar de novo**.
- **Ações desabilitadas offline**: FAB "+", botões de criar/editar/excluir/convidar/aceitar;
  `aria-disabled="true"` (continuam focáveis), visual desabilitado, tocar → toast "Sem internet.
  Conecte-se para fazer lançamentos." (ou "…para fazer alterações." fora de lançamentos).
- Telas de login, cadastro e `/autorizar` offline: mensagem de erro de rede atual.

## Aparência instalada

- `theme-color` e `apple-mobile-web-app-status-bar-style` mantidos; telas de abertura iOS
  (`apple-touch-startup-image`) por tamanho de aparelho.
- Barra de abas e cabeçalhos com `env(safe-area-inset-*)` conferidos no modo standalone.

## Testes esperados (Vitest + axe)

`OfflineBanner` (2 s, data, anúncio), `UpdatePrompt` (atualizar/agora não), item de instalação
(nativo, iOS, instalado, sem suporte), convite (dispensa 30 dias), `OfflineContent`,
`OfflinePage`, FAB com `aria-disabled` offline e toast; axe sem violações em todos.
