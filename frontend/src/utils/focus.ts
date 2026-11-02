/** Elementos que recebem foco pelo teclado */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Destino quando não há nada focável depois: o `<main id="conteudo">` (tabIndex -1) */
const FALLBACK_TARGET_ID = "conteudo";

/** Primeiro elemento focável depois de `element` no documento (fora dele), ou `null` */
export const findNextFocusable = (element: Element): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).find(
    (candidate) =>
      !element.contains(candidate) &&
      (element.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  ) ?? null;

const nextFrame = (callback: () => void): void => {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
  else setTimeout(callback, 0);
};

/**
 * Leva o foco para `target` (ou para o `<main id="conteudo">`) no próximo quadro — depois de o
 * elemento focado ser desmontado, para o foco nunca cair no `<body>` (WCAG 2.4.3).
 */
export const focusLater = (target: HTMLElement | null): void => {
  nextFrame(() => {
    const destination = target?.isConnected ? target : document.getElementById(FALLBACK_TARGET_ID);
    destination?.focus();
  });
};

/**
 * Antes de remover `element` (com o foco dentro dele): guarda o próximo focável e devolve a
 * função que move o foco para lá. Uso: `const moveFocus = prepareFocusAfter(el); remove(); moveFocus();`
 */
export const prepareFocusAfter = (element: Element | null): (() => void) => {
  const next = element ? findNextFocusable(element) : null;
  return () => focusLater(next);
};
