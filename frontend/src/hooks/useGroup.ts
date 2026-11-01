import { useContext } from "react";
import GroupContext from "../Contexts/GroupContext";

/** Acesso ao GroupContext. Lança erro se usado fora do `GroupProvider`. */
export const useGroup = () => {
  const context = useContext(GroupContext);
  if (!context) throw new Error("useGroup must be used within a GroupProvider");
  return context;
};

export default useGroup;
