import { cn } from "../../utils/cn";
import { familyColorClass } from "../../utils/familyColors";

import { AvatarVariant } from "./variants";

export interface AvatarProps {
  /** Nome completo; as iniciais são calculadas */
  name: string;
  /** Posição na lista (cor de apoio, só na variante `family`) */
  colorIndex?: number;
  /** `neutral`: pessoa sem índice de família; `pending`: convite pendente (components.md §7) */
  variant?: AvatarVariant | `${AvatarVariant}`;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  xs: "size-8 text-caption",
  sm: "size-9 text-footnote",
  md: "size-10 text-subhead",
  lg: "size-16 text-[1.5rem]",
} as const;

/** Iniciais do nome ("Luísa Ramos" → "LR") */
const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase();
};

const variantClasses = (variant: AvatarVariant, colorIndex: number): string => {
  switch (variant) {
    case AvatarVariant.Neutral:
      return "bg-surface-3 text-text";
    case AvatarVariant.Pending:
      return "border-[1.5px] border-dashed border-border bg-transparent text-text-muted";
    case AvatarVariant.Family:
      return cn("text-on-family", familyColorClass(colorIndex));
  }
};

/** Avatar de iniciais (decorativo: o nome aparece ao lado) */
export const Avatar = ({
  name,
  colorIndex = 0,
  variant = AvatarVariant.Family,
  size = "md",
  className,
}: AvatarProps) => (
  <span
    aria-hidden="true"
    className={cn(
      "grid shrink-0 place-items-center rounded-pill font-bold",
      SIZE_CLASSES[size],
      variantClasses(variant as AvatarVariant, colorIndex),
      className,
    )}
  >
    {initialsOf(name)}
  </span>
);

export default Avatar;
