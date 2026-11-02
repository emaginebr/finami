import { createContext, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../Services/apiHelpers";
import { ConnectivityStatus } from "../types/connectivity";
import {
  getOldestStaleFetchedAt,
  getStatus,
  resetFreshness as resetStoreFreshness,
  subscribe,
} from "../utils/connectivity";
import { notifyInfo } from "../utils/notify";

/** Tempo offline contínuo antes de mostrar o indicador (anti-pisca, research R-04) */
export const OFFLINE_BANNER_DELAY_MS = 2_000;
/** Intervalo dos pings enquanto offline (Wi-Fi sem internet não dispara o evento `online`) */
export const OFFLINE_PING_INTERVAL_MS = 15_000;
/** Rota leve usada para conferir a conexão (sem Bearer: 401 também prova que há rede) */
export const CONNECTIVITY_PING_PATH = "/api/auth/me";

interface ReconnectedCallback {
  (): void;
}

export interface ConnectivityContextType {
  // Estado
  status: ConnectivityStatus;
  isOnline: boolean;
  /** Indicador "Sem internet" visível (após `OFFLINE_BANNER_DELAY_MS` offline) */
  showBanner: boolean;
  /** `fetchedAt` (ISO) do dado guardado mais antigo da tela atual, ou `null` */
  staleSince: string | null;
  // Métodos
  /** Assina o evento de reconexão (offline → online); devolve a função que cancela */
  onReconnected: (callback: ReconnectedCallback) => () => void;
  /** Faz um ping na API; o resultado atualiza o estado */
  checkConnection: () => Promise<void>;
  /** Esquece a data dos dados antigos (troca de rota) */
  resetFreshness: () => void;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

export const ConnectivityProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const status = useSyncExternalStore(subscribe, getStatus, getStatus);
  const staleSince = useSyncExternalStore(subscribe, getOldestStaleFetchedAt, getOldestStaleFetchedAt);
  const [showBanner, setShowBanner] = useState(false);
  const reconnectedCallbacks = useRef(new Set<ReconnectedCallback>());
  const wasOffline = useRef(status === ConnectivityStatus.Offline);
  const bannerWasShown = useRef(false);

  const checkConnection = useCallback(async (): Promise<void> => {
    try {
      // `apiFetch` reporta online em qualquer resposta HTTP e offline em falha/timeout
      await apiFetch<unknown>(CONNECTIVITY_PING_PATH, { cache: "none", authenticated: false });
    } catch {
      // Estado já atualizado pelo apiFetch
    }
  }, []);

  // Indicador com atraso; reconexão avisa as telas e anuncia
  useEffect(() => {
    if (status === ConnectivityStatus.Offline) {
      wasOffline.current = true;
      const timer = setTimeout(() => {
        bannerWasShown.current = true;
        setShowBanner(true);
      }, OFFLINE_BANNER_DELAY_MS);
      return () => clearTimeout(timer);
    }

    setShowBanner(false);
    if (wasOffline.current) {
      wasOffline.current = false;
      if (bannerWasShown.current) notifyInfo(t("pwa.offline.reconnected"));
      bannerWasShown.current = false;
      reconnectedCallbacks.current.forEach((callback) => callback());
    }
    return undefined;
  }, [status, t]);

  // Evento `online` do navegador: confirma com um ping antes de declarar online
  useEffect(() => {
    const onBrowserOnline = () => {
      void checkConnection();
    };
    window.addEventListener("online", onBrowserOnline);
    return () => window.removeEventListener("online", onBrowserOnline);
  }, [checkConnection]);

  // Enquanto offline (e com a tela visível), confere a conexão de tempos em tempos
  useEffect(() => {
    if (status !== ConnectivityStatus.Offline) return undefined;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void checkConnection();
    }, OFFLINE_PING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, checkConnection]);

  const onReconnected = useCallback((callback: ReconnectedCallback) => {
    const callbacks = reconnectedCallbacks.current;
    callbacks.add(callback);
    return () => {
      callbacks.delete(callback);
    };
  }, []);

  const resetFreshness = useCallback(() => resetStoreFreshness(), []);

  const value = useMemo<ConnectivityContextType>(
    () => ({
      status,
      isOnline: status === ConnectivityStatus.Online,
      showBanner,
      staleSince,
      onReconnected,
      checkConnection,
      resetFreshness,
    }),
    [status, showBanner, staleSince, onReconnected, checkConnection, resetFreshness],
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
};

export default ConnectivityContext;
