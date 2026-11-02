import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { InstallOutcome } from "../types/install";
import type { BeforeInstallPromptEvent, NavigatorWithStandalone } from "../types/install";
import { notifySuccess } from "../utils/notify";

/** Dias em que o convite da Home fica oculto depois de dispensado (FR-004) */
export const INSTALL_DISMISS_DAYS = 30;
/** Data (ISO) em que o convite foi dispensado (data-model.md §localStorage) */
export const INSTALL_DISMISSED_STORAGE_KEY = "finami:install-dismissed-at";

const DAY_MS = 24 * 60 * 60 * 1000;
const STANDALONE_QUERY = "(display-mode: standalone)";

export interface InstallContextType {
  // Estado
  /** O navegador ofereceu o diálogo nativo (`beforeinstallprompt`) */
  canPromptNative: boolean;
  /** Aberto como app instalado (standalone) ou instalado nesta sessão */
  isInstalled: boolean;
  /** iPhone/iPad: instalação manual pelo menu Compartilhar */
  isIos: boolean;
  /** iPad (inclusive iPadOS que se apresenta como Mac): muda o título do passo a passo */
  isIpad: boolean;
  /**
   * O diálogo nativo já foi usado e recusado nesta sessão: o item da Conta continua visível e,
   * sem evento novo, orienta a usar o ícone/menu do navegador (REVIEW-005 A-1)
   */
  nativePromptUsed: boolean;
  /** Quando o convite foi dispensado (ISO), ou `null` */
  dismissedAt: string | null;
  /** Item "Instalar o Finami" da Conta visível */
  canInstall: boolean;
  /** Convite da Home visível (instalável e não dispensado há menos de 30 dias) */
  showInvite: boolean;
  // Métodos
  promptInstall: () => Promise<InstallOutcome>;
  dismissInvite: () => void;
}

const InstallContext = createContext<InstallContextType | undefined>(undefined);

const readDismissedAt = (): string | null => {
  try {
    const value = localStorage.getItem(INSTALL_DISMISSED_STORAGE_KEY);
    return value !== null && !Number.isNaN(Date.parse(value)) ? value : null;
  } catch {
    return null;
  }
};

const writeDismissedAt = (value: string): void => {
  try {
    localStorage.setItem(INSTALL_DISMISSED_STORAGE_KEY, value);
  } catch {
    // Armazenamento negado: o convite só fica oculto nesta sessão
  }
};

const standaloneQuery = (): MediaQueryList | null =>
  typeof window.matchMedia === "function" ? window.matchMedia(STANDALONE_QUERY) : null;

const detectStandalone = (): boolean =>
  standaloneQuery()?.matches === true || (navigator as NavigatorWithStandalone).standalone === true;

/** iPad, incluindo iPadOS que se apresenta como Mac (com toque) */
const detectIpad = (): boolean => {
  const userAgent = navigator.userAgent;
  return /iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && (navigator.maxTouchPoints ?? 0) > 1);
};

/** iPhone/iPod/iPad */
const detectIos = (): boolean => /iPhone|iPod/.test(navigator.userAgent) || detectIpad();

const isRecentlyDismissed = (dismissedAt: string | null, now: number): boolean =>
  dismissedAt !== null && now - Date.parse(dismissedAt) < INSTALL_DISMISS_DAYS * DAY_MS;

export const InstallProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(detectStandalone);
  const [isIos] = useState(detectIos);
  const [isIpad] = useState(detectIpad);
  const [nativePromptUsed, setNativePromptUsed] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<string | null>(readDismissedAt);
  const prompting = useRef(false);

  // Diálogo nativo (Chrome/Edge): guarda o evento para disparar pelo app
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  // Janela passou a standalone (ex.: app aberto depois de instalado)
  useEffect(() => {
    const query = standaloneQuery();
    if (!query || typeof query.addEventListener !== "function") return undefined;
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsInstalled(true);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt || prompting.current) return InstallOutcome.Unavailable;
    prompting.current = true;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      // O evento só pode ser usado uma vez, mas só é descartado depois da escolha: o botão que
      // abriu o diálogo continua montado e o navegador devolve o foco a ele (REVIEW-005 A-1)
      setDeferredPrompt(null);
      if (choice.outcome !== "accepted") {
        setNativePromptUsed(true);
        return InstallOutcome.Dismissed;
      }
      setIsInstalled(true);
      notifySuccess(t("pwa.install.installed"));
      return InstallOutcome.Accepted;
    } catch {
      setDeferredPrompt(null);
      setNativePromptUsed(true);
      return InstallOutcome.Unavailable;
    } finally {
      prompting.current = false;
    }
  }, [deferredPrompt, t]);

  const dismissInvite = useCallback(() => {
    const now = new Date().toISOString();
    writeDismissedAt(now);
    setDismissedAt(now);
  }, []);

  const canPromptNative = deferredPrompt !== null && !isInstalled;
  // Recusado no diálogo nativo: o item da Conta continua (o navegador ainda instala pelo menu)
  const canInstall = !isInstalled && (canPromptNative || isIos || nativePromptUsed);
  // O convite só aparece com um caminho direto (diálogo nativo ou passo a passo do iOS)
  const showInvite =
    !isInstalled && (canPromptNative || isIos) && !isRecentlyDismissed(dismissedAt, Date.now());

  const value = useMemo<InstallContextType>(
    () => ({
      canPromptNative,
      isInstalled,
      isIos,
      isIpad,
      nativePromptUsed,
      dismissedAt,
      canInstall,
      showInvite,
      promptInstall,
      dismissInvite,
    }),
    [
      canPromptNative,
      isInstalled,
      isIos,
      isIpad,
      nativePromptUsed,
      dismissedAt,
      canInstall,
      showInvite,
      promptInstall,
      dismissInvite,
    ],
  );

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
};

export default InstallContext;
