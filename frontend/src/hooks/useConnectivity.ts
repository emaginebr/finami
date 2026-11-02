import { useContext } from "react";
import ConnectivityContext from "../Contexts/ConnectivityContext";

/** Acesso ao ConnectivityContext. Lança erro se usado fora do `ConnectivityProvider`. */
export const useConnectivity = () => {
  const context = useContext(ConnectivityContext);
  if (!context) throw new Error("useConnectivity must be used within a ConnectivityProvider");
  return context;
};

export default useConnectivity;
