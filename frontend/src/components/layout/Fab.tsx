import { forwardRef } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface FabProps {
  onClick: () => void;
  /** A folha de lançamento está aberta */
  expanded?: boolean;
}

/** Botão flutuante "+" de 56 px (components.md §1) — acima da TabBar no celular */
export const Fab = forwardRef<HTMLButtonElement, FabProps>(({ onClick, expanded = false }, ref) => {
  const { t } = useTranslation();
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={t("nav.newTransaction")}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      className={[
        "fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+1rem)] z-30",
        "grid size-fab place-items-center rounded-pill bg-accent text-on-accent shadow-fab",
        "hover:bg-accent-hover active:bg-accent-pressed motion-safe:transition-transform motion-safe:active:scale-94",
        "focus-visible:outline-offset-[3px]",
        "md:right-[max(1.5rem,calc((100vw-60rem)/2-4.5rem))] md:bottom-8",
      ].join(" ")}
    >
      <Plus aria-hidden="true" className="size-7" strokeWidth={2.5} />
    </button>
  );
});

Fab.displayName = "Fab";

export default Fab;
