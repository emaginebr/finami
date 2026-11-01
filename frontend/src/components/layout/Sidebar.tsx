import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../utils/cn";
import { Logo } from "../brand/Logo";
import { NotificationBell } from "../notification/NotificationBell";
import { Avatar } from "../ui/Avatar";
import { NotificationBellVariant } from "../ui/variants";
import { NAV_ITEMS, activeTabFor } from "./navigation";

/** Barra lateral fixa de 240 px (≥ 768 px) — components.md §1 */
export const Sidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { session } = useAuth();
  const active = activeTabFor(location.pathname, location.state);
  const user = session?.user;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col gap-6 border-r border-separator bg-surface px-4 py-6 md:flex">
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className="rounded-md">
          <Logo className="h-10" containerClassName="px-2.5 py-2" />
        </Link>
        <NotificationBell variant={NotificationBellVariant.Sidebar} />
      </div>
      <nav aria-label={t("nav.main")} className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ tab, to, labelKey, icon: Icon }) => {
          const current = tab === active;
          return (
            <Link
              key={tab}
              to={to}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex min-h-touch items-center gap-3 rounded-md px-3 text-callout no-underline",
                "motion-safe:transition-colors",
                current
                  ? "bg-brand-tint font-semibold text-text"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn("size-5", current && "text-accent")}
                strokeWidth={current ? 2.25 : 1.75}
              />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>
      {user ? (
        <div className="mt-auto flex min-w-0 items-center gap-2.5">
          <Avatar name={`${user.firstName} ${user.lastName}`} colorIndex={0} size="xs" />
          <p className="m-0 truncate text-footnote text-text-muted">
            {user.firstName} {user.lastName}
          </p>
        </div>
      ) : null}
    </aside>
  );
};

export default Sidebar;
