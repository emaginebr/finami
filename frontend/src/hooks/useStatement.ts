import { useContext } from "react";
import StatementContext from "../Contexts/StatementContext";

/** Acesso ao StatementContext. Lança erro se usado fora do `StatementProvider`. */
export const useStatement = () => {
  const context = useContext(StatementContext);
  if (!context) throw new Error("useStatement must be used within a StatementProvider");
  return context;
};

export default useStatement;
