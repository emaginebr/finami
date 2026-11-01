import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_STORAGE_KEY,
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
} from "../types/api";
import type { AuthSession } from "../types/auth";

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
