import type { ReactNode } from "react";
import { ChevronRight, UserCheck, UserPlus, UserX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { GroupInvitationStatus, InvitationResponse } from "../../types/invitation";
import { NotificationType } from "../../types/notification";
import type { NotificationInfo } from "../../types/notification";
import { cn } from "../../utils/cn";
import { RelativeDay, formatShortDate, formatTime, relativeDayOf, toIsoInstant } from "../../utils/dates";
import type { NavState } from "../layout/navigation";
import { notificationFocusId } from "./notificationFocus";
import { Badge } from "../ui/Badge";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { BadgeVariant, BannerTone, ButtonSize, ButtonVariant } from "../ui/variants";

export interface NotificationItemProps {
  notification: NotificationInfo;
  /** Resposta em envio neste item (`null` = nenhuma) */
  pendingResponse: InvitationResponse | null;
  /** Bloqueia Aceitar/Recusar (outro envio em curso) */
  disabled: boolean;
  /** Erro da última resposta (ex.: 409 "não está mais disponível") */
  error: string | null;
  onRespond: (notification: NotificationInfo, response: InvitationResponse) => void;
  /** Estado de navegação do link para a família (voltar para Notificações) */
  linkState: NavState;
}

interface TileStyle {
  icon: LucideIcon;
  className: string;
}

const TILES: Record<NotificationType, TileStyle> = {
  [NotificationType.GroupInvitationReceived]: { icon: UserPlus, className: "bg-info-soft text-info" },
  [NotificationType.GroupInvitationAccepted]: { icon: UserCheck, className: "bg-positive-soft text-positive" },
  [NotificationType.GroupInvitationDeclined]: { icon: UserX, className: "bg-surface-3 text-text-muted" },
};

const MESSAGE_KEYS: Record<NotificationType, string> = {
  [NotificationType.GroupInvitationReceived]: "notifications.received",
  [NotificationType.GroupInvitationAccepted]: "notifications.accepted",
  [NotificationType.GroupInvitationDeclined]: "notifications.declined",
};

const FINAL_BADGES: Partial<Record<GroupInvitationStatus, { variant: BadgeVariant; labelKey: string }>> = {
  [GroupInvitationStatus.Accepted]: { variant: BadgeVariant.InviteAccepted, labelKey: "notifications.statusAccepted" },
  [GroupInvitationStatus.Declined]: { variant: BadgeVariant.InviteDeclined, labelKey: "notifications.statusDeclined" },
  [GroupInvitationStatus.Canceled]: { variant: BadgeVariant.InviteCanceled, labelKey: "notifications.statusCanceled" },
};

/**
 * Item da lista de notificações (components.md §7): convite recebido com Aceitar/Recusar
 * enquanto pendente e estado final depois; aceito/recusado para o responsável (o aceito
 * é um link para a família).
 */
export const NotificationItem = ({
  notification,
  pendingResponse,
  disabled,
  error,
  onRespond,
  linkState,
}: NotificationItemProps) => {
  const { t } = useTranslation();
  const { type, invitation, group, actor, isRead, createdAt, notificationId } = notification;
  const tile = TILES[type] ?? TILES[NotificationType.GroupInvitationReceived];
  const Icon = tile.icon;
  const family = group?.name ?? t("notifications.aFamily");
  const actorName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : t("notifications.someone");

  const isReceived = type === NotificationType.GroupInvitationReceived;
  const showActions = isReceived && invitation?.status === GroupInvitationStatus.Pending && !error;
  const finalBadge = isReceived && invitation ? FINAL_BADGES[invitation.status] : undefined;
  const linksToGroup = type === NotificationType.GroupInvitationAccepted && group !== null;
  const focusId = notificationFocusId(notificationId);

  const relative = relativeDayOf(createdAt);
  const dateLabel =
    relative === RelativeDay.Today
      ? t("notifications.today", { time: formatTime(createdAt) })
      : relative === RelativeDay.Yesterday
        ? t("notifications.yesterday", { time: formatTime(createdAt) })
        : formatShortDate(createdAt);

  const content: ReactNode = (
    <>
      {!isRead ? (
        <span aria-hidden="true" className="absolute top-[1.375rem] left-1.5 size-2 rounded-pill bg-accent" />
      ) : null}
      <span
        aria-hidden="true"
        className={cn("grid size-9 shrink-0 place-items-center rounded-[10px]", tile.className)}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          // No link, o próprio link recebe o foco (nada focável dentro dele)
          id={linksToGroup ? undefined : focusId}
          tabIndex={linksToGroup ? undefined : -1}
          className="m-0 text-subhead break-words text-text focus:outline-none"
        >
          {!isRead ? <span className="sr-only">{t("notifications.unread")}</span> : null}
          <Trans
            i18nKey={MESSAGE_KEYS[type] ?? MESSAGE_KEYS[NotificationType.GroupInvitationReceived]}
            values={{ actor: actorName, family }}
            components={{ b: <b className="font-semibold" /> }}
          />
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-footnote text-text-muted">
          <time dateTime={toIsoInstant(createdAt)}>{dateLabel}</time>
          {finalBadge ? <Badge variant={finalBadge.variant}>{t(finalBadge.labelKey)}</Badge> : null}
        </div>
        {error ? (
          <Banner tone={BannerTone.Error} role="alert" className="mt-2.5">
            {error}
          </Banner>
        ) : null}
        {showActions ? (
          <div className="mt-3 flex gap-2">
            <Button
              variant={ButtonVariant.Secondary}
              size={ButtonSize.Sm}
              className="flex-1 md:min-w-32 md:flex-none"
              aria-label={t("notifications.declineAria", { family })}
              loading={pendingResponse === InvitationResponse.Decline}
              loadingLabel={t("notifications.declining")}
              disabled={disabled}
              onClick={() => onRespond(notification, InvitationResponse.Decline)}
            >
              {t("notifications.decline")}
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              size={ButtonSize.Sm}
              className="flex-1 md:min-w-32 md:flex-none"
              aria-label={t("notifications.acceptAria", { family })}
              loading={pendingResponse === InvitationResponse.Accept}
              loadingLabel={t("notifications.accepting")}
              disabled={disabled}
              onClick={() => onRespond(notification, InvitationResponse.Accept)}
            >
              {t("notifications.accept")}
            </Button>
          </div>
        ) : null}
      </div>
      {linksToGroup ? (
        <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 self-center text-text-subtle" />
      ) : null}
    </>
  );

  const rowClasses = "relative flex gap-3 px-4 py-3.5 text-left text-text no-underline";

  return (
    <li className="group relative">
      {linksToGroup && group ? (
        <Link
          id={focusId}
          to={`/familias/${group.groupId}`}
          state={linkState}
          className={cn(
            rowClasses,
            "hover:bg-surface-3 active:bg-surface-3 motion-safe:transition-colors",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
          )}
        >
          {content}
        </Link>
      ) : (
        <div className={rowClasses}>{content}</div>
      )}
      <span aria-hidden="true" className="absolute right-0 bottom-0 left-16 h-px bg-separator group-last:hidden" />
    </li>
  );
};

export default NotificationItem;
