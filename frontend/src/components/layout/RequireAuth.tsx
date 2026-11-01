import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { AuthStatus } from "../../types/auth";
import type { NavState } from "./navigation";
import { PageLoading } from "./PageLoading";

/**
 * Protege as rotas internas (FR-003): enquanto lê a sessão mostra o carregamento;
 * sem sessão vai para `/entrar` guardando a rota (`from`) e o motivo (`reason`).
 */
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { status, logoutReason } = useAuth();
  const location = useLocation();

  if (status === AuthStatus.Checking) return <PageLoading fullScreen />;

  if (status === AuthStatus.Anonymous) {
    const state: NavState = {
      from: { pathname: location.pathname, search: location.search, hash: location.hash },
      reason: logoutReason,
    };
    return <Navigate to="/entrar" replace state={state} />;
  }

  return <>{children}</>;
};

export default RequireAuth;
