import { useContext } from "react";
import OAuthConnectionContext from "../Contexts/OAuthConnectionContext";

/** Acesso ao OAuthConnectionContext. Lança erro se usado fora do `OAuthConnectionProvider`. */
export const useOAuthConnection = () => {
  const context = useContext(OAuthConnectionContext);
  if (!context) throw new Error("useOAuthConnection must be used within an OAuthConnectionProvider");
  return context;
};

export default useOAuthConnection;
