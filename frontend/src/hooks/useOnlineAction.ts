import { useCallback, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ConnectivityContext from "../Contexts/ConnectivityContext";
import { notifyWarning } from "../utils/notify";

/** Qual aviso mostrar quando a ação é tocada sem internet (contracts/ui.md §Sem internet) */
export enum OfflineActionKind {
  /** "Sem internet. Conecte-se para fazer lançamentos." */
  Transaction = "transaction",
  /** "Sem internet. Conecte-se para fazer alterações." */
  Change = "change",
}

/** Props de acessibilidade de uma ação indisponível offline (continua focável) */
export interface OfflineActionProps {
  "aria-disabled"?: true;
}

export interface OnlineAction {
  /** `true` quando a conectividade está offline */
  offline: boolean;
  /** `{ "aria-disabled": true }` offline; `{}` online */
  offlineProps: OfflineActionProps;
  /** Envolve um handler: offline mostra o aviso e não chama o handler */
  guard: <A extends unknown[]>(handler: (...args: A) => void) => (...args: A) => void;
  /** Mostra o aviso e devolve `true` quando offline (para usar no início de um handler) */
  blockIfOffline: () => boolean;
}

/**
 * Ações de escrita sem internet (feature 005, R-05): `aria-disabled="true"` (não `disabled`, para
 * continuar focável e anunciada) + toast de aviso ao tocar. Fora do `ConnectivityProvider`
 * considera online.
 */
export const useOnlineAction = (kind: OfflineActionKind = OfflineActionKind.Change): OnlineAction => {
  const { t } = useTranslation();
  const connectivity = useContext(ConnectivityContext);
  const offline = connectivity ? !connectivity.isOnline : false;

  const blockIfOffline = useCallback((): boolean => {
    if (!offline) return false;
    notifyWarning(
      kind === OfflineActionKind.Transaction
        ? t("pwa.offline.writeBlockedTransaction")
        : t("pwa.offline.writeBlocked"),
    );
    return true;
  }, [offline, kind, t]);

  const guard = useCallback(
    <A extends unknown[]>(handler: (...args: A) => void) =>
      (...args: A) => {
        if (blockIfOffline()) return;
        handler(...args);
      },
    [blockIfOffline],
  );

  const offlineProps = useMemo<OfflineActionProps>(() => (offline ? { "aria-disabled": true } : {}), [offline]);

  return { offline, offlineProps, guard, blockIfOffline };
};

export default useOnlineAction;
