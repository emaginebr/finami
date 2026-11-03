import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";
import { NAV_ITEMS, activeTabFor } from "./navigation";

/** Barra inferior estilo iOS (< 768 px) — components.md §1 */
export const TabBar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const active = activeTabFor(location.pathname, location.state);

  return (
    <nav
      aria-label={t("nav.main")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t-[0.5px] border-separator pb-safe pl-safe pr-safe md:hidden",
        "bg-tabbar backdrop-blur-xl backdrop-saturate-150",
      )}
    >
      {NAV_ITEMS.map(({ tab, to, labelKey, icon: Icon }) => {
        const current = tab === active;
        return (
          <Link
            key={tab}
            to={to}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-tabbar flex-col items-center justify-center gap-0.5 px-1 text-center text-tab no-underline",
              "active:opacity-70 focus-visible:outline-offset-[-2px]",
              current ? "text-accent" : "text-text-muted",
            )}
          >
            <Icon aria-hidden="true" className="size-6" strokeWidth={current ? 2.25 : 1.75} />
            <span>{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default TabBar;
