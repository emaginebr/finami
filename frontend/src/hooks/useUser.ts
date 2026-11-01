import { useContext } from "react";
import UserContext from "../Contexts/UserContext";

/** Acesso ao UserContext. Lança erro se usado fora do `UserProvider`. */
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
};

export default useUser;
