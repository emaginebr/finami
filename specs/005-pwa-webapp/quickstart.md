# Quickstart — Finami PWA

## Ambiente

O service worker fica desligado no `npm run dev` (FR-023). Para testar a PWA use o build:

```powershell
cd frontend; npm run build; npm run preview      # http://localhost:4173 (API via VITE_API_URL)
```
ou o homolog (Docker no WSL): `wsl --cd /mnt/c/repos/finami -e docker compose up -d --build` →
http://localhost:8080.

Automático: `cd frontend; npm run lint; npm test; npm run build`.

## Roteiro (Chrome/Edge no desktop + celular Android + iPhone)

| # | Passo | Esperado | Ref. |
|---|---|---|---|
| 1 | DevTools → Application → Manifest | Sem erros; ícones any + maskable; atalhos; screenshots | FR-001/002, SC-001 |
| 2 | Application → Service Workers | `sw.js` ativo; precache com os assets | FR-007 |
| 3 | Conta → "Instalar o Finami" | Diálogo nativo; app abre em janela própria | US1-1/2, SC-002 |
| 4 | Abrir o app instalado | Conta não mostra mais "Instalar" | US1-4 |
| 5 | Botão direito no ícone (desktop) / tocar e segurar (Android) | Atalhos "Novo lançamento" e "Carteiras"; o primeiro abre a folha de lançamento | US1-6 |
| 6 | Home, Carteiras, um extrato; depois Network → Offline e recarregar | Mesmas telas com "Sem internet · dados de …" | US2-1/2, SC-003 |
| 7 | Offline: extrato de outro mês | "Este conteúdo não está disponível sem internet." + Tentar de novo | US2-2 |
| 8 | Offline: tocar no "+" | Toast "Sem internet…"; nenhuma requisição em Network | US2-3, SC-005 |
| 9 | Voltar Online | Faixa some em até 5 s; dados atualizam | US2-4 |
| 10 | Sair da conta → Application → IndexedDB `finami-cache` | Vazio | US2-5, SC-006 |
| 11 | Limpar dados do site, Offline, abrir `/` | Página do navegador (primeira visita); após uma visita online e sem sessão: `OfflinePage` | US2-6 |
| 12 | Publicar build novo (rebuild do homolog) com o app aberto; voltar à aba | "Nova versão disponível"; Atualizar → mesma tela, sessão mantida | US3, SC-007 |
| 13 | Abrir folha de lançamento, digitar valor, chegar a versão nova sem tocar em Atualizar | Nada recarrega | US3-2 |
| 14 | Network → Slow 3G, reabrir o app | Estrutura em ≤ 1,5 s | US4-1, SC-004 |
| 15 | iPhone Safari → Conta → Instalar | Folha com o passo a passo; após adicionar, abre em tela cheia sem conteúdo sob o entalhe | US1-3, US4-3 |
| 16 | `/oauth/authorize?...` (prod/homolog com mesma origem) com o SW ativo | Chega à API, não ao index.html | R-07 |
| 17 | Lighthouse (mobile) | Instalável; desempenho sem itens críticos | SC-001 |
