/** Tipos de família (data-model §4) */

/** Quem pode ver saldos e extratos da família */
export enum StatementVisibility {
  ResponsibleOnly = "ResponsibleOnly",
  AllMembers = "AllMembers",
  MembersSummary = "MembersSummary",
}

/** Membro de uma família */
export interface GroupMemberInfo {
  userId: number;
  firstName: string;
  lastName: string;
  joinedAt: string;
}

/** Família como devolvida pela API */
export interface GroupInfo {
  groupId: number;
  name: string;
  responsibleUserId: number;
  /** A pessoa logada é a responsável */
  isResponsible: boolean;
  statementVisibility: StatementVisibility;
  members: GroupMemberInfo[];
}

/** Corpo de `POST /api/groups` */
export interface GroupInsertInfo {
  name: string;
}

/** Corpo de `PUT /api/groups/{id}` (campos `null` não mudam) */
export interface GroupUpdateInfo {
  name: string | null;
  statementVisibility: StatementVisibility | null;
}

/** Corpo de `POST /api/groups/{id}/members` */
export interface AddMemberInfo {
  userId: number;
}
