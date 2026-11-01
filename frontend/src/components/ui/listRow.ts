import { cn } from "../../utils/cn";

export interface ListRowOptions {
  /** Linha de 60 px (título + subtítulo) */
  twoLines?: boolean;
  /** Tem ícone/avatar à esquerda (hairline recuado depois do ícone) */
  withIcon?: boolean;
  /** Tem estados hover/pressed */
  interactive?: boolean;
}

/** Classes base de uma linha de lista agrupada (`.list-row` em index.css) */
export const listRowClasses = (options: ListRowOptions) =>
  cn(
    "list-row flex w-full items-center gap-3 px-4 py-2 text-left text-text no-underline",
    options.twoLines ? "min-h-row-2" : "min-h-row",
    options.withIcon && "has-icon",
    options.interactive && "hover:bg-surface-3 active:bg-surface-3 motion-safe:transition-colors",
  );
