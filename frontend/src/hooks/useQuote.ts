import { useContext } from "react";
import QuoteContext from "../Contexts/QuoteContext";

/** Acesso ao QuoteContext. Lança erro se usado fora do `QuoteProvider`. */
export const useQuote = () => {
  const context = useContext(QuoteContext);
  if (!context) throw new Error("useQuote must be used within a QuoteProvider");
  return context;
};

export default useQuote;
