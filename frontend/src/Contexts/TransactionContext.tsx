import { createContext, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { transactionService } from "../Services/transactionService";
import type {
  IncomeExpenseInfo,
  TransactionInfo,
  TransferInfo,
  TransferPreviewResult,
} from "../types/transaction";
import { errorMessage } from "../utils/notify";
import { useWallet } from "../hooks/useWallet";

export interface TransactionContextType {
  // Estado
  /** Incrementa a cada lançamento/estorno gravado; telas de extrato e saldo recarregam ao mudar */
  ledgerVersion: number;
  loading: boolean;
  error: string | null;
  // Métodos
  createIncome: (data: IncomeExpenseInfo) => Promise<TransactionInfo>;
  createExpense: (data: IncomeExpenseInfo) => Promise<TransactionInfo>;
  createTransfer: (data: TransferInfo) => Promise<TransactionInfo>;
  previewTransfer: (data: TransferInfo) => Promise<TransferPreviewResult>;
  reverse: (transactionId: number, description: string | null) => Promise<TransactionInfo>;
  getTransaction: (transactionId: number) => Promise<TransactionInfo>;
  clearError: () => void;
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

/** Depende do `WalletProvider` (chama `refreshWallets` após gravar) */
export const TransactionProvider = ({ children }: { children: ReactNode }) => {
  const { refreshWallets } = useWallet();
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown): never => {
    setError(errorMessage(err));
    throw err;
  }, []);

  /** Executa uma gravação e, com sucesso, atualiza saldos e `ledgerVersion` */
  const write = useCallback(
    async (action: () => Promise<TransactionInfo>): Promise<TransactionInfo> => {
      try {
        setLoading(true);
        setError(null);
        const result = await action();
        setLedgerVersion((version) => version + 1);
        // A gravação já aconteceu: falha ao recarregar não deve virar erro do lançamento
        refreshWallets().catch(() => undefined);
        return result;
      } catch (err) {
        return handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [handleError, refreshWallets],
  );

  const createIncome = useCallback(
    (data: IncomeExpenseInfo) => write(() => transactionService.income(data)),
    [write],
  );

  const createExpense = useCallback(
    (data: IncomeExpenseInfo) => write(() => transactionService.expense(data)),
    [write],
  );

  const createTransfer = useCallback(
    (data: TransferInfo) => write(() => transactionService.transfer(data)),
    [write],
  );

  const reverse = useCallback(
    (transactionId: number, description: string | null) =>
      write(() => transactionService.reverse(transactionId, { description })),
    [write],
  );

  const previewTransfer = useCallback(
    async (data: TransferInfo): Promise<TransferPreviewResult> => {
      try {
        setError(null);
        return await transactionService.previewTransfer(data);
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const getTransaction = useCallback(
    async (transactionId: number): Promise<TransactionInfo> => {
      try {
        setError(null);
        return await transactionService.get(transactionId);
      } catch (err) {
        return handleError(err);
      }
    },
    [handleError],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<TransactionContextType>(
    () => ({
      ledgerVersion,
      loading,
      error,
      createIncome,
      createExpense,
      createTransfer,
      previewTransfer,
      reverse,
      getTransaction,
      clearError,
    }),
    [
      ledgerVersion,
      loading,
      error,
      createIncome,
      createExpense,
      createTransfer,
      previewTransfer,
      reverse,
      getTransaction,
      clearError,
    ],
  );

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
};

export default TransactionContext;
