import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { vi } from "vitest";
import type { RegisterSWOptions } from "virtual:pwa-register/react";

/**
 * Substituto de `virtual:pwa-register/react` nos testes (alias no `vite.config.ts`, T005).
 * O estado inicial é definido com `setPwaRegisterState` antes do render; `updateServiceWorkerMock`
 * registra as chamadas e `lastRegisterOptions()` devolve as opções passadas ao hook
 * (ex.: para chamar `onRegisteredSW` com um `registration` falso).
 */

export interface PwaRegisterState {
  needRefresh: boolean;
  offlineReady: boolean;
}

const INITIAL_STATE: PwaRegisterState = { needRefresh: false, offlineReady: false };

let state: PwaRegisterState = { ...INITIAL_STATE };
let options: RegisterSWOptions | undefined;
const setters = new Set<(next: PwaRegisterState) => void>();

export const updateServiceWorkerMock = vi.fn(async (reloadPage?: boolean): Promise<void> => {
  void reloadPage;
});

/** Define o estado devolvido pelo hook (também atualiza componentes já montados) */
export const setPwaRegisterState = (next: Partial<PwaRegisterState>): void => {
  state = { ...state, ...next };
  setters.forEach((set) => set(state));
};

/** Opções recebidas na última chamada de `useRegisterSW` */
export const lastRegisterOptions = (): RegisterSWOptions | undefined => options;

/** Volta ao estado inicial (chamado no `afterEach` de `setup.ts`) */
export const resetPwaRegisterMock = (): void => {
  state = { ...INITIAL_STATE };
  options = undefined;
  setters.clear();
  updateServiceWorkerMock.mockClear();
};

export const useRegisterSW = (
  registerOptions?: RegisterSWOptions,
): {
  needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
  offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
} => {
  options = registerOptions;
  const [needRefresh, setNeedRefresh] = useState(state.needRefresh);
  const [offlineReady, setOfflineReady] = useState(state.offlineReady);

  useEffect(() => {
    const sync = (next: PwaRegisterState) => {
      setNeedRefresh(next.needRefresh);
      setOfflineReady(next.offlineReady);
    };
    setters.add(sync);
    return () => {
      setters.delete(sync);
    };
  }, []);

  return {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker: updateServiceWorkerMock,
  };
};
