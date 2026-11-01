/** Tipos de convites para famílias (specs/003 data-model, contracts/api.md) */

/** Resultado da verificação do email em "Adicionar membro" */
export enum MemberLookupStatus {
  /** Email sem conta: cadastrar a pessoa e incluir */
  Available = "Available",
  /** Email de alguém que não é membro: oferecer convite */
  Registered = "Registered",
  /** Já é membro (inclusive o próprio responsável) */
  AlreadyMember = "AlreadyMember",
  /** Já existe convite pendente para a pessoa nesta família */
  PendingInvite = "PendingInvite",
}

/** Estado de um convite */
export enum GroupInvitationStatus {
  Pending = "Pending",
  Accepted = "Accepted",
  Declined = "Declined",
  Canceled = "Canceled",
}

/** Resposta do convidado a um convite */
export enum InvitationResponse {
  Accept = "accept",
  Decline = "decline",
}

/** Resumo de uma pessoa (só nome — FR-008) */
export interface UserSummaryInfo {
  userId: number;
  firstName: string;
  lastName: string;
}

/** Corpo de `POST /api/groups/{id}/member-lookup` */
export interface MemberLookupInfo {
  email: string;
}

/** Resposta de `POST /api/groups/{id}/member-lookup` */
export interface MemberLookupResult {
  status: MemberLookupStatus;
  /** Email normalizado (trim + minúsculas) */
  email: string;
  /** Pessoa dona do email; `null` quando `Available` */
  user: UserSummaryInfo | null;
  /** Convite pendente, quando `PendingInvite` */
  invitationId: number | null;
}

/** Corpo de `POST /api/groups/{id}/members/new` */
export interface NewMemberInfo {
  firstName: string;
  lastName: string;
  /** `null` = pessoa sem email (não entra no app) */
  email: string | null;
}

/** Corpo de `POST /api/groups/{id}/invitations` */
export interface GroupInvitationInsertInfo {
  email: string;
}

/** Convite como devolvido pela API */
export interface GroupInvitationInfo {
  invitationId: number;
  groupId: number;
  groupName: string;
  invitedUser: UserSummaryInfo;
  invitedBy: UserSummaryInfo;
  status: GroupInvitationStatus;
  createdAt: string;
  respondedAt: string | null;
}
