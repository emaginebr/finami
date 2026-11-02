import { useContext, useEffect, useRef } from "react";
import ConnectivityContext from "../Contexts/ConnectivityContext";

/**
 * Chama `callback` quando a conexão volta (offline → online), para a tela recarregar o que
 * mostra (FR-012). Usa sempre a versão mais recente do callback, sem reassinar a cada render.
 * Fora do `ConnectivityProvider` (ex.: testes isolados) não faz nada.
 */
export const useOnReconnected = (callback: () => void): void => {
  const connectivity = useContext(ConnectivityContext);
  const onReconnected = connectivity?.onReconnected;
  const latest = useRef(callback);
  latest.current = callback;

  useEffect(() => {
    if (!onReconnected) return undefined;
    return onReconnected(() => latest.current());
  }, [onReconnected]);
};

export default useOnReconnected;
