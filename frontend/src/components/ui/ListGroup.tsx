import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface ListGroupProps {
  /** Título da seção (CAIXA ALTA) */
  title?: ReactNode;
  /** Id do título (para `aria-labelledby`) */
  titleId?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Classe do cartão que envolve as linhas */
  listClassName?: string;
}

/** Lista agrupada estilo Ajustes do iOS (components.md §3). As linhas usam `listRowClasses`. */
export const ListGroup = ({ title, titleId, footer, children, className, listClassName }: ListGroupProps) => (
  <div className={className}>
    {title ? (
      <div id={titleId} className="mb-2 px-4 text-footnote font-semibold tracking-wide text-text-muted uppercase">
        {title}
      </div>
    ) : null}
    <div className={cn("overflow-hidden rounded-lg bg-surface", listClassName)}>{children}</div>
    {footer ? <div className="px-4 pt-2 text-footnote text-text-muted">{footer}</div> : null}
  </div>
);

export default ListGroup;
