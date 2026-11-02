import { forwardRef } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OfflineActionKind, useOnlineAction } from "../../hooks/useOnlineAction";
import { cn } from "../../utils/cn";

export interface FabProps {
  onClick: () => void;
  /** A folha de lançamento está aberta */
  expanded?: boolean;
}

/**
 * Botão flutuante "+" de 56 px (components.md §1) — acima da TabBar no celular; sobe junto
 * com o aviso de nova versão (`--update-prompt-h`). Sem internet fica `aria-disabled`
 * (continua focável) e o toque só mostra o aviso (components.md §9).
 */
export const Fab = forwardRef<HTMLButtonElement, FabProps>(({ onClick, expanded = false }, ref) => {
  const { t } = useTranslation();
  const { offline, offlineProps, guard } = useOnlineAction(OfflineActionKind.Transaction);
  return (
    <button
      ref={ref}
      type="button"
      onClick={guard(onClick)}
      aria-label={t("nav.newTransaction")}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      {...offlineProps}
      className={cn(
        "fixed right-[calc(1rem+env(safe-area-inset-right))] z-30",
        // Com o aviso de nova versão: + altura do cartão + 12 px (o `min(…,1px)*12` zera sem cartão)
        "bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+1rem+var(--update-prompt-h,0px)+min(var(--update-prompt-h,0px),1px)*12)]",
        "grid size-fab place-items-center rounded-pill",
        offline
          ? "cursor-not-allowed border border-border bg-surface-2 text-text-disabled shadow-none"
          : "bg-accent text-on-accent shadow-fab hover:bg-accent-hover active:bg-accent-pressed motion-safe:transition-transform motion-safe:active:scale-94",
        "focus-visible:outline-offset-[3px]",
        "md:right-[max(1.5rem,calc((100vw-60rem)/2-4.5rem))] md:bottom-8",
      )}
    >
      <Plus aria-hidden="true" className="size-7" strokeWidth={2.5} />
    </button>
  );
});

Fab.displayName = "Fab";

export default Fab;
