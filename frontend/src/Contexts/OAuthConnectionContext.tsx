import { createContext, useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { oauthConnectionService } from "../Services/oauthConnectionService";
import type { OAuthConnectionInfo } from "../types/oauthConnection";
import { errorMessage } from "../utils/notify";
import { useOnUserChange } from "../hooks/useOnUserChange";

export interface OAuthConnectionContextType {
  // Estado
  /** Conexões ativas, mais recentes primeiro */
  connections: OAuthConnectionInfo[];
  /** `true` depois do primeiro carregamento bem-sucedido */
  loaded: boolean;
  /** Endereço do MCP (estado vazio); `null` até carregar */
  mcpUrl: string | null;
  loading: boolean;
  error: string | null;
  // Métodos (lançam `ApiError`; quem chama decide como exibir)
  /** Recarrega a lista de conexões */
  loadConnections: () => Promise<OAuthConnectionInfo[]>;
  /** Revoga uma conexão e a tira da lista */
  disconnect: (connectionId: number) => Promise<void>;
  /** Revoga todas e esvazia a lista */
  disconnectAll: () => Promise<void>;
  /** Busca (uma vez) o endereço do MCP */
  loadMcpInfo: () => Promise<string>;
  clearError: () => void;
}

const OAuthConnectionContext = createContext<OAuthConnectionContextType | undefined>(undefined);

/** Assistentes conectados (Conta → "Assistentes conectados", US4) */
export const OAuthConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [connections, setConnections] = useState<OAuthConnectionInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mcpUrlRef = useRef<string | null>(null);

  useOnUserChange(() => {
    setConnections([]);
    setLoaded(false);
    setError(null);
  });

  const loadConnections = useCallback(async (): Promise<OAuthConnectionInfo[]> => {
    try {
      setLoading(true);
      setError(null);
      const list = await oauthConnectionService.list();
      setConnections(list);
      setLoaded(true);
      return list;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async (connectionId: number): Promise<void> => {
    try {
      setError(null);
      await oauthConnectionService.disconnect(connectionId);
      setConnections((prev) => prev.filter((item) => item.connectionId !== connectionId));
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    }
  }, []);

  const disconnectAll = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await oauthConnectionService.disconnectAll();
      setConnections([]);
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    }
  }, []);

  const loadMcpInfo = useCallback(async (): Promise<string> => {
    if (mcpUrlRef.current !== null) return mcpUrlRef.current;
    const info = await oauthConnectionService.mcpInfo();
    mcpUrlRef.current = info.mcpUrl;
    setMcpUrl(info.mcpUrl);
    return info.mcpUrl;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<OAuthConnectionContextType>(
    () => ({
      connections,
      loaded,
      mcpUrl,
      loading,
      error,
      loadConnections,
      disconnect,
      disconnectAll,
      loadMcpInfo,
      clearError,
    }),
    [connections, loaded, mcpUrl, loading, error, loadConnections, disconnect, disconnectAll, loadMcpInfo, clearError],
  );

  return <OAuthConnectionContext.Provider value={value}>{children}</OAuthConnectionContext.Provider>;
};

export default OAuthConnectionContext;
