import { createContext, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { statementService } from "../Services/statementService";
import type { StatementResult } from "../types/statement";
import { OFFLINE_CONTENT_MESSAGE } from "../types/api";
import { errorMessage } from "../utils/notify";

export interface StatementContextType {
  loading: boolean;
  error: string | null;
  /** O último erro foi "sem internet e sem dado guardado" (feature 005) */
  offline: boolean;
  getWalletStatement: (walletId: number, start: string, end: string) => Promise<StatementResult>;
  getUserStatement: (userId: number, start: string, end: string) => Promise<StatementResult>;
  getGroupStatement: (groupId: number, start: string, end: string) => Promise<StatementResult>;
  clearError: () => void;
}

const StatementContext = createContext<StatementContextType | undefined>(undefined);

export const StatementProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown): never => {
    setError(errorMessage(err));
    throw err;
  }, []);

  const run = useCallback(
    async (action: () => Promise<StatementResult>): Promise<StatementResult> => {
      try {
        setLoading(true);
        setError(null);
        return await action();
      } catch (err) {
        return handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [handleError],
  );

  const getWalletStatement = useCallback(
    (walletId: number, start: string, end: string) =>
      run(() => statementService.getWallet(walletId, start, end)),
    [run],
  );

  const getUserStatement = useCallback(
    (userId: number, start: string, end: string) => run(() => statementService.getUser(userId, start, end)),
    [run],
  );

  const getGroupStatement = useCallback(
    (groupId: number, start: string, end: string) =>
      run(() => statementService.getGroup(groupId, start, end)),
    [run],
  );

  const clearError = useCallback(() => setError(null), []);
  const offline = error === OFFLINE_CONTENT_MESSAGE;

  const value = useMemo<StatementContextType>(
    () => ({ loading, error, offline, getWalletStatement, getUserStatement, getGroupStatement, clearError }),
    [loading, error, offline, getWalletStatement, getUserStatement, getGroupStatement, clearError],
  );

  return <StatementContext.Provider value={value}>{children}</StatementContext.Provider>;
};

export default StatementContext;
