import type { AuthResult, GoogleLoginInfo, LoginInfo, RegisterInfo } from "../types/auth";
import type { UserInfo } from "../types/user";
import { apiFetch } from "./apiHelpers";

const API_BASE = "/api/auth";

/**
 * Auth Service — login, cadastro e dados da pessoa autenticada.
 * Devolve o DTO direto e lança `ApiError` em respostas não-2xx (research R-02).
 */
class AuthService {
  /** Entra com email e senha (`POST /api/auth/login`). 401 = credenciais inválidas. */
  async login(data: LoginInfo): Promise<AuthResult> {
    return apiFetch<AuthResult>(`${API_BASE}/login`, {
      method: "POST",
      body: data,
      authenticated: false,
    });
  }

  /** Cria a conta e já devolve a sessão (`POST /api/auth/register`). */
  async register(data: RegisterInfo): Promise<AuthResult> {
    return apiFetch<AuthResult>(`${API_BASE}/register`, {
      method: "POST",
      body: data,
      authenticated: false,
    });
  }

  /** Entra com o ID token do Google (`POST /api/auth/google`). */
  async loginWithGoogle(data: GoogleLoginInfo): Promise<AuthResult> {
    return apiFetch<AuthResult>(`${API_BASE}/google`, {
      method: "POST",
      body: data,
      authenticated: false,
    });
  }

  /** Dados atualizados da pessoa autenticada (`GET /api/auth/me`); guardado para uso offline. */
  async me(): Promise<UserInfo> {
    return apiFetch<UserInfo>(`${API_BASE}/me`, { cache: "network-first" });
  }
}

export const authService = new AuthService();
export default AuthService;
