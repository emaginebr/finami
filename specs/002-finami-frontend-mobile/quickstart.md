# Quickstart — Frontend do Finami

## Pré-requisitos

- Node 22+ e npm 11+.
- Backend da feature 001 rodando (`http://localhost:5145`) com as rotas desta feature
  (`contracts/api-additions.md`) e um PostgreSQL acessível — veja `backend/README.md`.
- (Opcional) OAuth Client ID do Google com `http://localhost:5173` como origem autorizada; o
  mesmo valor em `Google__ClientId` no backend.

## Rodando

```powershell
cd frontend
copy .env.example .env.local      # ajuste VITE_API_URL e, se quiser, VITE_GOOGLE_CLIENT_ID
npm install
npm run dev                       # http://localhost:5173
```

Ícones (só quando a logo mudar): `npm run icons` → regenera `public/*.png` e `src/assets/app-icon.png`.

## Verificações automáticas

```powershell
npm run lint
npm test                          # Vitest + Testing Library + vitest-axe
npm run build                     # deve terminar sem erros; conferir JS inicial ≤ 200 KB gzip no relatório
cd ../backend; dotnet test Finami.sln   # inclui BalanceServiceTests
```

## Roteiro de validação manual (DevTools em modo celular, iPhone 12 Pro — 390 px)

| # | Passo | Resultado esperado | Ref. |
|---|---|---|---|
| 1 | Abrir `/` sem sessão | Redireciona para `/entrar`, com logo e ícone | FR-003, FR-007 |
| 2 | Criar conta (Ana) e entrar | Home com R$ 0,00 e convite para criar carteira | US1-7 |
| 3 | Fechar e reabrir a aba | Continua logada | FR-002 |
| 4 | Aba Carteiras → Nova família "Silva"; cadastrar "Pedro" sem login e incluir | Pedro aparece na família | US4-2/3 |
| 5 | Criar carteiras: "Nubank" (BRL, avulsa), "Ledger" (BTC, avulsa), "Mesada" (BRL, Silva, titular Pedro) | Home: seção "Silva" e depois "Avulsas" | US1-5, US4-1 |
| 6 | "+" → Entrada R$ 5.000,00 no Nubank | Toast, total = R$ 5.000,00 sem recarregar | US2-2, FR-020 |
| 7 | "+" → Saída R$ 99.999,00 do Nubank | "Saldo insuficiente"; nada gravado | US2-3 |
| 8 | "+" → Transferência Nubank → Ledger R$ 1.000,00 | Prévia com BTC e cotação; após confirmar, total ≈ R$ 5.000,00 (BTC estimado) | US2-4, US1-4 |
| 9 | Digitar `0,001` numa saída em BRL | Erro de casas decimais antes de enviar | US2-7 |
| 10 | "+" → Transferência para "Outra carteira (código)" = código da Mesada | Mostra "Mesada · Pedro Silva" e pede confirmação | US2-5 |
| 11 | Tocar no Nubank | Extrato do mês: inicial + entradas − saídas = final | US3-1 |
| 12 | Trocar período para "Mês passado" | Sem lançamentos; saldos inicial e final iguais | US3-4 |
| 13 | Estornar a entrada do passo 6 | Estorno no extrato; original marcado como estornado | US3-3 |
| 14 | Tocar na família "Silva" | Total da família e linhas Ana / Pedro com valores | US5-1 |
| 15 | Tocar em Pedro | Carteiras do Pedro agrupadas por família | US5-2 |
| 16 | Mudar visibilidade para "Somente o responsável"; entrar como outro membro com login | Família mostra membros sem valores e a explicação | US5-3, SC-006 |
| 17 | Visibilidade "Membros veem só os totais" com o outro membro | Valores por membro, sem carteiras/extrato | US5-4, SC-006 |
| 18 | Conta → alterar sobrenome; trocar senha (pede a atual); Sair | Sobrenome atualizado; volta para `/entrar`; `localStorage["finami:auth"]` removido | US6 |
| 19 | Apagar o token manualmente para forçar 401 numa ação | Vai para `/entrar` com "Sua sessão expirou" e volta à tela anterior após entrar | Edge case |
| 20 | Redimensionar para 320 px e 1440 px | Sem rolagem horizontal; no desktop barra lateral e conteúdo ≤ 720 px | FR-005, SC-004 |
| 21 | Navegar só com teclado (Tab/Enter/Esc) na folha de transação | Foco visível, foco preso na folha, `Esc` fecha | Princípio IX |
| 22 | Lighthouse (mobile) | Acessibilidade ≥ 95; sem erros de contraste | SC-007 |
| 23 | Safari iOS → Compartilhar → Adicionar à Tela de Início | Ícone com a casa da logo, abre em tela cheia | FR-008 |
