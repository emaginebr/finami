import { createContext, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

/** Estado leve de interface: abertura da folha de lançamento (botão "+") */
export interface UiContextType {
  transactionSheetOpen: boolean;
  /** Carteira pré-selecionada (ex.: a do extrato aberto) */
  transactionSheetWalletId: number | null;
  /** Muda a cada abertura; usado como `key` para a folha começar do zero */
  transactionSheetKey: number;
  openTransactionSheet: (defaultWalletId?: number | null) => void;
  setTransactionSheetOpen: (open: boolean) => void;
}

const UiContext = createContext<UiContextType | undefined>(undefined);

export const UiProvider = ({ children }: { children: ReactNode }) => {
  const [transactionSheetOpen, setOpen] = useState(false);
  const [transactionSheetWalletId, setWalletId] = useState<number | null>(null);
  const [transactionSheetKey, setKey] = useState(0);

  const openTransactionSheet = useCallback((defaultWalletId: number | null = null) => {
    setWalletId(defaultWalletId);
    setKey((key) => key + 1);
    setOpen(true);
  }, []);

  const setTransactionSheetOpen = useCallback((open: boolean) => setOpen(open), []);

  const value = useMemo<UiContextType>(
    () => ({
      transactionSheetOpen,
      transactionSheetWalletId,
      transactionSheetKey,
      openTransactionSheet,
      setTransactionSheetOpen,
    }),
    [transactionSheetOpen, transactionSheetWalletId, transactionSheetKey, openTransactionSheet, setTransactionSheetOpen],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
};

export default UiContext;
