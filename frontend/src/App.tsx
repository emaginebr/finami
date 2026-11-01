import { useState } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { appRoutes } from "./routes";

/** Base path opcional (ex.: "/finami"); vazio = raiz */
const basename = import.meta.env.VITE_SITE_BASENAME?.trim() || undefined;

/** Roteador da SPA (rotas em `routes.tsx`) */
const App = () => {
  const [router] = useState(() => createBrowserRouter(appRoutes, { basename }));
  return <RouterProvider router={router} />;
};

export default App;
