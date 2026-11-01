# Revisão de design — telas da feature 003 × mockups (T040)

Feature `003-family-member-invites` · direção **Noite Roxa** · referência:
[`mockups/add-member-sheet.html`](./mockups/add-member-sheet.html),
[`mockups/notifications.html`](./mockups/notifications.html), [`mockups/group.html`](./mockups/group.html),
sino em [`home.html`](./mockups/home.html) / [`wallets.html`](./mockups/wallets.html) /
[`account.html`](./mockups/account.html), especificação em [`components.md` §7](./components.md).
Consumo: `frontend-react-developer`.

## Como foi feita

- Ambiente **homolog** real (frontend `http://localhost:8080`, API `http://localhost:5145`, PostgreSQL), sem
  simulação. Dados criados pela própria API com contas de teste `*.rev003@exemplo.com`:
  - Ana Silva (responsável) com as famílias "Silva", "Praia" e "Futebol de quinta à noite" (nome longo);
    em Silva, Pedro Almeida (criado com email) e Rafael Silva (criado sem email);
  - convites em todos os estados: Carla **aceitou**, Diego **recusou**, Bruno aceitou Praia, recusou Futebol e
    teve **20 convites cancelados** em ciclos convidar/cancelar; Bruno e Eva Nascimento Albuquerque
    **pendentes** em Silva; Fábio Conceição cadastrado sem vínculo (passo *Registered*);
  - resultado: Ana com 4 não lidas; Bruno com **23 não lidas** (selo "9+" e 2 páginas de 20).
- Sessão injetada em `localStorage["finami:auth"]`; capturas no Chrome headless via DevTools Protocol
  (Node 22, `WebSocket` global) em **320 × 640, 390 × 844 (mobile) e 1440 × 900**, com cliques e digitação reais
  (`Input.insertText`) em cada passo da folha. Foco, `aria-*` e medidas lidos do DOM em execução.
- Não simulado: `safe-area-inset-*` (o headless devolve 0) — a folha alta encosta no topo nas capturas,
  o que é esperado sem a ilha.
- Nenhum erro de console durante todo o roteiro.

Severidade: **alta** = quebra de layout, informação perdida ou falha de acessibilidade; **média** = divergência
visível do mockup ou da regra de design; **baixa** = acabamento.

**Resultado: nenhum item de severidade alta.** 2 médios, 6 baixos.

---

## 1. Resumo — o que está fiel

| Área | Verificado |
|---|---|
| Sino nas abas (celular) | Home, Carteiras e Conta: alvo 44 × 44 em `x=340, y=44` (390 px), na linha do `<h1>` (`y=46`, altura 41), glifo rente à margem; selo "1", "4" e "9+"; sem não lidas, só o sino. `aria-label` medido: "Notificações, 4 não lidas", "Notificações, 23 não lidas" (número real com o selo "9+"), "Notificações, 1 não lida". Oculto ≥ 768 px. |
| Sino na Sidebar (1440) | À direita da logo, `text-muted`, selo com anel `surface`; em `/notificacoes` fica ativo (`brand-tint` + verde) e sem selo. |
| "Adicionar membro" | Pílula 36 px `surface-2` + `accent` (9,98:1), `::before` −4 px → alvo 44 px, `aria-haspopup="dialog"`, fora do `<h2>`. Só para a responsável. |
| Convites pendentes | Seção após Membros, avatar tracejado, "Enviado em 1 de nov.", "Cancelar" 44 px com `aria-label="Cancelar convite de {nome}"`, rodapé explicativo. Nova linha entra no topo ao convidar (toast "Convite enviado para Diego Ramos."). |
| ConfirmModal de cancelamento | Título/descrição do spec, "Cancelar convite" destrutivo + "Manter convite" com **foco inicial** (medido). |
| Folha — email | Foco inicial no campo (`type=email`, `autocomplete=email`, `inputmode=email`); divisor "ou"; "Adicionar sem email". |
| Folha — inválido | `aria-invalid="true"`, `aria-describedby` no erro, foco permanece no campo, fluxo não avança. |
| Folha — Available | Email **normalizado** exibido (" Novo.Rev003@Exemplo.com " → `novo.rev003@exemplo.com`), foco no `h3` "Nova pessoa". |
| Folha — Registered | Só nome + "Já tem conta no Finami" (FR-008); texto do contrato já neutro ("Você pode enviar um convite para a família."); foco no `h3`. |
| Folha — AlreadyMember / próprio email / PendingInvite | `h3` com foco, aviso com ícone + texto, "Usar outro email"; pendente com "Cancelar convite" → ConfirmModal. |
| Folha — sem email | Validação "Campo obrigatório." nos dois campos, borda + ícone + texto. |
| Desktop | Folha vira modal central de 480 px; conteúdo idêntico. |
| `/notificacoes` — convidado | Ordem mais recente → antiga; ponto verde + `sr-only` "Não lida." (20 de 20 itens); pendente com Recusar/Aceitar 44 px; selos "Convite cancelado", "Você aceitou"; "Carregar mais" traz 3 itens (23 no total), botão some, **foco vai para o 1º item novo** (medido). |
| Aceitar | Toast "Você agora faz parte de Silva.", item passa a "Você aceitou", foco na frase do item, Silva aparece em Carteiras sem recarregar; sino volta sem selo. |
| `/notificacoes` — responsável | "aceitou" com chevron (link para a família), "recusou" sem link; ícones `UserCheck`/`UserX` distintos. "Voltar" mostra a aba de origem ("Home"). |

---

## 2. Ajustes

1. **M-1 · média · "Convites pendentes" perde a data em 320 px** — `components/group/PendingInvitations.tsx`.
   Em 320 px o botão "Cancelar" ocupa 90 px (`px-5` do `Button sm`) e a linha 2 vira "Enviado em 1 d…";
   nomes longos ("Eva Nascim…") truncam com 1 linha só. A data é a informação principal da linha
   (FR-015). Ajuste: no botão desta linha usar `px-3` (≈ 70 px, continua ≥ 44 × 44), deixar a linha 2
   **quebrar** (`whitespace-normal`, sem `truncate`) e o nome com até 2 linhas (`line-clamp-2`, como no
   `MemberRow`/`WalletCard`). Mesmo ajuste no `PersonCard` da folha, se ele usar `truncate`.
2. **M-2 · média · texto com gênero no passo *Registered*** — `src/i18n/pt-BR.json`
   (`groups.addMember.registeredHint`). "Ela só entra na família depois de aceitar. O convite aparece nas
   notificações dela." aparece para "Fábio Conceição"/"Diego Ramos". O erro veio da minha especificação
   (já corrigida em `components.md` e no mockup). Trocar por **"A pessoa só entra na família depois de aceitar.
   O convite aparece nas notificações do app."** e ajustar o teste que confere esse texto, se houver.
3. **B-1 · baixa · cabeçalho da folha apertado em 320 px** — `components/ui/Sheet.tsx`.
   "Cancelar"/"Voltar" fica a ~8 px do título "Adicionar membro" (grade `1fr auto 1fr` com título de 145 px).
   Legível, mas parece um rótulo só. Abaixo de 360 px, usar `text-callout` no título ou ícone `ChevronLeft`
   sem o texto "Voltar" (manter `aria-label="Voltar"`). Vale para todas as folhas.
4. **B-2 · baixa · próprio email** — `AddMemberSheet.tsx` / `pt-BR.json`. Para o email da própria
   responsável aparece "Ana Silva já é membro desta família." com o cartão "Ana Silva · Membro da família
   Silva". Quando `lookup.user.userId === session.user.userId`, usar "Você já faz parte desta família."
   (chave nova `groups.addMember.alreadyMemberSelf`).
5. **B-3 · baixa · peso do atalho "Adicionar sem email"** — `AddMemberSheet.tsx`. Título em `text-body`
   regular; o mockup usa `text-headline` (semibold) como as demais linhas de 60 px. Trocar para
   `text-headline font-semibold`.
6. **B-4 · baixa (não verificável no headless) · anel de foco no campo ao abrir a folha** — na captura
   do passo email o campo está focado (`document.activeElement` = input), mas o anel não aparece porque a
   janela headless não tem foco do sistema; depois de digitar, o anel aparece. Conferir no iPhone/desktop real
   que o foco inicial programático mostra o anel (`:focus-visible` em input sempre deveria).
7. **B-5 · baixa · estado "Aceitando…" não capturado** — a API do homolog respondeu antes de 400 ms. O
   comportamento está coberto pelos testes de componente; sem ajuste.
8. **B-6 · baixa · notificações repetidas** — com 20 convites cancelados da mesma família, a lista tem 20
   linhas idênticas. É fruto do roteiro de teste (convidar/cancelar em série), não de uso normal; registrar
   como ideia futura (agrupar convites cancelados repetidos da mesma família), sem ajuste agora.

### Observação fora do escopo da 003
- `MemberRow` em 1440 px: o selo "Responsável" vai para uma linha própria abaixo do nome e a linha "você · sem
  carteiras" vira uma terceira linha (mockup 002: selo na linha do nome). Comportamento herdado da 002;
  avaliar junto com o próximo ciclo da tela da família.
- O toast do sonner (topo central) cobre o "voltar" por ~4 s, como já acontecia na 002.
