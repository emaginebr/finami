/** Tipos da área de notificações (specs/003 data-model, contracts/api.md) */
import type { GroupInvitationStatus, UserSummaryInfo } from "./invitation";

/** Tipos de notificação desta versão */
export enum NotificationType {
  /** Convite recebido (para o convidado) */
  GroupInvitationReceived = "GroupInvitationReceived",
  /** O convidado aceitou (para quem convidou) */
  GroupInvitationAccepted = "GroupInvitationAccepted",
  /** O convidado recusou (para quem convidou) */
  GroupInvitationDeclined = "GroupInvitationDeclined",
}

/** Família citada na notificação */
export interface NotificationGroupInfo {
  groupId: number;
  name: string;
}

/** Convite citado na notificação, com o estado **atual** */
export interface NotificationInvitationInfo {
  invitationId: number;
  status: GroupInvitationStatus;
}

/** Notificação como devolvida pela API */
export interface NotificationInfo {
  notificationId: number;
  type: NotificationType;
  createdAt: string;
  isRead: boolean;
  group: NotificationGroupInfo | null;
  /** Quem causou (convidante ou convidado) */
  actor: UserSummaryInfo | null;
  invitation: NotificationInvitationInfo | null;
}

/** Página de `GET /api/notifications` (cursor `beforeId`) */
export interface NotificationPage {
  items: NotificationInfo[];
  /** Cursor da próxima página; `null` quando não há mais */
  nextBeforeId: number | null;
}

/** Resposta de `GET /api/notifications/unread-count` */
export interface UnreadCountResult {
  unread: number;
}

/** Corpo de `POST /api/notifications/read` (1–100 ids) */
export interface MarkReadInfo {
  notificationIds: number[];
}

/** Filtros de `GET /api/notifications` */
export interface NotificationListFilters {
  beforeId?: number | null;
  /** 1–50 (padrão 20) */
  limit?: number;
}
