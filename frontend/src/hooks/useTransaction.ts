import { useContext } from "react";
import TransactionContext from "../Contexts/TransactionContext";

/** Acesso ao TransactionContext. Lança erro se usado fora do `TransactionProvider`. */
export const useTransaction = () => {
  const context = useContext(TransactionContext);
  if (!context) throw new Error("useTransaction must be used within a TransactionProvider");
  return context;
};

export default useTransaction;
