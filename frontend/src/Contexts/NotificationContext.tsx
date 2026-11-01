import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { notificationService } from "../Services/notificationService";
import type { GroupInvitationStatus } from "../types/invitation";
import type { NotificationInfo } from "../types/notification";
import { errorMessage } from "../utils/notify";
import { useOnUserChange } from "../hooks/useOnUserChange";

/** Atualização automática do contador (só com a aba visível) — research R-06 */
export const NOTIFICATION_REFRESH_MS = 60_000;
/** Intervalo mínimo entre atualizações disparadas por troca de rota */
export const NOTIFICATION_MIN_REFRESH_MS = 10_000;
/** Itens por página */
export const NOTIFICATION_PAGE_SIZE = 20;
/** Máximo de ids por chamada de `POST /api/notifications/read` */
const MARK_READ_BATCH = 100;

export interface NotificationContextType {
  // Estado
  /** Não lidas (sino) */
  unread: number;
  /** Notificações carregadas, mais recentes primeiro */
  items: NotificationInfo[];
  /** Cursor da próxima página; `null` quando não há mais */
  nextBeforeId: number | null;
  loading: boolean;
  error: string | null;
  // Métodos
  /** Busca o contador agora; nunca lança */
  refreshUnread: () => Promise<void>;
  /** Busca o contador se a última busca tiver mais de 10 s (troca de rota); nunca lança */
  refreshUnreadIfStale: () => void;
  /** Recarrega a primeira página e devolve os itens */
  loadFirstPage: () => Promise<NotificationInfo[]>;
  /** Carrega a próxima página e devolve só os itens novos */
  loadMore: () => Promise<NotificationInfo[]>;
  /** Marca como lidas e desconta do contador; nunca lança */
  markRead: (ids: number[]) => Promise<void>;
  /** Reflete localmente o novo estado de um convite (após aceitar/recusar) */
  setInvitationStatus: (invitationId: number, status: GroupInvitationStatus) => void;
  clearError: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationInfo[]>([]);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastUnreadAt = useRef(0);
  const nextRef = useRef<number | null>(null);

  const userId = useOnUserChange(() => {
    lastUnreadAt.current = 0;
    nextRef.current = null;
    setUnread(0);
    setItems([]);
    setNextBeforeId(null);
    setError(null);
  });
  const userRef = useRef(userId);
  userRef.current = userId;

  const refreshUnread = useCallback(async (): Promise<void> => {
    if (userRef.current === null) return;
    lastUnreadAt.current = Date.now();
    try {
      const result = await notificationService.unreadCount();
      setUnread(Math.max(0, result.unread));
    } catch {
      // Contador é auxiliar: mantém o último valor e tenta de novo na próxima oportunidade
    }
  }, []);

  const refreshUnreadIfStale = useCallback((): void => {
    if (Date.now() - lastUnreadAt.current < NOTIFICATION_MIN_REFRESH_MS) return;
    void refreshUnread();
  }, [refreshUnread]);

  // Ao entrar, a cada 60 s com a aba visível e ao voltar para a aba (research R-06)
  useEffect(() => {
    if (userId === null) return undefined;
    refreshUnreadIfStale();
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refreshUnread();
    };
    const timer = window.setInterval(refreshIfVisible, NOTIFICATION_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [userId, refreshUnread, refreshUnreadIfStale]);

  const loadPage = useCallback(async (beforeId: number | null): Promise<NotificationInfo[]> => {
    try {
      setLoading(true);
      setError(null);
      const page = await notificationService.list({ beforeId, limit: NOTIFICATION_PAGE_SIZE });
      nextRef.current = page.nextBeforeId;
      setNextBeforeId(page.nextBeforeId);
      setItems((prev) => {
        if (beforeId === null) return page.items;
        const known = new Set(prev.map((item) => item.notificationId));
        return [...prev, ...page.items.filter((item) => !known.has(item.notificationId))];
      });
      return page.items;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFirstPage = useCallback(() => loadPage(null), [loadPage]);

  const loadMore = useCallback(async (): Promise<NotificationInfo[]> => {
    if (nextRef.current === null) return [];
    return loadPage(nextRef.current);
  }, [loadPage]);

  const markRead = useCallback(async (ids: number[]): Promise<void> => {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    try {
      for (let start = 0; start < unique.length; start += MARK_READ_BATCH) {
        await notificationService.markRead(unique.slice(start, start + MARK_READ_BATCH));
      }
      // O indicador "não lida" dos itens continua visível na tela (components.md §7);
      // só o contador do sino é descontado
      setUnread((prev) => Math.max(0, prev - unique.length));
      void refreshUnread();
    } catch {
      // Sem efeito visível: as notificações continuam não lidas e o sino mantém o número
    }
  }, [refreshUnread]);

  const setInvitationStatus = useCallback((invitationId: number, status: GroupInvitationStatus) => {
    setItems((prev) =>
      prev.map((item) =>
        item.invitation?.invitationId === invitationId
          ? { ...item, invitation: { ...item.invitation, status } }
          : item,
      ),
    );
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<NotificationContextType>(
    () => ({
      unread,
      items,
      nextBeforeId,
      loading,
      error,
      refreshUnread,
      refreshUnreadIfStale,
      loadFirstPage,
      loadMore,
      markRead,
      setInvitationStatus,
      clearError,
    }),
    [
      unread,
      items,
      nextBeforeId,
      loading,
      error,
      refreshUnread,
      refreshUnreadIfStale,
      loadFirstPage,
      loadMore,
      markRead,
      setInvitationStatus,
      clearError,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export default NotificationContext;
