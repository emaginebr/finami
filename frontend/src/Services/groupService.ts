import type { AddMemberInfo, GroupInfo, GroupInsertInfo, GroupUpdateInfo } from "../types/group";
import { apiFetch } from "./apiHelpers";

const API_BASE = "/api/groups";

/**
 * Group Service — rotas de `/api/groups`.
 * Devolve o DTO direto e lança `ApiError` em não-2xx (research R-02).
 */
class GroupService {
  /** Famílias de que a pessoa participa (`GET /api/groups`) */
  async list(): Promise<GroupInfo[]> {
    return apiFetch<GroupInfo[]>(API_BASE);
  }

  /** Uma família (`GET /api/groups/{id}`) */
  async get(groupId: number): Promise<GroupInfo> {
    return apiFetch<GroupInfo>(`${API_BASE}/${groupId}`);
  }

  /** Cria uma família; a pessoa vira responsável (`POST /api/groups`) */
  async create(data: GroupInsertInfo): Promise<GroupInfo> {
    return apiFetch<GroupInfo>(API_BASE, { method: "POST", body: data });
  }

  /** Renomeia ou muda a visibilidade (`PUT /api/groups/{id}`) */
  async update(groupId: number, data: GroupUpdateInfo): Promise<GroupInfo> {
    return apiFetch<GroupInfo>(`${API_BASE}/${groupId}`, { method: "PUT", body: data });
  }

  /** Inclui membro; 409 se já for membro (`POST /api/groups/{id}/members`) */
  async addMember(groupId: number, data: AddMemberInfo): Promise<GroupInfo | undefined> {
    return apiFetch<GroupInfo | undefined>(`${API_BASE}/${groupId}/members`, {
      method: "POST",
      body: data,
    });
  }

  /** Retira membro (`DELETE /api/groups/{id}/members/{userId}`) */
  async removeMember(groupId: number, userId: number): Promise<void> {
    await apiFetch<void>(`${API_BASE}/${groupId}/members/${userId}`, { method: "DELETE" });
  }
}

export const groupService = new GroupService();
export default GroupService;
