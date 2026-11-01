/** Cores de apoio das famílias/membros, pela posição na lista (índice % 4 — tokens.css) */
export const FAMILY_COLOR_CLASSES = [
  "bg-family-blue",
  "bg-family-pink",
  "bg-family-yellow",
  "bg-family-green",
] as const;

/** Classe de fundo da cor de apoio para a posição `index` */
export const familyColorClass = (index: number): string =>
  FAMILY_COLOR_CLASSES[Math.abs(index) % FAMILY_COLOR_CLASSES.length] ?? "bg-family-blue";
