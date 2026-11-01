import { useContext } from "react";
import BalanceContext from "../Contexts/BalanceContext";

/** Acesso ao BalanceContext. Lança erro se usado fora do `BalanceProvider`. */
export const useBalance = () => {
  const context = useContext(BalanceContext);
  if (!context) throw new Error("useBalance must be used within a BalanceProvider");
  return context;
};

export default useBalance;
