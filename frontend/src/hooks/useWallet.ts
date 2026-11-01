import { useContext } from "react";
import WalletContext from "../Contexts/WalletContext";

/** Acesso ao WalletContext. Lança erro se usado fora do `WalletProvider`. */
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within a WalletProvider");
  return context;
};

export default useWallet;
