import { useContext } from "react";
import InstallContext from "../Contexts/InstallContext";

/** Acesso ao InstallContext. Lança erro se usado fora do `InstallProvider`. */
export const useInstall = () => {
  const context = useContext(InstallContext);
  if (!context) throw new Error("useInstall must be used within an InstallProvider");
  return context;
};

export default useInstall;
