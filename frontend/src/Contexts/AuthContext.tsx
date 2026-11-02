import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { authService } from "../Services/authService";
import {
  AUTH_STORAGE_KEY,
  clearStoredSession,
  readStoredSession,
  setUnauthorizedHandler,
  writeStoredSession,
} from "../Services/apiHelpers";
import { GENERIC_ERROR_MESSAGE, isApiError } from "../types/api";
import { AuthStatus } from "../types/auth";
import type {
  AuthResult,
  AuthSession,
  GoogleLoginInfo,
  LoginInfo,
  RegisterInfo,
} from "../types/auth";
import type { UserInfo } from "../types/user";
import { offlineCache } from "../utils/offlineCache";

/** Motivo exibido na tela de entrada quando a sessão cai por 401 ou expiração */
export const SESSION_EXPIRED_MESSAGE = "Sua sessão expirou. Entre novamente.";

/** Maior atraso aceito por `setTimeout` (~24,8 dias) */
const MAX_TIMEOUT_MS = 2_147_483_647;

export interface AuthContextType {
  // Estado
  session: AuthSession | null;
  status: AuthStatus;
  loading: boolean;
  error: string | null;
  /** Por que a sessão terminou sem a pessoa pedir (ex.: "Sua sessão expirou…"); `null` no logout manual */
  logoutReason: string | null;
  // Métodos
  login: (data: LoginInfo) => Promise<AuthResult>;
  register: (data: RegisterInfo) => Promise<AuthResult>;
  loginWithGoogle: (data: GoogleLoginInfo) => Promise<AuthResult>;
  logout: () => void;
  refreshMe: () => Promise<UserInfo>;
  clearError: () => void;
  clearLogoutReason: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toErrorMessage = (err: unknown): string => {
  if (isApiError(err)) return err.mensagem;
  if (err instanceof Error && err.message) return err.message;
  return GENERIC_ERROR_MESSAGE;
};

const toSession = (result: AuthResult): AuthSession => ({
  token: result.token,
  expiresAt: result.expiresAt,
  user: result.user,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>(AuthStatus.Checking);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoutReason, setLogoutReason] = useState<string | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);

  const applySession = useCallback((next: AuthSession | null) => {
    sessionRef.current = next;
    setSession(next);
    setStatus(next ? AuthStatus.Authenticated : AuthStatus.Anonymous);
  }, []);

  const handleError = useCallback((err: unknown): never => {
    setError(toErrorMessage(err));
    throw err;
  }, []);

  /** Encerra a sessão sem ação da pessoa (401 ou expiração); apaga os dados offline (FR-015) */
  const expireSession = useCallback(() => {
    clearStoredSession();
    void offlineCache.clearAll();
    applySession(null);
    setLogoutReason(SESSION_EXPIRED_MESSAGE);
  }, [applySession]);

  // Restaura a sessão salva (descarta vencida ou corrompida)
  useEffect(() => {
    const stored = readStoredSession();
    // Sem sessão válida (venceu com o app fechado, corrompida): nenhum dado offline pode ficar
    if (!stored) void offlineCache.clearAll();
    applySession(stored);
  }, [applySession]);

  // Qualquer 401 em requisição autenticada derruba a sessão
  useEffect(() => {
    setUnauthorizedHandler(expireSession);
    return () => setUnauthorizedHandler(null);
  }, [expireSession]);

  // Encerra a sessão quando o token vence com o app aberto
  useEffect(() => {
    if (!session) return undefined;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    if (Number.isNaN(remaining) || remaining <= 0) {
      expireSession();
      return undefined;
    }
    // Prazos acima do limite do setTimeout ficam a cargo do 401 do servidor
    if (remaining > MAX_TIMEOUT_MS) return undefined;
    const timer = window.setTimeout(expireSession, remaining);
    return () => window.clearTimeout(timer);
  }, [session, expireSession]);

  // Mantém abas abertas em sincronia (entrar/sair em outra aba)
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== AUTH_STORAGE_KEY) return;
      applySession(readStoredSession());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [applySession]);

  const startSession = useCallback(
    (result: AuthResult) => {
      const next = toSession(result);
      writeStoredSession(next);
      setLogoutReason(null);
      applySession(next);
    },
    [applySession],
  );

  const runAuth = useCallback(
    async (action: () => Promise<AuthResult>): Promise<AuthResult> => {
      try {
        setLoading(true);
        setError(null);
        const result = await action();
        startSession(result);
        return result;
      } catch (err) {
        return handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [startSession, handleError],
  );

  const login = useCallback(
    (data: LoginInfo) => runAuth(() => authService.login(data)),
    [runAuth],
  );

  const register = useCallback(
    (data: RegisterInfo) => runAuth(() => authService.register(data)),
    [runAuth],
  );

  const loginWithGoogle = useCallback(
    (data: GoogleLoginInfo) => runAuth(() => authService.loginWithGoogle(data)),
    [runAuth],
  );

  const logout = useCallback(() => {
    clearStoredSession();
    // Dados guardados para uso offline saem junto com a sessão (FR-015)
    void offlineCache.clearAll();
    setError(null);
    setLogoutReason(null);
    applySession(null);
  }, [applySession]);

  const refreshMe = useCallback(async (): Promise<UserInfo> => {
    try {
      setError(null);
      const user = await authService.me();
      const current = sessionRef.current;
      if (current) {
        const next: AuthSession = { ...current, user };
        writeStoredSession(next);
        applySession(next);
      }
      return user;
    } catch (err) {
      return handleError(err);
    }
  }, [applySession, handleError]);

  const clearError = useCallback(() => setError(null), []);
  const clearLogoutReason = useCallback(() => setLogoutReason(null), []);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      status,
      loading,
      error,
      logoutReason,
      login,
      register,
      loginWithGoogle,
      logout,
      refreshMe,
      clearError,
      clearLogoutReason,
    }),
    [
      session,
      status,
      loading,
      error,
      logoutReason,
      login,
      register,
      loginWithGoogle,
      logout,
      refreshMe,
      clearError,
      clearLogoutReason,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
