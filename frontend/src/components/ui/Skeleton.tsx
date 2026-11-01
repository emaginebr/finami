import { cn } from "../../utils/cn";

export interface SkeletonProps {
  className?: string;
  /** Variante clara para uso sobre `bg-brand` (BalanceHero) */
  onBrand?: boolean;
}

/** Bloco de carregamento decorativo (`aria-hidden`); o contêiner anuncia "Carregando…" */
export const Skeleton = ({ className, onBrand = false }: SkeletonProps) => (
  <span
    aria-hidden="true"
    className={cn(
      "block rounded-sm bg-[length:200%_100%] motion-safe:animate-shimmer",
      onBrand
        ? "bg-[linear-gradient(90deg,rgb(255_255_255/0.08)_25%,rgb(255_255_255/0.16)_50%,rgb(255_255_255/0.08)_75%)]"
        : "bg-[linear-gradient(90deg,var(--color-surface-2)_25%,var(--color-surface-3)_50%,var(--color-surface-2)_75%)]",
      className,
    )}
  />
);

export default Skeleton;
