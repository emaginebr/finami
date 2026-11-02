import type { CachedEntry } from "../types/connectivity";

/**
 * Cache local dos dados de consulta (feature 005, data-model.md e contracts/offline-cache.md).
 * IndexedDB `finami-cache` v1, store `responses` (keyPath `key`, índice `byUser`).
 * Qualquer falha do IndexedDB (navegação privada, cota, banco bloqueado) vira no-op:
 * `get` resolve `undefined` e `set`/`clearAll` resolvem sem erro.
 */

export const OFFLINE_CACHE_DB_NAME = "finami-cache";
export const OFFLINE_CACHE_DB_VERSION = 1;
export const OFFLINE_CACHE_STORE = "responses";
export const OFFLINE_CACHE_INDEX_BY_USER = "byUser";
/** Versão do formato dos registros; registros com outra versão são ignorados e apagados */
export const OFFLINE_CACHE_SCHEMA_VERSION = 1;
/** Limite de registros por usuário; acima disso saem os de `fetchedAt` mais antigo */
export const MAX_ENTRIES_PER_USER = 300;
/** Tempo máximo para abrir o banco antes de desistir (evita travar uma consulta) */
const OPEN_TIMEOUT_MS = 3_000;

let dbPromise: Promise<IDBDatabase | null> | null = null;
/** Último `userId` que gravou nesta carga da página (evita conferir o banco a cada gravação) */
let lastUserId: number | null = null;

/**
 * Incrementado a cada `clearAll`: uma gravação iniciada antes de uma limpeza (ex.: resposta que
 * chega durante o logout) é descartada em vez de recriar o dado depois de apagado (FR-015).
 */
let generation = 0;

const toKey = (userId: number, path: string): string => `${userId}:${path}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCurrentEntry = (value: unknown): value is CachedEntry =>
  isRecord(value) &&
  value.schemaVersion === OFFLINE_CACHE_SCHEMA_VERSION &&
  typeof value.key === "string" &&
  typeof value.userId === "number" &&
  typeof value.fetchedAt === "string";

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const openDb = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;

  const attempt = new Promise<IDBDatabase | null>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (db: IDBDatabase | null) => {
      if (settled) {
        db?.close();
        return;
      }
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(db);
    };

    try {
      if (typeof indexedDB === "undefined") {
        finish(null);
        return;
      }
      timer = setTimeout(() => finish(null), OPEN_TIMEOUT_MS);
      const request = indexedDB.open(OFFLINE_CACHE_DB_NAME, OFFLINE_CACHE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OFFLINE_CACHE_STORE)) {
          const store = db.createObjectStore(OFFLINE_CACHE_STORE, { keyPath: "key" });
          store.createIndex(OFFLINE_CACHE_INDEX_BY_USER, "userId");
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // Outra aba com versão nova do banco: libera a conexão
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        finish(db);
      };
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
    } catch {
      finish(null);
    }
  });

  const pending = attempt.then((db) => {
    // Falha não fica guardada: a próxima operação tenta de novo
    if (!db && dbPromise === pending) dbPromise = null;
    return db;
  });
  dbPromise = pending;
  return pending;
};

const deleteKey = async (db: IDBDatabase, key: string): Promise<void> => {
  const tx = db.transaction(OFFLINE_CACHE_STORE, "readwrite");
  tx.objectStore(OFFLINE_CACHE_STORE).delete(key);
  await transactionDone(tx);
};

const clearStore = async (db: IDBDatabase): Promise<void> => {
  const tx = db.transaction(OFFLINE_CACHE_STORE, "readwrite");
  tx.objectStore(OFFLINE_CACHE_STORE).clear();
  await transactionDone(tx);
};

/** `true` quando há registros de alguém que não é `userId` */
const hasOtherUsers = async (db: IDBDatabase, userId: number): Promise<boolean> => {
  const tx = db.transaction(OFFLINE_CACHE_STORE, "readonly");
  const store = tx.objectStore(OFFLINE_CACHE_STORE);
  const [total, own] = await Promise.all([
    requestResult(store.count()),
    requestResult(store.index(OFFLINE_CACHE_INDEX_BY_USER).count(IDBKeyRange.only(userId))),
  ]);
  return total > own;
};

/** Remove os registros mais antigos do usuário acima de `MAX_ENTRIES_PER_USER` */
const enforceLimit = (db: IDBDatabase, userId: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_CACHE_STORE, "readwrite");
    const store = tx.objectStore(OFFLINE_CACHE_STORE);
    const index = store.index(OFFLINE_CACHE_INDEX_BY_USER);
    const range = IDBKeyRange.only(userId);
    const countRequest = index.count(range);
    countRequest.onsuccess = () => {
      const excess = countRequest.result - MAX_ENTRIES_PER_USER;
      if (excess <= 0) return;
      const allRequest = index.getAll(range);
      allRequest.onsuccess = () => {
        const entries: unknown[] = allRequest.result;
        entries
          .filter(isCurrentEntry)
          .sort((a, b) => Date.parse(a.fetchedAt) - Date.parse(b.fetchedAt))
          .slice(0, excess)
          .forEach((entry) => store.delete(entry.key));
      };
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

/** Lê o dado guardado de `path` para `userId` (registro de outra versão é apagado) */
const get = async (userId: number, path: string): Promise<CachedEntry | undefined> => {
  try {
    const db = await openDb();
    if (!db) return undefined;
    const key = toKey(userId, path);
    const tx = db.transaction(OFFLINE_CACHE_STORE, "readonly");
    const value: unknown = await requestResult(tx.objectStore(OFFLINE_CACHE_STORE).get(key));
    if (value === undefined) return undefined;
    if (!isCurrentEntry(value) || value.userId !== userId) {
      await deleteKey(db, key);
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
};

/**
 * Grava a resposta 2xx de `path` para `userId`. Se houver dados de outra pessoa no banco
 * (login de outra conta), apaga tudo antes.
 */
const set = async (userId: number, path: string, data: unknown): Promise<void> => {
  const startedAt = generation;
  try {
    const db = await openDb();
    if (!db || startedAt !== generation) return;
    if (lastUserId !== userId) {
      if (await hasOtherUsers(db, userId)) await clearStore(db);
      if (startedAt !== generation) return;
      lastUserId = userId;
    }
    const entry: CachedEntry = {
      key: toKey(userId, path),
      userId,
      path,
      data,
      fetchedAt: new Date().toISOString(),
      schemaVersion: OFFLINE_CACHE_SCHEMA_VERSION,
    };
    // Conferido de forma síncrona logo antes de abrir a transação: o IndexedDB executa as
    // transações na ordem de criação, então um clearAll chamado depois apaga este registro.
    if (startedAt !== generation) return;
    const tx = db.transaction(OFFLINE_CACHE_STORE, "readwrite");
    tx.objectStore(OFFLINE_CACHE_STORE).put(entry);
    await transactionDone(tx);
    await enforceLimit(db, userId);
  } catch {
    // Cota excedida, banco fechado etc.: o app segue sem cache
  }
};

/** Apaga todos os dados guardados (logout, 401, troca de pessoa) */
const clearAll = async (): Promise<void> => {
  generation += 1;
  lastUserId = null;
  try {
    const db = await openDb();
    if (!db) return;
    await clearStore(db);
  } catch {
    // no-op
  }
};

/** API do cache offline (contracts/offline-cache.md) */
export const offlineCache = { get, set, clearAll };

/** Fecha a conexão e esquece o estado em memória (testes e troca de versão do banco) */
export const closeOfflineCache = async (): Promise<void> => {
  const pending = dbPromise;
  dbPromise = null;
  lastUserId = null;
  const db = pending ? await pending : null;
  db?.close();
};

export default offlineCache;
