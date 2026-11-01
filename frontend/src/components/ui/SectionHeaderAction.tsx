import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface SectionHeaderActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Ícone à esquerda (18 px) */
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Pílula de ação no cabeçalho de uma seção (components.md §7, "Adicionar membro"):
 * 36 px visíveis com alvo de toque de 44 px. Fica fora do `<h2>`, como irmão dele.
 */
export const SectionHeaderAction = forwardRef<HTMLButtonElement, SectionHeaderActionProps>(
  ({ icon, children, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-surface-2 pr-3.5 pl-3",
        "text-subhead font-semibold tracking-normal text-accent normal-case",
        "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
        "hover:bg-surface-3 active:bg-surface-3 motion-safe:transition-colors",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  ),
);

SectionHeaderAction.displayName = "SectionHeaderAction";

export default SectionHeaderAction;
