import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { vi } from "vitest";
import { configureAxe } from "vitest-axe";
import { AuthProvider } from "../Contexts/AuthContext";
import { BalanceProvider } from "../Contexts/BalanceContext";
import { StatementProvider } from "../Contexts/StatementContext";
import { UserProvider } from "../Contexts/UserContext";
import { GroupProvider } from "../Contexts/GroupContext";
import { QuoteProvider } from "../Contexts/QuoteContext";
import { TransactionProvider } from "../Contexts/TransactionContext";
import { UiProvider } from "../Contexts/UiContext";
import { WalletProvider } from "../Contexts/WalletContext";
import { InvitationProvider } from "../Contexts/InvitationContext";
import { NotificationProvider } from "../Contexts/NotificationContext";
import { OAuthConnectionProvider } from "../Contexts/OAuthConnectionContext";
import { ConnectivityProvider } from "../Contexts/ConnectivityContext";
import { InstallProvider } from "../Contexts/InstallContext";

/** axe sem as regras que dependem da página inteira ou de CSS real (jsdom) */
export const axe = configureAxe({
  rules: {
    region: { enabled: false },
    "color-contrast": { enabled: false },
  },
});

// ---------------------------------------------------------------------------
// fetch simulado
// ---------------------------------------------------------------------------

export interface MockRequest {
  method: string;
  path: string;
  search: string;
  /** Corpo JSON já lido */
  body: unknown;
}

export interface MockResponse {
  status?: number;
  /** Serializado como JSON */
  body?: unknown;
  /** Corpo de texto puro (ignora `body`) */
  text?: string;
}

export interface MockHandler {
  (request: MockRequest): MockResponse | Promise<MockResponse>;
}

/** Envelope de erro do backend */
export const apiError = (status: number, mensagem: string, erros: string[] = []): MockResponse => ({
  status,
  body: { sucesso: false, mensagem, erros },
});

/**
 * Substitui `fetch` por um simulador baseado em "MÉTODO /caminho"
 * (ex.: `"GET /api/wallets"`). Rotas não simuladas respondem 404.
 */
export const mockFetch = (routes: Record<string, MockResponse | MockHandler>) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${url.pathname}`;
    const route = routes[`${key}${url.search}`] ?? routes[key];
    const request: MockRequest = {
      method,
      path: url.pathname,
      search: url.search,
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
    };
    const response: MockResponse = route
      ? typeof route === "function"
        ? await route(request)
        : route
      : apiError(404, `Rota não simulada: ${key}`);
    const status = response.status ?? 200;
    if (status === 204) return new Response(null, { status });
    const payload = response.text ?? JSON.stringify(response.body ?? null);
    return new Response(payload, {
      status,
      headers: { "Content-Type": response.text !== undefined ? "text/plain" : "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

/** Corpos JSON enviados para uma rota ("POST /api/transactions/income") */
export const requestsTo = (fetchMock: ReturnType<typeof mockFetch>, key: string): unknown[] =>
  fetchMock.mock.calls
    .filter(([input, init]) => {
      const url = new URL(String(input), "http://localhost");
      return `${(init?.method ?? "GET").toUpperCase()} ${url.pathname}` === key;
    })
    .map(([, init]) => (typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined));

// ---------------------------------------------------------------------------
// Render com providers e rotas
// ---------------------------------------------------------------------------

/** Providers na ordem de main.tsx (data-model §10; Connectivity/Install da feature 005) */
export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ConnectivityProvider>
    <InstallProvider>
      <AuthProvider>
        <QuoteProvider>
          <UserProvider>
            <GroupProvider>
              <WalletProvider>
                <TransactionProvider>
                  <StatementProvider>
                    <BalanceProvider>
                      <InvitationProvider>
                        <NotificationProvider>
                          <OAuthConnectionProvider>
                            <UiProvider>{children}</UiProvider>
                          </OAuthConnectionProvider>
                        </NotificationProvider>
                      </InvitationProvider>
                    </BalanceProvider>
                  </StatementProvider>
                </TransactionProvider>
              </WalletProvider>
            </GroupProvider>
          </UserProvider>
        </QuoteProvider>
      </AuthProvider>
    </InstallProvider>
  </ConnectivityProvider>
);

type MemoryRouterOptions = NonNullable<Parameters<typeof createMemoryRouter>[1]>;

export interface RenderOptions {
  /** Rota do elemento testado (padrão "/") */
  path?: string;
  initialEntries?: MemoryRouterOptions["initialEntries"];
  /** Rotas extras (ex.: destino de um redirecionamento) */
  extraRoutes?: RouteObject[];
  /** Envolve o elemento em `<main>` (padrão true) */
  wrapInMain?: boolean;
}

export const renderWithProviders = (element: ReactElement, options: RenderOptions = {}) => {
  const { path = "/", initialEntries = [path], extraRoutes = [], wrapInMain = true } = options;
  const router = createMemoryRouter(
    [{ path, element: wrapInMain ? <main>{element}</main> : element }, ...extraRoutes],
    { initialEntries },
  );
  const result = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...result };
};
