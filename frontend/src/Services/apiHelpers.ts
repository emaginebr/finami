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
import type { FreshnessInfo } from "../types/connectivity";
import { getStatus, reportFreshness, reportOffline, reportOnline } from "../utils/connectivity";
import { offlineCache } from "../utils/offlineCache";

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
    if (response.status === 401 && notifyUnauthorized) {
      // Sessão rejeitada: os dados guardados para uso offline saem junto (FR-015)
      void offlineCache.clearAll();
      unauthorizedHandler?.();
    }
    throw buildApiError(response.status, body);
  }

  if (response.status === 204 || body.trim().length === 0) return undefined as T;

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ApiError(response.status, GENERIC_ERROR_MESSAGE);
  }
};

/** Tempo máximo sem resposta antes de tratar a chamada como falha de rede (research R-04) */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Opções de `apiFetch` */
export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Objeto serializado como JSON no corpo */
  body?: unknown;
  /** Envia o Bearer da sessão (padrão `true`) */
  authenticated?: boolean;
  signal?: AbortSignal;
  /** `"network-first"`: só para GET autenticado de consulta (lista em contracts/offline-cache.md). Padrão `"none"`. */
  cache?: "network-first" | "none";
  /** Recebe a procedência do dado (para o indicador de dados antigos) */
  onFreshness?: (info: FreshnessInfo) => void;
}

const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === "AbortError";

/**
 * `fetch` com timeout de `REQUEST_TIMEOUT_MS` combinado com o `signal` do chamador.
 * Feito com AbortController + setTimeout (sem `AbortSignal.timeout/any`, ausentes no jsdom
 * e incompatíveis com timers falsos). Abort do chamador é relançado como está; falha de rede
 * ou timeout viram `null` (o chamador decide o que fazer).
 */
const fetchWithTimeout = async (url: string, init: RequestInit, signal?: AbortSignal): Promise<Response | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (signal?.aborted && isAbortError(err)) throw err;
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }
};

/**
 * Faz a chamada à API (`API_URL + path`) e trata a resposta com `handleResponse`.
 * - Falhas de rede (ou 10 s sem resposta) viram `ApiError` com status 0 e mensagem genérica
 *   e marcam a conectividade como offline; qualquer resposta HTTP marca online.
 * - Escrita autenticada com a conectividade offline é recusada antes do `fetch` (R-05).
 * - `cache: "network-first"` (GET autenticado): grava a resposta 2xx no cache da sessão e,
 *   sem rede, devolve o dado guardado como antigo (`stale`).
 * O handler de 401 só é acionado em requisições autenticadas.
 */
export const apiFetch = async <T>(path: string, options: ApiFetchOptions = {}): Promise<T> => {
  const { method = "GET", body, authenticated = true, signal, onFreshness } = options;
  const networkFirst = options.cache === "network-first" && method === "GET" && authenticated;

  // Login/cadastro (anônimos) seguem para a rede e mostram o erro de rede atual (T043)
  if (method !== "GET" && authenticated && getStatus() === ConnectivityStatus.Offline) {
    throw new ApiError(NETWORK_ERROR_STATUS, OFFLINE_WRITE_MESSAGE, [], { offline: true });
  }

  const userId = networkFirst ? (readStoredSession()?.user.userId ?? null) : null;

  const response = await fetchWithTimeout(
    `${API_URL}${path}`,
    {
      method,
      headers: getHeaders(authenticated),
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    signal,
  );

  if (response === null) {
    reportOffline();
    if (networkFirst) {
      const entry = userId !== null ? await offlineCache.get(userId, path) : undefined;
      if (entry) {
        const info: FreshnessInfo = { stale: true, fetchedAt: entry.fetchedAt };
        reportFreshness(info);
        onFreshness?.(info);
        return entry.data as T;
      }
      throw new ApiError(NETWORK_ERROR_STATUS, OFFLINE_CONTENT_MESSAGE, [], { offline: true });
    }
    throw new ApiError(NETWORK_ERROR_STATUS, NETWORK_ERROR_MESSAGE);
  }

  reportOnline();
  const data = await handleResponse<T>(response, authenticated);

  if (networkFirst) {
    const info: FreshnessInfo = { stale: false, fetchedAt: new Date().toISOString() };
    reportFreshness(info);
    onFreshness?.(info);
    // Só grava se a sessão continua a mesma (logout durante a chamada não deixa dado para trás).
    // Gravação "dispara e esquece": o IndexedDB nunca atrasa a resposta.
    if (userId !== null && data !== undefined && readStoredSession()?.user.userId === userId) {
      void offlineCache.set(userId, path, data);
    }
  }

  return data;
};
