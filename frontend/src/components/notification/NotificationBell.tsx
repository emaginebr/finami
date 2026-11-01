import { Bell } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useNotification } from "../../hooks/useNotification";
import { cn } from "../../utils/cn";
import { AppTab, NAV_ITEMS, NOTIFICATIONS_PATH, activeTabFor, readNavState } from "../layout/navigation";
import type { NavState } from "../layout/navigation";
import { NotificationBellVariant } from "../ui/variants";

export interface NotificationBellProps {
  variant?: NotificationBellVariant | `${NotificationBellVariant}`;
  className?: string;
  /** Sobrescreve o contador do `NotificationContext` (testes) */
  count?: number;
}

/** Texto do selo: 1–9 com o número, a partir de 10 "9+" */
const badgeText = (count: number): string => (count > 9 ? "9+" : String(count));

/**
 * Sino de notificações (components.md §7, research R-07): link para `/notificacoes` com selo de
 * não lidas. `header` na linha do título das abas (celular); `sidebar` no topo da Sidebar.
 * O selo é `aria-hidden`; o número real vai no `aria-label` (com plural).
 */
export const NotificationBell = ({
  variant = NotificationBellVariant.Header,
  className,
  count,
}: NotificationBellProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { unread } = useNotification();
  const value = Math.max(0, count ?? unread);
  const isSidebar = variant === NotificationBellVariant.Sidebar;
  const active = location.pathname === NOTIFICATIONS_PATH;

  // A aba de origem continua ativa e o "voltar" da tela leva a ela
  const tab = activeTabFor(location.pathname, location.state) ?? AppTab.Home;
  const origin = NAV_ITEMS.find((item) => item.tab === tab);
  const state: NavState = active
    ? readNavState(location.state)
    : {
        tab,
        backTo: origin?.to ?? "/",
        backLabel: t(origin?.labelKey ?? "nav.home"),
      };

  return (
    <Link
      to={NOTIFICATIONS_PATH}
      state={state}
      aria-label={t("notifications.bellLabel", { count: value })}
      aria-current={isSidebar && active ? "page" : undefined}
      className={cn(
        "relative grid size-11 shrink-0 place-items-center rounded-pill no-underline",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "motion-safe:transition-colors",
        isSidebar
          ? cn(
              "-mr-1.5",
              active
                ? "bg-brand-tint text-accent"
                : "text-text-muted hover:bg-surface-2 hover:text-text active:bg-surface-3",
            )
          : "-mt-0.5 -mr-2.5 text-text hover:bg-surface-2 active:bg-surface-3",
        className,
      )}
    >
      <Bell aria-hidden="true" className={isSidebar ? "size-[22px]" : "size-6"} strokeWidth={1.75} />
      {value > 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-[5px] left-[22px] h-[18px] min-w-[18px] rounded-pill bg-accent px-[5px]",
            "text-center text-tab leading-[18px] font-bold text-on-accent tabular-nums ring-2",
            isSidebar ? (active ? "ring-brand-tint" : "ring-surface") : "ring-bg",
          )}
        >
          {badgeText(value)}
        </span>
      ) : null}
    </Link>
  );
};

export default NotificationBell;
