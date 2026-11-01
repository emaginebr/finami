import { cn } from "../../utils/cn";
import { familyColorClass } from "../../utils/familyColors";

export interface AvatarProps {
  /** Nome completo; as iniciais são calculadas */
  name: string;
  /** Posição na lista (cor de apoio) */
  colorIndex: number;
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

/** Avatar de iniciais na cor de apoio por posição (decorativo: o nome aparece ao lado) */
export const Avatar = ({ name, colorIndex, size = "md", className }: AvatarProps) => (
  <span
    aria-hidden="true"
    className={cn(
      "grid shrink-0 place-items-center rounded-pill font-bold text-on-family",
      SIZE_CLASSES[size],
      familyColorClass(colorIndex),
      className,
    )}
  >
    {initialsOf(name)}
  </span>
);

export default Avatar;
