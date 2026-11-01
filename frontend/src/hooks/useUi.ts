import { useContext } from "react";
import UiContext from "../Contexts/UiContext";

/** Acesso ao UiContext. Lança erro se usado fora do `UiProvider`. */
export const useUi = () => {
  const context = useContext(UiContext);
  if (!context) throw new Error("useUi must be used within a UiProvider");
  return context;
};

export default useUi;
