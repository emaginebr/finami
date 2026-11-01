import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Ação opcional (ex.: `Button primary sm` ou link) */
  action?: ReactNode;
  className?: string;
  /** Nível do título (padrão h2) */
  headingLevel?: 2 | 3;
}

/** Estado vazio (components.md §4) */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className,
  headingLevel = 2,
}: EmptyStateProps) => {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}>
      <span
        aria-hidden="true"
        className="mb-2 grid size-[72px] place-items-center rounded-pill bg-surface-2 text-text-muted"
      >
        <Icon className="size-9" strokeWidth={1.75} />
      </span>
      <Heading className="m-0 text-headline">{title}</Heading>
      {description ? (
        <p className="m-0 mb-3 max-w-[32ch] text-subhead text-text-muted">{description}</p>
      ) : null}
      {action}
    </div>
  );
};

export default EmptyState;
