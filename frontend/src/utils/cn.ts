/** Junta classes CSS ignorando valores falsos (equivalente simples ao `clsx`) */
export const cn = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter((item): item is string => typeof item === "string" && item.length > 0).join(" ");
