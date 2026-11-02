# Data Model: PWA (feature 005)

Sem mudanças no banco ou na API. Todo o estado novo vive **no navegador**.

## IndexedDB `finami-cache` (versão do banco 1) — dados de consulta guardados

Store `responses` (keyPath `key`), índice `byUser` em `userId`.

| Campo | Tipo | Regras |
|---|---|---|
| `key` | string | `"{userId}:{path}"` — `path` com query, sem a URL base (ex. `7:/api/statements/wallets/3?start=2026-10-01&end=2026-10-31`) |
| `userId` | number | dono da sessão que gravou |
| `path` | string | |
| `data` | unknown | JSON da resposta 2xx |
| `fetchedAt` | string ISO | quando veio do servidor |
| `schemaVersion` | number | `OFFLINE_CACHE_SCHEMA_VERSION` (começa em 1); diferente da constante → ignorado e apagado |

Regras: só GETs marcados `network-first` (ver `contracts/offline-cache.md`); só respostas 2xx com
corpo; nunca respostas de `/api/auth/*`, `/api/oauth/*`, escritas, OAuth ou MCP.
Apagado por inteiro (`clearAll`) em: logout manual, 401 (handler de não autorizado), login de
outra pessoa (userId diferente do último gravado), troca de `schemaVersion`.
Limite: até 300 registros por usuário; ao gravar acima disso, remove os de `fetchedAt` mais antigo.

## `localStorage`

| Chave | Conteúdo | Observação |
|---|---|---|
| `finami:auth` | sessão (já existe) | inalterada (Princípio VI) |
| `finami:install-dismissed-at` | ISO date | convite de instalação dispensado (30 dias) |

## Estado em memória (Contexts)

- **Connectivity**: `status: "online" | "offline"`, `showBanner: boolean` (após 2 s offline),
  `lastOnlineAt?: string`, evento `reconnected`.
- **Install**: `canPromptNative`, `isInstalled`, `isIos`, `dismissedAt`, ações
  `promptInstall()`, `dismissInvite()`.
- **Update (SW)**: `needRefresh`, `offlineReady`, ações `update()`, `dismiss()`.
- **Freshness por consulta**: resultado do `apiFetch` com `network-first` informa
  `{ stale: boolean, fetchedAt: string }` ao contexto que buscou; o `OfflineBanner` mostra o
  `fetchedAt` mais antigo dos dados da tela atual (ou o da Home).

## Transições de conexão

```text
online ──falha de rede / timeout 10 s / evento offline──▶ offline(pendente)
offline(pendente) ──2 s──▶ offline(banner visível)
offline(*) ──qualquer resposta HTTP / evento online + ping ok──▶ online (+ evento reconnected)
```
