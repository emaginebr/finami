import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_STORAGE_KEY,
  REQUEST_TIMEOUT_MS,
  apiFetch,
  getHeaders,
  handleResponse,
  readStoredSession,
  setUnauthorizedHandler,
} from "./apiHelpers";
import {
  ApiError,
  GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  NETWORK_ERROR_STATUS,
  OFFLINE_CONTENT_MESSAGE,
  OFFLINE_WRITE_MESSAGE,
} from "../types/api";
import type { AuthSession } from "../types/auth";
import { ConnectivityStatus } from "../types/connectivity";
import { getOldestStaleFetchedAt, getStatus, reportOffline } from "../utils/connectivity";
import { offlineCache } from "../utils/offlineCache";

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const makeSession = (expiresAt: string): AuthSession => ({
  token: "jwt-token",
  expiresAt,
  user: {
    userId: 7,
    firstName: "Ana",
    lastName: "Silva",
    email: "ana@ex.com",
    hasPassword: true,
    hasGoogle: false,
    canLogin: true,
    createdByUserId: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
});

const catchError = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error("A promessa deveria ter falhado");
};

describe("handleResponse", () => {
  afterEach(() => setUnauthorizedHandler(null));

  it("devolve o JSON em 200", async () => {
    const result = await handleResponse<{ walletId: number }>(jsonResponse(200, { walletId: 1 }));
    expect(result).toEqual({ walletId: 1 });
  });

  it("devolve undefined em 204", async () => {
    const result = await handleResponse<void>(new Response(null, { status: 204 }));
    expect(result).toBeUndefined();
  });

  it("lança ApiError com mensagem e erros do envelope em 400", async () => {
    const response = jsonResponse(400, {
      sucesso: false,
      mensagem: "Dados inválidos.",
      erros: ["name: Nome é obrigatório.", "currency: Moeda inválida."],
    });

    const error = await catchError(handleResponse(response));

    expect(error.status).toBe(400);
    expect(error.mensagem).toBe("Dados inválidos.");
    expect(error.erros).toEqual(["name: Nome é obrigatório.", "currency: Moeda inválida."]);
  });

  it("chama o handler de 401 e lança ApiError", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    const error = await catchError(
      handleResponse(jsonResponse(401, { sucesso: false, mensagem: "Não autenticado.", erros: [] })),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(error.status).toBe(401);
    expect(error.mensagem).toBe("Não autenticado.");
  });

  it("não chama o handler de 401 quando notifyUnauthorized é false (login)", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    const error = await catchError(
      handleResponse(
        jsonResponse(401, { sucesso: false, mensagem: "Email ou senha inválidos.", erros: [] }),
        false,
      ),
    );

    expect(handler).not.toHaveBeenCalled();
    expect(error.mensagem).toBe("Email ou senha inválidos.");
  });

  it("usa mensagem genérica em 500 com texto puro", async () => {
    const response = new Response("System.NullReferenceException: Object reference…", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });

    const error = await catchError(handleResponse(response));

    expect(error.status).toBe(500);
    expect(error.mensagem).toBe(GENERIC_ERROR_MESSAGE);
    expect(error.erros).toEqual([]);
  });
});

describe("apiFetch", () => {
  it("converte erro de rede em ApiError com status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await catchError(apiFetch("/api/wallets"));

    expect(error.status).toBe(NETWORK_ERROR_STATUS);
    expect(error.isNetworkError).toBe(true);
    expect(error.mensagem).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("envia o Bearer da sessão e o corpo em JSON", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(makeSession("2999-01-01T00:00:00Z")));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/transactions/income", {
      method: "POST",
      body: { walletId: 1, amount: "0.00000001", description: null },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt-token");
    expect(init.body).toBe('{"walletId":1,"amount":"0.00000001","description":null}');
  });
});

// ---------------------------------------------------------------------------
// Feature 005 — cache network-first, timeout e conectividade (contracts/offline-cache.md)
// ---------------------------------------------------------------------------

const STATEMENT_PATH = "/api/statements/wallets/3?start=2026-10-01&end=2026-10-31";

const storeValidSession = () =>
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(makeSession("2999-01-01T00:00:00Z")));

/** `fetch` que só termina quando o sinal é abortado (servidor que não responde) */
const hangingFetch = () =>
  vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  );

describe("apiFetch — cache e conectividade (feature 005)", () => {
  afterEach(() => setUnauthorizedHandler(null));

  it("GET network-first 2xx devolve, grava no cache, informa dado novo e reporta online", async () => {
    storeValidSession();
    reportOffline();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { entries: [1, 2] })));
    const onFreshness = vi.fn();

    const result = await apiFetch(STATEMENT_PATH, { cache: "network-first", onFreshness });

    expect(result).toEqual({ entries: [1, 2] });
    expect(onFreshness).toHaveBeenCalledWith({ stale: false, fetchedAt: expect.any(String) });
    expect(getStatus()).toBe(ConnectivityStatus.Online);
    await vi.waitFor(async () => {
      expect((await offlineCache.get(7, STATEMENT_PATH))?.data).toEqual({ entries: [1, 2] });
    });
  });

  it("GET network-first não 2xx lança como hoje, não grava e reporta online", async () => {
    storeValidSession();
    reportOffline();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(500, { sucesso: false, mensagem: "Falhou.", erros: [] })),
    );

    const error = await catchError(apiFetch("/api/wallets", { cache: "network-first" }));

    expect(error.status).toBe(500);
    expect(error.mensagem).toBe("Falhou.");
    expect(getStatus()).toBe(ConnectivityStatus.Online);
    expect(await offlineCache.get(7, "/api/wallets")).toBeUndefined();
  });

  it("falha de rede com registro devolve o dado guardado como stale e reporta offline", async () => {
    storeValidSession();
    await offlineCache.set(7, STATEMENT_PATH, { entries: ["guardado"] });
    const saved = await offlineCache.get(7, STATEMENT_PATH);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const onFreshness = vi.fn();

    const result = await apiFetch(STATEMENT_PATH, { cache: "network-first", onFreshness });

    expect(result).toEqual({ entries: ["guardado"] });
    expect(onFreshness).toHaveBeenCalledWith({ stale: true, fetchedAt: saved?.fetchedAt });
    expect(getStatus()).toBe(ConnectivityStatus.Offline);
    expect(getOldestStaleFetchedAt()).toBe(saved?.fetchedAt);
  });

  it("falha de rede sem registro lança ApiError offline com 'conteúdo não disponível'", async () => {
    storeValidSession();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await catchError(apiFetch("/api/wallets", { cache: "network-first" }));

    expect(error.status).toBe(NETWORK_ERROR_STATUS);
    expect(error.mensagem).toBe(OFFLINE_CONTENT_MESSAGE);
    expect(error.offline).toBe(true);
    expect(getStatus()).toBe(ConnectivityStatus.Offline);
  });

  it("escrita com conectividade offline lança sem chamar fetch", async () => {
    storeValidSession();
    reportOffline();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const error = await catchError(
      apiFetch("/api/transactions/income", { method: "POST", body: { walletId: 1 } }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(error.status).toBe(NETWORK_ERROR_STATUS);
    expect(error.mensagem).toBe(OFFLINE_WRITE_MESSAGE);
    expect(error.offline).toBe(true);
  });

  it("rede cai durante a escrita → mensagem de rede atual, sem reenvio", async () => {
    storeValidSession();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const error = await catchError(
      apiFetch("/api/transactions/income", { method: "POST", body: { walletId: 1 } }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.mensagem).toBe(NETWORK_ERROR_MESSAGE);
    expect(error.offline).toBe(false);
    expect(getStatus()).toBe(ConnectivityStatus.Offline);
  });

  it(`cache "none": ${REQUEST_TIMEOUT_MS / 1000} s sem resposta viram erro de rede e reportam offline`, async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubGlobal("fetch", hangingFetch());
    let settled = false;
    const promise = catchError(apiFetch("/api/auth/me", { cache: "none" })).finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    expect(getStatus()).toBe(ConnectivityStatus.Online);

    await vi.advanceTimersByTimeAsync(1);
    const error = await promise;

    expect(error.mensagem).toBe(NETWORK_ERROR_MESSAGE);
    expect(error.offline).toBe(false);
    expect(getStatus()).toBe(ConnectivityStatus.Offline);
  });

  it("abort do chamador continua sendo AbortError e não marca offline", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();

    const promise = apiFetch("/api/oauth/requests/abc", { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(getStatus()).toBe(ConnectivityStatus.Online);
  });

  it("401 chama o handler e apaga o cache offline", async () => {
    storeValidSession();
    await offlineCache.set(7, "/api/wallets", ["guardado"]);
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { sucesso: false, mensagem: "Não autenticado.", erros: [] })),
    );

    const error = await catchError(apiFetch("/api/groups", { cache: "network-first" }));

    expect(error.status).toBe(401);
    expect(handler).toHaveBeenCalledTimes(1);
    await vi.waitFor(async () => {
      expect(await offlineCache.get(7, "/api/wallets")).toBeUndefined();
    });
  });

  it("sem sessão (sem userId) não grava no cache", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, ["público"])));

    await apiFetch("/api/wallets", { cache: "network-first" });
    // Dá tempo a uma gravação "dispara e esquece" que não deveria existir
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(await offlineCache.get(7, "/api/wallets")).toBeUndefined();
  });
});

describe("sessão armazenada", () => {
  it("descarta sessão vencida e não envia Bearer", () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(makeSession("2000-01-01T00:00:00Z")));

    expect(getHeaders(true).Authorization).toBeUndefined();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("descarta JSON corrompido", () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "{não é json");

    expect(readStoredSession()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
