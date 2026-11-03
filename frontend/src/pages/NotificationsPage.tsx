import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BellOff } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LargeTitleHeader } from "../components/layout/LargeTitleHeader";
import { AppTab, NOTIFICATIONS_PATH, readNavState } from "../components/layout/navigation";
import type { NavState } from "../components/layout/navigation";
import { NotificationItem } from "../components/notification/NotificationItem";
import { focusNotification } from "../components/notification/notificationFocus";
import { OfflineContent } from "../components/pwa/OfflineContent";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Skeleton } from "../components/ui/Skeleton";
import { ButtonSize, ButtonVariant } from "../components/ui/variants";
import { useGroup } from "../hooks/useGroup";
import { useInvitation } from "../hooks/useInvitation";
import { useNotification } from "../hooks/useNotification";
import { useWallet } from "../hooks/useWallet";
import { useOnReconnected } from "../hooks/useOnReconnected";
import { isApiError, isOfflineError } from "../types/api";
import { InvitationResponse } from "../types/invitation";
import type { NotificationInfo } from "../types/notification";
import { errorMessage, notifySuccess } from "../utils/notify";

enum LoadPhase {
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}

interface PendingResponse {
  notificationId: number;
  response: InvitationResponse;
}

const SKELETON_ROWS = [0, 1, 2, 3];

const unreadIds = (items: NotificationInfo[]): number[] =>
  items.filter((item) => !item.isRead).map((item) => item.notificationId);

/**
 * Notificações (rota `/notificacoes`, specs/003 US2/US3, mockup notifications.html):
 * lista mais recente → mais antiga, "Carregar mais", Aceitar/Recusar convites e marca as
 * exibidas como lidas (o sino zera).
 */
const NotificationsPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navState = readNavState(location.state);
  const { items, nextBeforeId, loadFirstPage, loadMore, markRead, setInvitationStatus } = useNotification();
  const { accept, decline } = useInvitation();
  const { loadGroups } = useGroup();
  const { refreshWallets } = useWallet();

  const [phase, setPhase] = useState<LoadPhase>(LoadPhase.Loading);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingResponse | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const [focusId, setFocusId] = useState<number | null>(null);

  const backTo = navState.backTo ?? "/";
  const backLabel = navState.backLabel ?? t("nav.home");
  const linkState: NavState = {
    tab: navState.tab ?? AppTab.Home,
    backTo: NOTIFICATIONS_PATH,
    backLabel: t("notifications.title"),
  };

  const load = useCallback(async () => {
    setPhase(LoadPhase.Loading);
    // "Sem internet" fica na tela durante a nova tentativa (REVIEW-005 M-5)
    setLoadError((previous: unknown) => (isOfflineError(previous) ? previous : null));
    try {
      const firstPage = await loadFirstPage();
      setLoadError(null);
      setPhase(LoadPhase.Ready);
      // Abrir a área marca as exibidas como lidas (FR-021)
      void markRead(unreadIds(firstPage));
    } catch (err) {
      setLoadError(err);
      setPhase(LoadPhase.Error);
    }
  }, [loadFirstPage, markRead]);

  useEffect(() => {
    void load();
  }, [load]);

  // Conexão voltou: recarrega a primeira página (FR-012)
  useOnReconnected(() => {
    void load();
  });

  // Foco no item depois de responder ou de carregar mais
  useEffect(() => {
    if (focusId === null) return;
    focusNotification(focusId);
    setFocusId(null);
  }, [focusId, items]);

  const showMore = async () => {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const newItems = await loadMore();
      void markRead(unreadIds(newItems));
      if (newItems[0]) setFocusId(newItems[0].notificationId);
    } catch (err) {
      setMoreError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const respond = async (notification: NotificationInfo, response: InvitationResponse) => {
    const invitationId = notification.invitation?.invitationId;
    if (invitationId === undefined || pending !== null) return;
    const { notificationId } = notification;
    setPending({ notificationId, response });
    setItemErrors((prev) => {
      const next = { ...prev };
      delete next[notificationId];
      return next;
    });
    try {
      const result =
        response === InvitationResponse.Accept ? await accept(invitationId) : await decline(invitationId);
      setInvitationStatus(invitationId, result.status);
      if (response === InvitationResponse.Accept) {
        notifySuccess(t("notifications.acceptedToast", { family: result.groupName }));
        // A família nova aparece nas telas da pessoa (US2-4)
        void Promise.allSettled([loadGroups(), refreshWallets()]);
      }
      setFocusId(notificationId);
    } catch (err) {
      const unavailable = isApiError(err) && err.status === 409;
      setItemErrors((prev) => ({
        ...prev,
        [notificationId]: unavailable ? t("notifications.unavailable") : errorMessage(err),
      }));
      // Os botões somem/ficam desabilitados: o foco não pode cair no <body> (T041)
      setFocusId(notificationId);
      // Recarrega para mostrar o estado final do convite
      if (unavailable) void loadFirstPage().catch(() => undefined);
    } finally {
      setPending(null);
    }
  };

  let content: ReactNode;
  const offlineRetry = phase === LoadPhase.Loading && isOfflineError(loadError);
  if ((phase === LoadPhase.Error || offlineRetry) && isOfflineError(loadError)) {
    content = <OfflineContent className="pt-16" retrying={offlineRetry} onRetry={() => void load()} />;
  } else if (phase === LoadPhase.Error) {
    content = <ErrorState className="pt-16" error={loadError} onRetry={() => void load()} />;
  } else if (phase === LoadPhase.Loading) {
    content = (
      <div aria-busy="true">
        <span className="sr-only" role="status">
          {t("app.loading")}
        </span>
        <div aria-hidden="true" className="overflow-hidden rounded-lg bg-surface">
          {SKELETON_ROWS.map((row) => (
            <div key={row} className="flex gap-3 px-4 py-3.5">
              <Skeleton className="size-9 shrink-0" rounded="rounded-[10px]" />
              <div className="flex flex-1 flex-col gap-2 pt-0.5">
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (items.length === 0) {
    content = (
      <EmptyState
        icon={BellOff}
        className="pt-16"
        title={t("notifications.emptyTitle")}
        description={t("notifications.emptyBody")}
      />
    );
  } else {
    content = (
      <>
        <ul aria-label={t("notifications.title")} className="m-0 list-none overflow-hidden rounded-lg bg-surface p-0">
          {items.map((notification) => (
            <NotificationItem
              key={notification.notificationId}
              notification={notification}
              pendingResponse={
                pending?.notificationId === notification.notificationId ? pending.response : null
              }
              disabled={pending !== null}
              error={itemErrors[notification.notificationId] ?? null}
              onRespond={(item, response) => void respond(item, response)}
              linkState={linkState}
            />
          ))}
        </ul>
        {moreError ? (
          <p role="alert" className="m-0 px-4 pt-3 text-center text-footnote text-negative">
            {moreError}
          </p>
        ) : null}
        {nextBeforeId !== null ? (
          <div className="flex justify-center pt-4">
            <Button
              variant={ButtonVariant.Secondary}
              size={ButtonSize.Sm}
              loading={loadingMore}
              loadingLabel={t("app.loading")}
              onClick={() => void showMore()}
            >
              {t("notifications.loadMore")}
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <LargeTitleHeader title={t("notifications.title")} backTo={backTo} backLabel={backLabel} />
      {content}
    </>
  );
};

export default NotificationsPage;
