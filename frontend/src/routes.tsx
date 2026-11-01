import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { PageLoading } from "./components/layout/PageLoading";
import { RequireAuth } from "./components/layout/RequireAuth";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";

// Só Home e Login no bundle inicial (research R-16); o resto sob demanda
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const WalletsPage = lazy(() => import("./pages/WalletsPage"));
const WalletStatementPage = lazy(() => import("./pages/WalletStatementPage"));
const GroupPage = lazy(() => import("./pages/GroupPage"));
const MemberPage = lazy(() => import("./pages/MemberPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const AuthorizePage = lazy(() => import("./pages/AuthorizePage"));

const withSuspense = (element: ReactNode) => (
  <Suspense fallback={<PageLoading fullScreen />}>{element}</Suspense>
);

/** Rotas da SPA (contracts/ui-routes.md); páginas internas usam o Suspense do AppShell */
export const appRoutes: RouteObject[] = [
  { path: "/entrar", element: <LoginPage /> },
  { path: "/cadastro", element: withSuspense(<RegisterPage />) },
  // Consentimento OAuth (feature 004): fora das abas; a própria página exige sessão
  { path: "/autorizar", element: withSuspense(<AuthorizePage />) },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: "carteiras", element: <WalletsPage /> },
      { path: "carteiras/:walletId", element: <WalletStatementPage /> },
      { path: "familias/:groupId", element: <GroupPage /> },
      { path: "pessoas/:userId", element: <MemberPage /> },
      { path: "conta", element: <AccountPage /> },
      { path: "notificacoes", element: <NotificationsPage /> },
    ],
  },
  { path: "*", element: withSuspense(<NotFoundPage />) },
];
