import type {
  PasswordChangeInfo,
  UserInfo,
  UserInsertInfo,
  UserSearchInfo,
  UserUpdateInfo,
} from "../types/user";
import { isApiError } from "../types/api";
import { apiFetch } from "./apiHelpers";

const API_BASE = "/api/users";

/**
 * User Service — rotas de `/api/users`.
 * Devolve o DTO direto e lança `ApiError` em não-2xx (research R-02).
 */
class UserService {
  /** Cadastra outra pessoa, com ou sem login (`POST /api/users`) */
  async create(data: UserInsertInfo): Promise<UserInfo> {
    return apiFetch<UserInfo>(API_BASE, { method: "POST", body: data });
  }

  /** Uma pessoa (`GET /api/users/{id}`) */
  async get(userId: number): Promise<UserInfo> {
    return apiFetch<UserInfo>(`${API_BASE}/${userId}`, { cache: "network-first" });
  }

  /** Atualiza nome, sobrenome e email (`PUT /api/users/{id}`) */
  async update(userId: number, data: UserUpdateInfo): Promise<UserInfo> {
    return apiFetch<UserInfo>(`${API_BASE}/${userId}`, { method: "PUT", body: data });
  }

  /** Define ou troca a senha (`PUT /api/users/{id}/password`) */
  async changePassword(userId: number, data: PasswordChangeInfo): Promise<void> {
    await apiFetch<void>(`${API_BASE}/${userId}/password`, { method: "PUT", body: data });
  }

  /** Pessoas cadastradas por quem está logado (`GET /api/users/created-by-me`) */
  async createdByMe(): Promise<UserInfo[]> {
    return apiFetch<UserInfo[]>(`${API_BASE}/created-by-me`, { cache: "network-first" });
  }

  /** Busca exata por email; `null` quando não encontra (`GET /api/users/search?email=`) */
  async searchByEmail(email: string): Promise<UserSearchInfo | null> {
    try {
      const result = await apiFetch<UserSearchInfo | UserSearchInfo[] | undefined>(
        `${API_BASE}/search?${new URLSearchParams({ email }).toString()}`,
      );
      if (Array.isArray(result)) return result[0] ?? null;
      return result ?? null;
    } catch (err) {
      if (isApiError(err) && err.status === 404) return null;
      throw err;
    }
  }
}

export const userService = new UserService();
export default UserService;
