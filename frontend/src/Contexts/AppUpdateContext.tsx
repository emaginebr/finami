import { createContext } from "react";
import type { ReactNode } from "react";
import { useAppUpdate } from "../hooks/useAppUpdate";
import type { AppUpdate } from "../hooks/useAppUpdate";

/**
 * Estado da atualização do app (um único registro do service worker) para o `UpdatePrompt`,
 * que é renderizado dentro de cada casca: `AppShell`, `AuthLayout` e `OfflinePage`
 * (REVIEW-005 M-6). Fica acima do roteador, em `App.tsx`.
 */
const AppUpdateContext = createContext<AppUpdate | undefined>(undefined);

export const AppUpdateProvider = ({ children }: { children: ReactNode }) => {
  const value = useAppUpdate();
  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>;
};

export default AppUpdateContext;
