import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Publica a altura do elemento numa variável CSS do `<html>` (ex.: `--offline-banner-h`), via
 * `ResizeObserver`, para o FAB, o cabeçalho compacto e os toasts se deslocarem sem números fixos
 * (components.md §9). Sem elemento (ou `active` falso) a variável vale `0px`.
 */
export const useCssHeightVar = (ref: RefObject<HTMLElement | null>, variable: string, active: boolean): void => {
  useEffect(() => {
    const root = document.documentElement;
    const element = ref.current;
    const publish = (height: number) => root.style.setProperty(variable, `${Math.round(height)}px`);

    if (!active || !element) {
      publish(0);
      return undefined;
    }

    publish(element.getBoundingClientRect().height);
    if (typeof ResizeObserver === "undefined") {
      return () => publish(0);
    }
    const observer = new ResizeObserver(() => publish(element.getBoundingClientRect().height));
    observer.observe(element);
    return () => {
      observer.disconnect();
      publish(0);
    };
  }, [ref, variable, active]);
};

export default useCssHeightVar;
