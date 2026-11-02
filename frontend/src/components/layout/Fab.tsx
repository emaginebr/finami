import { useEffect, useId, useRef, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OfflineActionKind, useOnlineAction } from "../../hooks/useOnlineAction";
import { TransactionKind } from "../../types/transaction";
import { cn } from "../../utils/cn";
import { transactionPath } from "../../utils/transactionRoutes";
import { activeTabFor } from "./navigation";
import type { NavState } from "./navigation";

const ACTIONS: Array<{ kind: TransactionKind; icon: LucideIcon; iconClass: string }> = [
  { kind: TransactionKind.Income, icon: ArrowDownLeft, iconClass: "bg-positive-soft text-positive" },
  { kind: TransactionKind.Expense, icon: ArrowUpRight, iconClass: "bg-negative-soft text-negative" },
  { kind: TransactionKind.Transfer, icon: ArrowLeftRight, iconClass: "bg-info-soft text-info" },
];

/** Altura do botão + distância da TabBar; o menu abre logo acima */
const BOTTOM =
  "bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+1rem+var(--update-prompt-h,0px)+min(var(--update-prompt-h,0px),1px)*12)] md:bottom-8";
const RIGHT = "right-[calc(1rem+env(safe-area-inset-right))] md:right-[max(1.5rem,calc((100vw-60rem)/2-4.5rem))]";

export interface FabProps {
  /** Carteira do extrato aberto: pré-selecionada na página do lançamento */
  walletId?: number | null;
}

/**
 * Botão flutuante "+" de 56 px (components.md §1): abre o menu Depositar · Sacar · Transferir,
 * cada um levando à sua página. Esc, toque fora ou escolher um item fecham o menu.
 * Sem internet fica `aria-disabled` (continua focável) e o toque só mostra o aviso (components.md §9).
 */
export const Fab = ({ walletId = null }: FabProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { offline, offlineProps, guard } = useOnlineAction(OfflineActionKind.Transaction);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  // Ficou sem internet com o menu aberto: fecha
  useEffect(() => {
    if (offline) setOpen(false);
  }, [offline]);

  // Abre com o foco no primeiro item; Esc fecha e devolve o foco ao botão
  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const state: NavState = {
    tab: activeTabFor(location.pathname, location.state) ?? undefined,
    backTo: `${location.pathname}${location.search}`,
  };

  return (
    <>
      {open ? (
        // Fundo escurecido: tocar fora fecha (o Esc também)
        <div aria-hidden="true" className="fixed inset-0 z-30 bg-black/40" onClick={() => setOpen(false)} />
      ) : null}

      <ul
        id={menuId}
        hidden={!open}
        aria-label={t("nav.newTransaction")}
        className={cn(
          "fixed z-30 m-0 flex list-none flex-col items-end gap-3 p-0",
          RIGHT,
          // Logo acima do botão de 56 px + 16 px
          "mb-[4.5rem]",
          BOTTOM,
        )}
      >
        {ACTIONS.map(({ kind, icon: Icon, iconClass }, index) => (
          <li key={kind}>
            <Link
              ref={index === 0 ? firstItemRef : undefined}
              to={transactionPath(kind, walletId)}
              state={state}
              onClick={() => setOpen(false)}
              className="flex min-h-touch items-center gap-3 rounded-pill bg-surface-2 py-1.5 pr-1.5 pl-4 text-callout font-semibold text-text no-underline shadow-fab hover:bg-surface-3"
            >
              {t(`transaction.page.${kind}`)}
              <span aria-hidden="true" className={cn("grid size-10 place-items-center rounded-pill", iconClass)}>
                <Icon className="size-[22px]" strokeWidth={1.75} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <button
        ref={buttonRef}
        type="button"
        onClick={open ? () => setOpen(false) : guard(() => setOpen(true))}
        aria-label={t("nav.newTransaction")}
        aria-expanded={open}
        aria-controls={menuId}
        {...offlineProps}
        className={cn(
          "fixed z-30",
          RIGHT,
          BOTTOM,
          "grid size-fab place-items-center rounded-pill",
          offline
            ? "cursor-not-allowed border border-border bg-surface-2 text-text-disabled shadow-none"
            : "bg-accent text-on-accent shadow-fab hover:bg-accent-hover active:bg-accent-pressed motion-safe:transition-transform motion-safe:active:scale-94",
          "focus-visible:outline-offset-[3px]",
        )}
      >
        <Plus
          aria-hidden="true"
          className={cn("size-7 motion-safe:transition-transform", open && "rotate-45")}
          strokeWidth={2.5}
        />
      </button>
    </>
  );
};

export default Fab;
