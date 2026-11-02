import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_ENTRIES_PER_USER,
  OFFLINE_CACHE_DB_NAME,
  OFFLINE_CACHE_SCHEMA_VERSION,
  OFFLINE_CACHE_STORE,
  closeOfflineCache,
  offlineCache,
} from "./offlineCache";
import type { CachedEntry } from "../types/connectivity";

// --- Acesso direto ao IndexedDB (fake-indexeddb) para conferir o que ficou gravado ---

const openRaw = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_CACHE_DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openRaw();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_CACHE_STORE, mode);
      const request = action(tx.objectStore(OFFLINE_CACHE_STORE));
      let result: T;
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

const rawKeys = async (): Promise<string[]> =>
  (await withStore("readonly", (store) => store.getAllKeys())).map(String);

const rawPut = (entry: CachedEntry): Promise<IDBValidKey> =>
  withStore("readwrite", (store) => store.put(entry));

describe("offlineCache", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await closeOfflineCache();
  });

  it("grava e lê pela chave {userId}:{path}, com fetchedAt", async () => {
    await offlineCache.set(7, "/api/wallets?ativas=true", [{ walletId: 1 }]);

    const entry = await offlineCache.get(7, "/api/wallets?ativas=true");

    expect(entry?.key).toBe("7:/api/wallets?ativas=true");
    expect(entry?.userId).toBe(7);
    expect(entry?.data).toEqual([{ walletId: 1 }]);
    expect(entry?.schemaVersion).toBe(OFFLINE_CACHE_SCHEMA_VERSION);
    expect(Number.isNaN(Date.parse(entry?.fetchedAt ?? ""))).toBe(false);
    expect(await offlineCache.get(7, "/api/wallets")).toBeUndefined();
  });

  it("isola os dados por usuário", async () => {
    await offlineCache.set(7, "/api/wallets", ["da Ana"]);

    expect(await offlineCache.get(8, "/api/wallets")).toBeUndefined();
    expect((await offlineCache.get(7, "/api/wallets"))?.data).toEqual(["da Ana"]);
  });

  it("gravar para outra pessoa apaga os dados da anterior (login de outra pessoa)", async () => {
    await offlineCache.set(7, "/api/wallets", ["da Ana"]);
    await offlineCache.set(7, "/api/groups", ["famílias da Ana"]);
    // Simula um recarregamento da página: o módulo não lembra quem gravou por último
    await closeOfflineCache();

    await offlineCache.set(8, "/api/wallets", ["do Bruno"]);

    expect(await rawKeys()).toEqual(["8:/api/wallets"]);
  });

  it("clearAll apaga tudo", async () => {
    await offlineCache.set(7, "/api/wallets", [1]);
    await offlineCache.set(7, "/api/groups", [2]);

    await offlineCache.clearAll();

    expect(await rawKeys()).toEqual([]);
    expect(await offlineCache.get(7, "/api/wallets")).toBeUndefined();
  });

  it("gravação em andamento durante um clearAll não recria o dado (logout no meio da resposta)", async () => {
    const writing = offlineCache.set(7, "/api/wallets", [{ walletId: 1 }]);
    await offlineCache.clearAll();
    await writing;

    expect(await offlineCache.get(7, "/api/wallets")).toBeUndefined();
  });

  it("ignora e apaga registro com schemaVersion diferente", async () => {
    await offlineCache.set(7, "/api/groups", []);
    await rawPut({
      key: "7:/api/wallets",
      userId: 7,
      path: "/api/wallets",
      data: ["formato antigo"],
      fetchedAt: "2026-10-01T10:00:00.000Z",
      schemaVersion: OFFLINE_CACHE_SCHEMA_VERSION + 1,
    });

    expect(await offlineCache.get(7, "/api/wallets")).toBeUndefined();
    expect(await rawKeys()).toEqual(["7:/api/groups"]);
  });

  it(`mantém no máximo ${MAX_ENTRIES_PER_USER} registros por usuário, apagando os mais antigos`, async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-11-01T12:00:00.000Z");
    for (let i = 0; i <= MAX_ENTRIES_PER_USER; i++) {
      vi.setSystemTime(start + i * 1000);
      await offlineCache.set(7, `/api/statements/wallets/${i}`, { i });
    }

    const keys = await rawKeys();
    expect(keys).toHaveLength(MAX_ENTRIES_PER_USER);
    expect(keys).not.toContain("7:/api/statements/wallets/0");
    expect(keys).toContain("7:/api/statements/wallets/1");
    expect(keys).toContain(`7:/api/statements/wallets/${MAX_ENTRIES_PER_USER}`);
  });

  it("vira no-op quando o IndexedDB não está disponível", async () => {
    await closeOfflineCache();
    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new DOMException("Bloqueado", "SecurityError");
    });

    await expect(offlineCache.get(7, "/api/wallets")).resolves.toBeUndefined();
    await expect(offlineCache.set(7, "/api/wallets", [])).resolves.toBeUndefined();
    await expect(offlineCache.clearAll()).resolves.toBeUndefined();
  });
});
