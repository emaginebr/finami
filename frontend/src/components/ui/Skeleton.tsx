import { cn } from "../../utils/cn";

export interface SkeletonProps {
  className?: string;
  /**
   * Classe de arredondamento (ex.: `"rounded-pill"`, `"rounded-md"`). Substitui o `rounded-sm` padrão
   * em vez de competir com ele — o `cn` só concatena, e duas classes `rounded-*` no mesmo elemento
   * dependeriam da ordem das regras no CSS (REVIEW-006 I-3).
   */
  rounded?: string;
  /** Variante clara para uso sobre `bg-brand` (BalanceHero) */
  onBrand?: boolean;
}

/** Bloco de carregamento decorativo (`aria-hidden`); o contêiner anuncia "Carregando…" */
export const Skeleton = ({ className, rounded = "rounded-sm", onBrand = false }: SkeletonProps) => (
  <span
    aria-hidden="true"
    className={cn(
      "block bg-[length:200%_100%] motion-safe:animate-shimmer",
      rounded,
      onBrand
        ? "bg-[linear-gradient(90deg,rgb(255_255_255/0.08)_25%,rgb(255_255_255/0.16)_50%,rgb(255_255_255/0.08)_75%)]"
        : "bg-[linear-gradient(90deg,var(--color-surface-2)_25%,var(--color-surface-3)_50%,var(--color-surface-2)_75%)]",
      className,
    )}
  />
);

export default Skeleton;
