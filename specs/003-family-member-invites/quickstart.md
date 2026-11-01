# Quickstart — Convites e notificações

## Ambiente

Homolog (Docker no WSL), já com a migration nova aplicada na subida da API:

```powershell
wsl --cd /mnt/c/repos/finami -e docker compose up -d --build
```

Frontend em http://localhost:8080 · API em http://localhost:5145.

Verificações automáticas:

```powershell
cd backend;  dotnet test Finami.sln
cd frontend; npm run lint; npm test; npm run build
```

## Roteiro manual (dois navegadores ou uma janela anônima)

Contas: **Ana** (responsável da família "Silva") e **Bruno** (cadastrado com `bruno@exemplo.com`, fora da família).

| # | Quem | Passo | Esperado | Ref. |
|---|---|---|---|---|
| 1 | Ana | Abrir a família "Silva" | Botão "Adicionar membro" visível na seção Membros | FR-001 |
| 2 | Ana | Adicionar → email `pedro@exemplo.com` → Pedro Silva | Pedro aparece em Membros na hora | US1-3 |
| 3 | Ana | Adicionar → ` PEDRO@exemplo.com ` | "Pedro Silva já é membro desta família." | US1-6/8 |
| 4 | Ana | Adicionar → "Adicionar sem email" → Lia Silva | Lia aparece em Membros | US1-5 |
| 5 | Ana | Adicionar → `bruno@exemplo.com` | "Esse email já pertence a Bruno Lima" + só "Convidar" | US1-4 |
| 6 | Ana | Convidar | Bruno em "Convites pendentes"; toast | US2-1 |
| 7 | Ana | Adicionar → `bruno@exemplo.com` de novo | "Já existe um convite pendente…" | US2-3 |
| 8 | Bruno | Abrir o app | Sino com "1" em Home/Carteiras/Conta | US3-1 |
| 9 | Bruno | Tentar abrir `/familias/{id}` da Silva | Sem acesso enquanto pendente | US2-2 |
| 10 | Bruno | Sino → Aceitar | Toast; família aparece nas telas; contador zera | US2-4, SC-006 |
| 11 | Ana | Trocar de tela e abrir o sino | "Bruno Lima aceitou o convite para Família Silva"; toque → família | US3-4/7 |
| 12 | Ana | Convidar outra conta e cancelar | Some de pendentes; na conta convidada aparece "Convite cancelado" sem botões | US2-6, US3-3 |
| 13 | Convidado | Tentar aceitar convite cancelado (aba antiga) | "Este convite não está mais disponível." | US2-7 |
| 14 | — | Banco: `select status, count(*) from group_invitations group by 1` | Estados coerentes; no máximo 1 pendente por pessoa/família | FR-010 |
| 15 | — | Navegar só com teclado na folha e nas notificações | Foco visível, `Esc` fecha, mensagens anunciadas | FR-026 |
