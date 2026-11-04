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
  /** "Pode lançar" nas carteiras da família (feature 008; responsável: sempre `true`) */
  canCreateTransactions: boolean;
  /** "Pode estornar" lançamentos das carteiras da família (feature 008; responsável: sempre `true`) */
  canReverse: boolean;
}

/** Permissões efetivas de um membro numa família (feature 008) */
export interface MemberPermissions {
  canCreateTransactions: boolean;
  canReverse: boolean;
}

/** Corpo de `PUT /api/groups/{groupId}/members/{userId}/permissions` (os dois obrigatórios) */
export type MemberPermissionsInfo = MemberPermissions;

/** Família como devolvida pela API */
export interface GroupInfo {
  groupId: number;
  name: string;
  responsibleUserId: number;
  /** A pessoa logada é a responsável */
  isResponsible: boolean;
  statementVisibility: StatementVisibility;
  members: GroupMemberInfo[];
  /** Permissões de quem consulta nesta família (feature 008; responsável: tudo `true`) */
  myPermissions: MemberPermissions;
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
