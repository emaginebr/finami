import type { ReactNode } from "react";
import { Clock, Cloud, Crown, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

import { BadgeVariant } from "./variants";

const VARIANT_STYLE: Record<BadgeVariant, { className: string; icon: LucideIcon | null }> = {
  [BadgeVariant.Virtual]: { className: "bg-info-soft text-info", icon: Cloud },
  [BadgeVariant.Stale]: { className: "bg-warning-soft text-warning", icon: Clock },
  [BadgeVariant.Reversed]: { className: "bg-surface-3 text-text-muted", icon: Undo2 },
  [BadgeVariant.Internal]: { className: "bg-surface-3 text-text-muted", icon: null },
  [BadgeVariant.Responsible]: { className: "bg-positive-soft text-positive", icon: Crown },
  [BadgeVariant.Inactive]: { className: "bg-surface-3 text-text-muted", icon: null },
};

export interface BadgeProps {
  variant: BadgeVariant | `${BadgeVariant}`;
  children: ReactNode;
  className?: string;
}

/** Selo com texto (nunca só cor) — components.md §3 */
export const Badge = ({ variant, children, className }: BadgeProps) => {
  const style = VARIANT_STYLE[variant as BadgeVariant];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-pill px-2 align-middle text-caption font-semibold whitespace-nowrap",
        style.className,
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3" strokeWidth={2} /> : null}
      {children}
    </span>
  );
};

export default Badge;
