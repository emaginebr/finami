import { useCallback, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";

/** Atributo que liga cada opção ao seu id na navegação por setas */
export const OPTION_ID_ATTR = "data-option-id";

export interface RovingListbox {
  /** Opção com `tabIndex={0}` (a única parada de Tab do listbox) */
  tabStopId: number | null;
  /** `onKeyDown` do contêiner `role="listbox"` */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** `onFocus` do contêiner: a opção focada (clique, Tab de volta) vira a parada de Tab */
  onFocus: (event: FocusEvent<HTMLElement>) => void;
}

const optionIdOf = (element: EventTarget | null): number | null => {
  if (!(element instanceof HTMLElement)) return null;
  const value = element.closest(`[${OPTION_ID_ATTR}]`)?.getAttribute(OPTION_ID_ATTR);
  return value === null || value === undefined ? null : Number(value);
};

/**
 * Roving tabindex do padrão APG *Listbox* (também com grupos): uma parada de Tab no listbox,
 * `ArrowDown`/`ArrowUp` para a próxima/anterior atravessando os grupos, `Home`/`End` para a
 * primeira/última. `Enter`/`Espaço` são o clique nativo do `<button role="option">`.
 *
 * @param ids ids das opções na ordem em que aparecem (todos os grupos, em sequência)
 * @param preferredId parada de Tab inicial (a opção selecionada); sem ela, a primeira
 */
export const useRovingListbox = (ids: number[], preferredId: number | null): RovingListbox => {
  const [activeId, setActiveId] = useState<number | null>(null);

  const tabStopId =
    activeId !== null && ids.includes(activeId)
      ? activeId
      : preferredId !== null && ids.includes(preferredId)
        ? preferredId
        : (ids[0] ?? null);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (ids.length === 0) return;
      const focusedId = optionIdOf(event.target);
      const from = ids.indexOf(focusedId ?? tabStopId ?? -1);
      let next: number;
      switch (event.key) {
        case "ArrowDown":
          next = from < 0 ? 0 : Math.min(from + 1, ids.length - 1);
          break;
        case "ArrowUp":
          next = from < 0 ? 0 : Math.max(from - 1, 0);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = ids.length - 1;
          break;
        default:
          return;
      }
      // Sem rolar a página com as setas
      event.preventDefault();
      const id = ids[next];
      if (id === undefined) return;
      setActiveId(id);
      event.currentTarget.querySelector<HTMLElement>(`[${OPTION_ID_ATTR}="${id}"]`)?.focus();
    },
    [ids, tabStopId],
  );

  const onFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    const id = optionIdOf(event.target);
    if (id !== null) setActiveId(id);
  }, []);

  return { tabStopId, onKeyDown, onFocus };
};

export default useRovingListbox;
