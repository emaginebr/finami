import type { GroupInfo } from "../types/group";
import { GroupInvitationStatus } from "../types/invitation";
import type {
  GroupInvitationInfo,
  GroupInvitationInsertInfo,
  MemberLookupInfo,
  MemberLookupResult,
  NewMemberInfo,
} from "../types/invitation";
import { apiFetch } from "./apiHelpers";

const GROUPS_BASE = "/api/groups";
const INVITATIONS_BASE = "/api/invitations";

/**
 * Invitation Service — adicionar membro e convites (specs/003 contracts/api.md).
 * Devolve o DTO direto e lança `ApiError` em não-2xx.
 */
class InvitationService {
  /** Verifica o email antes de adicionar (`POST /api/groups/{id}/member-lookup`) */
  async lookupMember(groupId: number, email: string): Promise<MemberLookupResult> {
    const body: MemberLookupInfo = { email };
    return apiFetch<MemberLookupResult>(`${GROUPS_BASE}/${groupId}/member-lookup`, {
      method: "POST",
      body,
    });
  }

  /** Cadastra a pessoa e inclui na família; 409 se o email já existir (`POST …/members/new`) */
  async createMember(groupId: number, data: NewMemberInfo): Promise<GroupInfo> {
    return apiFetch<GroupInfo>(`${GROUPS_BASE}/${groupId}/members/new`, { method: "POST", body: data });
  }

  /** Convida uma pessoa cadastrada pelo email (`POST /api/groups/{id}/invitations`) */
  async invite(groupId: number, email: string): Promise<GroupInvitationInfo> {
    const body: GroupInvitationInsertInfo = { email };
    return apiFetch<GroupInvitationInfo>(`${GROUPS_BASE}/${groupId}/invitations`, { method: "POST", body });
  }

  /** Convites pendentes da família, mais recentes primeiro (`GET /api/groups/{id}/invitations`) */
  async listPending(groupId: number): Promise<GroupInvitationInfo[]> {
    return apiFetch<GroupInvitationInfo[]>(
      `${GROUPS_BASE}/${groupId}/invitations?status=${GroupInvitationStatus.Pending}`,
      { cache: "network-first" },
    );
  }

  /** Cancela um convite pendente (`DELETE /api/groups/{id}/invitations/{invitationId}`) */
  async cancel(groupId: number, invitationId: number): Promise<GroupInvitationInfo> {
    return apiFetch<GroupInvitationInfo>(`${GROUPS_BASE}/${groupId}/invitations/${invitationId}`, {
      method: "DELETE",
    });
  }

  /** Aceita o próprio convite (`POST /api/invitations/{id}/accept`) */
  async accept(invitationId: number): Promise<GroupInvitationInfo> {
    return apiFetch<GroupInvitationInfo>(`${INVITATIONS_BASE}/${invitationId}/accept`, { method: "POST" });
  }

  /** Recusa o próprio convite (`POST /api/invitations/{id}/decline`) */
  async decline(invitationId: number): Promise<GroupInvitationInfo> {
    return apiFetch<GroupInvitationInfo>(`${INVITATIONS_BASE}/${invitationId}/decline`, { method: "POST" });
  }
}

export const invitationService = new InvitationService();
export default InvitationService;
