import type {
  MarkReadInfo,
  NotificationListFilters,
  NotificationPage,
  UnreadCountResult,
} from "../types/notification";
import { apiFetch } from "./apiHelpers";

const API_BASE = "/api/notifications";

/**
 * Notification Service — rotas de `/api/notifications` (só as do próprio usuário).
 * Devolve o DTO direto e lança `ApiError` em não-2xx.
 */
class NotificationService {
  /** Página de notificações, mais recentes primeiro (`GET /api/notifications?beforeId=&limit=`) */
  async list(filters: NotificationListFilters = {}): Promise<NotificationPage> {
    const params = new URLSearchParams();
    if (filters.beforeId !== undefined && filters.beforeId !== null) {
      params.set("beforeId", String(filters.beforeId));
    }
    if (filters.limit !== undefined) params.set("limit", String(filters.limit));
    const query = params.toString();
    // Só a primeira página (sem cursor) fica guardada para uso offline (feature 005)
    const firstPage = filters.beforeId === undefined || filters.beforeId === null;
    return apiFetch<NotificationPage>(query ? `${API_BASE}?${query}` : API_BASE, {
      cache: firstPage ? "network-first" : "none",
    });
  }

  /** Quantidade de não lidas (`GET /api/notifications/unread-count`) */
  async unreadCount(): Promise<UnreadCountResult> {
    return apiFetch<UnreadCountResult>(`${API_BASE}/unread-count`, { cache: "network-first" });
  }

  /** Marca como lidas; ids de outros usuários são ignorados (`POST /api/notifications/read`) */
  async markRead(notificationIds: number[]): Promise<void> {
    const body: MarkReadInfo = { notificationIds };
    await apiFetch<void>(`${API_BASE}/read`, { method: "POST", body });
  }
}

export const notificationService = new NotificationService();
export default NotificationService;
