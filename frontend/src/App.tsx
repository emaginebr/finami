import { useEffect, useState } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { AppUpdateProvider } from "./Contexts/AppUpdateContext";
import { useConnectivity } from "./hooks/useConnectivity";
import { appRoutes } from "./routes";

/** Base path opcional (ex.: "/finami"); vazio = raiz */
const basename = import.meta.env.VITE_SITE_BASENAME?.trim() || undefined;

/** Roteador da SPA (rotas em `routes.tsx`) + registro do service worker (feature 005) */
const App = () => {
  const [router] = useState(() => createBrowserRouter(appRoutes, { basename }));
  const { resetFreshness } = useConnectivity();

  // A data "dados de …" do indicador offline vale para a tela atual (data-model.md §Freshness)
  useEffect(() => {
    let pathname = router.state.location.pathname;
    return router.subscribe((state) => {
      if (state.location.pathname === pathname) return;
      pathname = state.location.pathname;
      resetFreshness();
    });
  }, [router, resetFreshness]);

  // Um único registro do SW; o aviso de versão é renderizado dentro de cada casca (REVIEW-005 M-6)
  return (
    <AppUpdateProvider>
      <RouterProvider router={router} />
    </AppUpdateProvider>
  );
};

export default App;
