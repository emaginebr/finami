import {
  ApiError,
  GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  NETWORK_ERROR_STATUS,
} from "../types/api";
import type { AuthSession } from "../types/auth";

/** URL base da API, sem barra no final */
export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

/** Chave da sessão no localStorage (constituição, Princípio VI) */
export const AUTH_STORAGE_KEY = "finami:auth";

// ---------------------------------------------------------------------------
// Sessão persistida
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isValidSessionShape = (value: unknown): value is AuthSession =>
  isRecord(value) &&
  typeof value.token === "string" &&
  value.token.length > 0 &&
  typeof value.expiresAt === "string" &&
  isRecord(value.user) &&
  typeof value.user.userId === "number";

/** `true` quando a sessão já venceu (ou a data é inválida) */
export const isSessionExpired = (session: AuthSession, now: number = Date.now()): boolean => {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= now;
};

/** Remove a sessão do localStorage */
export const clearStoredSession = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

/** Grava a sessão no localStorage */
export const writeStoredSession = (session: AuthSession): void => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

/**
 * Lê a sessão do localStorage. Sessão vencida, corrompida ou com formato
 * inesperado é removida e o retorno é `null`.
 */
export const readStoredSession = (): AuthSession | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSessionShape(parsed) || isSessionExpired(parsed)) {
      clearStoredSession();
      return null;
    }
    return parsed;
  } catch {
    clearStoredSession();
    return null;
  }
};

// ---------------------------------------------------------------------------
// Cabeçalhos e tratamento de 401
// ---------------------------------------------------------------------------

/** Cabeçalhos padrão; com `authenticated`, inclui o Bearer da sessão válida */
export const getHeaders = (authenticated: boolean): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (authenticated) {
    const session = readStoredSession();
    if (session) headers.Authorization = `Bearer ${session.token}`;
  }
  return headers;
};

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registra (ou remove, com `null`) a função chamada quando a API responde 401 */
export const setUnauthorizedHandler = (fn: UnauthorizedHandler | null): void => {
  unauthorizedHandler = fn;
};

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  // ProblemDetails do ASP.NET: { errors: { Campo: ["msg"] } }
  if (isRecord(value)) {
    return Object.values(value).flatMap((item) => toStringArray(item));
  }
  return [];
};

const buildApiError = (status: number, body: string): ApiError => {
  if (body.trim().length === 0) return new ApiError(status, GENERIC_ERROR_MESSAGE);
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) return new ApiError(status, GENERIC_ERROR_MESSAGE);
    const erros = toStringArray(parsed.erros ?? parsed.errors);
    const mensagem =
      typeof parsed.mensagem === "string" && parsed.mensagem.trim().length > 0
        ? parsed.mensagem
        : typeof parsed.title === "string" && parsed.title.trim().length > 0
          ? parsed.title
          : (erros[0] ?? GENERIC_ERROR_MESSAGE);
    return new ApiError(status, mensagem, erros);
  } catch {
    // Corpo não é JSON (ex.: 500 com texto puro) — não expõe detalhes técnicos
    return new ApiError(status, GENERIC_ERROR_MESSAGE);
  }
};

/**
 * Converte a resposta da API: devolve o JSON (ou `undefined` sem corpo / 204)
 * em 2xx; em não-2xx lança `ApiError` a partir do envelope `{ sucesso, mensagem, erros }`.
 * Em 401 chama o handler registrado, exceto quando `notifyUnauthorized` for `false`
 * (ex.: login com senha errada).
 */
export const handleResponse = async <T>(
  response: Response,
  notifyUnauthorized: boolean = true,
): Promise<T> => {
  const body = await response.text();

  if (!response.ok) {
    if (response.status === 401 && notifyUnauthorized) unauthorizedHandler?.();
    throw buildApiError(response.status, body);
  }

  if (response.status === 204 || body.trim().length === 0) return undefined as T;

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ApiError(response.status, GENERIC_ERROR_MESSAGE);
  }
};

/** Opções de `apiFetch` */
export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Objeto serializado como JSON no corpo */
  body?: unknown;
  /** Envia o Bearer da sessão (padrão `true`) */
  authenticated?: boolean;
  signal?: AbortSignal;
}

/**
 * Faz a chamada à API (`API_URL + path`) e trata a resposta com `handleResponse`.
 * Falhas de rede viram `ApiError` com status 0 e mensagem genérica.
 * O handler de 401 só é acionado em requisições autenticadas.
 */
export const apiFetch = async <T>(path: string, options: ApiFetchOptions = {}): Promise<T> => {
  const { method = "GET", body, authenticated = true, signal } = options;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: getHeaders(authenticated),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(NETWORK_ERROR_STATUS, NETWORK_ERROR_MESSAGE);
  }
  return handleResponse<T>(response, authenticated);
};
