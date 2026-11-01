import { createContext, useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { walletService } from "../Services/walletService";
import type {
  WalletInfo,
  WalletInsertInfo,
  WalletListFilters,
  WalletPublicInfo,
  WalletUpdateInfo,
} from "../types/wallet";
import { errorMessage } from "../utils/notify";
import { useOnUserChange } from "../hooks/useOnUserChange";

export interface WalletContextType {
  // Estado
  /** Carteiras da última listagem (padrão: ativas que a pessoa controla) */
  wallets: WalletInfo[];
  /** A lista já foi carregada ao menos uma vez nesta sessão */
  loaded: boolean;
  loading: boolean;
  error: string | null;
  // Métodos
  loadWallets: (filters?: WalletListFilters) => Promise<void>;
  /** Recarrega com os mesmos filtros da última listagem */
  refreshWallets: () => Promise<void>;
  getWallet: (walletId: number) => Promise<WalletInfo>;
  createWallet: (data: WalletInsertInfo) => Promise<WalletInfo>;
  updateWallet: (walletId: number, data: WalletUpdateInfo) => Promise<WalletInfo>;
  setWalletGroup: (walletId: number, groupId: number | null) => Promise<WalletInfo>;
  deactivateWallet: (walletId: number) => Promise<void>;
  deleteWallet: (walletId: number) => Promise<void>;
  getPublicWallet: (walletId: number) => Promise<WalletPublicInfo>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const replace = (list: WalletInfo[], wallet: WalletInfo): WalletInfo[] =>
  list.some((item) => item.walletId === wallet.walletId)
    ? list.map((item) => (item.walletId === wallet.walletId ? wallet : item))
    : list;

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFilters = useRef<WalletListFilters>({});

  useOnUserChange(() => {
    setWallets([]);
    setLoaded(false);
    setError(null);
    lastFilters.current = {};
  });

  const handleError = useCallback((err: unknown): never => {
    setError(errorMessage(err));
    throw err;
  }, []);

  const loadWallets = useCallback(
    async (filters: WalletListFilters = {}): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        lastFilters.current = filters;
        setWallets(await walletService.list(filters));
        setLoaded(true);
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [handleError],
  );

  const refreshWallets = useCallback(
    () => loadWallets(lastFilters.current),
    [loadWallets],
  );

  const getWallet = useCallback(
    async (walletId: number): Promise<WalletInfo> => {
      try {
        setError(null);
        const wallet = await walletService.get(walletId);
        setWallets((prev) => replace(prev, wallet));
        return wallet;
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const createWallet = useCallback(
    async (data: WalletInsertInfo): Promise<WalletInfo> => {
      try {
        setError(null);
        const wallet = await walletService.create(data);
        await loadWallets(lastFilters.current);
        return wallet;
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError, loadWallets],
  );

  const updateWallet = useCallback(
    async (walletId: number, data: WalletUpdateInfo): Promise<WalletInfo> => {
      try {
        setError(null);
        const wallet = await walletService.update(walletId, data);
        setWallets((prev) => replace(prev, wallet));
        return wallet;
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const setWalletGroup = useCallback(
    async (walletId: number, groupId: number | null): Promise<WalletInfo> => {
      try {
        setError(null);
        const wallet = await walletService.setGroup(walletId, { groupId });
        setWallets((prev) => replace(prev, wallet));
        return wallet;
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const deactivateWallet = useCallback(
    async (walletId: number): Promise<void> => {
      try {
        setError(null);
        await walletService.deactivate(walletId);
        await loadWallets(lastFilters.current);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError, loadWallets],
  );

  const deleteWallet = useCallback(
    async (walletId: number): Promise<void> => {
      try {
        setError(null);
        await walletService.delete(walletId);
        setWallets((prev) => prev.filter((item) => item.walletId !== walletId));
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const getPublicWallet = useCallback(
    async (walletId: number): Promise<WalletPublicInfo> => {
      try {
        setError(null);
        return await walletService.getPublic(walletId);
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<WalletContextType>(
    () => ({
      wallets,
      loaded,
      loading,
      error,
      loadWallets,
      refreshWallets,
      getWallet,
      createWallet,
      updateWallet,
      setWalletGroup,
      deactivateWallet,
      deleteWallet,
      getPublicWallet,
      clearError,
    }),
    [
      wallets,
      loaded,
      loading,
      error,
      loadWallets,
      refreshWallets,
      getWallet,
      createWallet,
      updateWallet,
      setWalletGroup,
      deactivateWallet,
      deleteWallet,
      getPublicWallet,
      clearError,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export default WalletContext;
