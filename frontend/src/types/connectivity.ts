/** Tipos de conectividade e de procedência dos dados (feature 005, data-model.md) */

/** Estado da conexão com a API */
export enum ConnectivityStatus {
  Online = "online",
  Offline = "offline",
}

/** Procedência de um dado de consulta (`apiFetch` com `cache: "network-first"`) */
export interface FreshnessInfo {
  /** `true` quando o dado veio do cache local porque a rede falhou */
  stale: boolean;
  /** Quando o dado veio do servidor (ISO) */
  fetchedAt: string;
}

/** Registro guardado no IndexedDB `finami-cache`, store `responses` */
export interface CachedEntry {
  /** `"{userId}:{path}"` */
  key: string;
  /** Dono da sessão que gravou */
  userId: number;
  /** Caminho da API com query, sem a URL base */
  path: string;
  /** JSON da resposta 2xx */
  data: unknown;
  /** Quando veio do servidor (ISO) */
  fetchedAt: string;
  /** Versão do formato; diferente de `OFFLINE_CACHE_SCHEMA_VERSION` → ignorado e apagado */
  schemaVersion: number;
}
