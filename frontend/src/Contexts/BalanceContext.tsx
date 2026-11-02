import { createContext, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { balanceService } from "../Services/balanceService";
import type { GroupBalancesResult, UserGroupBalancesResult } from "../types/balance";
import { OFFLINE_CONTENT_MESSAGE } from "../types/api";
import { errorMessage } from "../utils/notify";

export interface BalanceContextType {
  loading: boolean;
  error: string | null;
  /** O último erro foi "sem internet e sem dado guardado" (feature 005) */
  offline: boolean;
  getGroupBalances: (groupId: number) => Promise<GroupBalancesResult>;
  getUserGroupBalances: (userId: number) => Promise<UserGroupBalancesResult>;
  clearError: () => void;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export const BalanceProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown): never => {
    setError(errorMessage(err));
    throw err;
  }, []);

  const getGroupBalances = useCallback(
    async (groupId: number): Promise<GroupBalancesResult> => {
      try {
        setLoading(true);
        setError(null);
        return await balanceService.getGroupBalances(groupId);
      } catch (err) {
        return handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [handleError],
  );

  const getUserGroupBalances = useCallback(
    async (userId: number): Promise<UserGroupBalancesResult> => {
      try {
        setLoading(true);
        setError(null);
        return await balanceService.getUserGroupBalances(userId);
      } catch (err) {
        return handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [handleError],
  );

  const clearError = useCallback(() => setError(null), []);
  const offline = error === OFFLINE_CONTENT_MESSAGE;

  const value = useMemo<BalanceContextType>(
    () => ({ loading, error, offline, getGroupBalances, getUserGroupBalances, clearError }),
    [loading, error, offline, getGroupBalances, getUserGroupBalances, clearError],
  );

  return <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>;
};

export default BalanceContext;
