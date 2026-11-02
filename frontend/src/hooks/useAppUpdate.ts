import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/** Intervalo da busca por versão nova do app (research R-06) */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export interface AppUpdate {
  /** Há uma versão nova esperando (SW novo instalado em `waiting`) */
  needRefresh: boolean;
  /** O app ficou pronto para abrir sem internet (primeiro precache concluído) */
  offlineReady: boolean;
  /** "Atualizar" em andamento (o app vai recarregar) */
  updating: boolean;
  /** Ativa o SW novo e recarrega na mesma rota; `false` se falhou antes de recarregar */
  update: () => Promise<boolean>;
  /** "Agora não": esconde o aviso; a versão nova entra na próxima abertura do zero */
  dismiss: () => void;
}

/**
 * Registro do service worker e atualização controlada (feature 005, US3). Usado uma única vez,
 * pelo `AppUpdateProvider`. Em `npm run dev` o plugin está com `devOptions.enabled: false` e nada
 * é registrado. Depois do registro, procura versão nova a cada `UPDATE_CHECK_INTERVAL_MS` e
 * quando a aba volta a ficar visível.
 */
export const useAppUpdate = (): AppUpdate => {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updating, setUpdating] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_swUrl, swRegistration) => {
      if (swRegistration) setRegistration(swRegistration);
    },
  });

  useEffect(() => {
    if (!registration) return undefined;
    const check = () => {
      // Sem internet ou com uma instalação em andamento não há o que buscar
      if (registration.installing || navigator.onLine === false) return;
      registration.update().catch(() => undefined);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") check();
    };
    const interval = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [registration]);

  const update = useCallback(async (): Promise<boolean> => {
    setUpdating(true);
    try {
      await updateServiceWorker(true);
      return true;
    } catch {
      // Falhou antes de recarregar: devolve os botões (o aviso de erro fica com a interface)
      setUpdating(false);
      return false;
    }
  }, [updateServiceWorker]);

  const dismiss = useCallback(() => {
    setNeedRefresh(false);
    setOfflineReady(false);
  }, [setNeedRefresh, setOfflineReady]);

  return useMemo(
    () => ({ needRefresh, offlineReady, updating, update, dismiss }),
    [needRefresh, offlineReady, updating, update, dismiss],
  );
};

export default useAppUpdate;
