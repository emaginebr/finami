import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import AuthorizePage from "./AuthorizePage";
import { AUTH_STORAGE_KEY } from "../Services/apiHelpers";
import { OAuthScope } from "../types/oauthRequest";
import type { OAuthRequestInfo } from "../types/oauthRequest";
import { storeSession } from "../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../test/utils";
import type { MockHandler, MockResponse } from "../test/utils";
import { redirectTo } from "../utils/redirect";

// `window.location.assign` simulado: a página sai da SPA por `redirectTo`
vi.mock("../utils/redirect", () => ({ redirectTo: vi.fn() }));

const KEY = "q3Jk";
const REQUEST_PATH = `/api/oauth/requests/${KEY}`;
const APPROVE_URL = "https://claude.ai/api/mcp/auth_callback?code=abc&state=xyz";
const DENY_URL = "https://claude.ai/api/mcp/auth_callback?error=access_denied&state=xyz";

const makeRequest = (overrides: Partial<OAuthRequestInfo> = {}): OAuthRequestInfo => ({
  requestKey: KEY,
  clientName: "Claude",
  redirectHost: "claude.ai",
  scopesRequested: [OAuthScope.Read, OAuthScope.Write],
  expiresAt: "2999-01-01T00:00:00Z",
  ...overrides,
});

/** Mostra a rota atual (pathname + search + state.from) na tela de entrada */
const LoginProbe = () => {
  const location = useLocation();
  const state = location.state as { from?: { pathname: string; search?: string } } | null;
  return (
    <p>
      Tela de entrada · volta para {state?.from ? `${state.from.pathname}${state.from.search ?? ""}` : "nada"}
    </p>
  );
};

const assign = vi.mocked(redirectTo);

const oauthCalls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/oauth/"));

const setup = (
  routes: Record<string, MockResponse | MockHandler> = {},
  { withSession = true, search = `?pedido=${KEY}` }: { withSession?: boolean; search?: string } = {},
) => {
  if (withSession) storeSession();
  const fetchMock = mockFetch({
    [`GET ${REQUEST_PATH}`]: { body: makeRequest() },
    ...routes,
  });
  const user = userEvent.setup();
  const view = renderWithProviders(<AuthorizePage />, {
    path: "/autorizar",
    initialEntries: [`/autorizar${search}`],
    wrapInMain: false,
    extraRoutes: [{ path: "/entrar", element: <LoginProbe /> }],
  });
  return { fetchMock, user, ...view };
};

describe("AuthorizePage", () => {
  beforeEach(() => {
    assign.mockReset();
  });

  it("sem sessão redireciona ao login preservando ?pedido=", async () => {
    const { fetchMock } = setup({}, { withSession: false });

    expect(await screen.findByText(`Tela de entrada · volta para /autorizar?pedido=${KEY}`)).toBeInTheDocument();
    expect(oauthCalls(fetchMock)).toHaveLength(0);
  });

  it("mostra nome do assistente, host de retorno, conta e escopos; axe sem violações", async () => {
    const { container } = setup();

    const heading = await screen.findByRole("heading", { level: 1, name: "Claude quer acessar sua conta" });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText("claude.ai")).toBeInTheDocument();
    expect(screen.getByText("Entrando como")).toBeInTheDocument();
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "O que o assistente pode fazer" })).toBeInTheDocument();
    // Padrão = o que foi pedido (com write → "alterações" marcada)
    expect(screen.getByRole("radio", { name: /Consultar e fazer alterações/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Consultar Ver saldos/ })).not.toBeChecked();
    expect(screen.getByRole("form", { name: "Claude quer acessar sua conta" })).toBeInTheDocument();
    expect(document.title).toBe("Autorizar Claude — Finami");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("escolher \"Consultar\" envia só finami:read e redireciona", async () => {
    const { fetchMock, user } = setup({
      [`POST ${REQUEST_PATH}/approve`]: { body: { redirectUrl: APPROVE_URL } },
    });

    await user.click(await screen.findByRole("radio", { name: /^Consultar Ver saldos/ }));
    await user.click(screen.getByRole("button", { name: "Autorizar" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(APPROVE_URL));
    expect(requestsTo(fetchMock, `POST ${REQUEST_PATH}/approve`)).toEqual([{ scopes: [OAuthScope.Read] }]);
    expect(screen.getByRole("status")).toHaveTextContent("Voltando para claude.ai…");
    expect(screen.getByRole("button", { name: "Negar" })).toBeDisabled();
  });

  it("autorizar com o padrão envia leitura e escrita", async () => {
    const { fetchMock, user } = setup({
      [`POST ${REQUEST_PATH}/approve`]: { body: { redirectUrl: APPROVE_URL } },
    });

    await user.click(await screen.findByRole("button", { name: "Autorizar" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(APPROVE_URL));
    expect(requestsTo(fetchMock, `POST ${REQUEST_PATH}/approve`)).toEqual([
      { scopes: [OAuthScope.Read, OAuthScope.Write] },
    ]);
  });

  it("pedido só de leitura esconde a opção de alterações", async () => {
    const { fetchMock, user, container } = setup({
      [`GET ${REQUEST_PATH}`]: { body: makeRequest({ scopesRequested: [OAuthScope.Read] }) },
      [`POST ${REQUEST_PATH}/approve`]: { body: { redirectUrl: APPROVE_URL } },
    });

    expect(await screen.findByRole("heading", { level: 2, name: "O que o assistente vai poder fazer" })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText("Consultar e fazer alterações")).not.toBeInTheDocument();
    expect(screen.getByText("O assistente pediu só para consultar. Ele não poderá fazer alterações.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Autorizar" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(APPROVE_URL));
    expect(requestsTo(fetchMock, `POST ${REQUEST_PATH}/approve`)).toEqual([{ scopes: [OAuthScope.Read] }]);
  });

  it("Negar chama deny e redireciona", async () => {
    const { fetchMock, user } = setup({
      [`POST ${REQUEST_PATH}/deny`]: { body: { redirectUrl: DENY_URL } },
    });

    await user.click(await screen.findByRole("button", { name: "Negar" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(DENY_URL));
    expect(requestsTo(fetchMock, `POST ${REQUEST_PATH}/deny`)).toHaveLength(1);
    expect(requestsTo(fetchMock, `POST ${REQUEST_PATH}/approve`)).toHaveLength(0);
  });

  it("410 mostra a mensagem de pedido vencido sem botões", async () => {
    setup({
      [`GET ${REQUEST_PATH}`]: apiError(
        410,
        "Este pedido de autorização venceu. Volte ao assistente e tente conectar de novo.",
      ),
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Este pedido de autorização venceu.");
    expect(alert).toHaveTextContent("Volte ao assistente e tente conectar de novo.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("404 e ausência de ?pedido= mostram \"não encontrado\"", async () => {
    const { fetchMock } = setup({}, { search: "" });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Pedido de autorização não encontrado." }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(oauthCalls(fetchMock)).toHaveLength(0);
  });

  it("erro de rede ao enviar mostra o aviso e mantém Autorizar/Negar ativos", async () => {
    const { user } = setup();
    // Depois do GET, a rede cai
    await screen.findByRole("heading", { level: 1 });
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));

    await user.click(screen.getByRole("button", { name: "Autorizar" }));

    expect(await screen.findByText("Não foi possível enviar sua resposta")).toBeInTheDocument();
    expect(screen.getByText("Confira sua conexão e toque de novo em Autorizar ou Negar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Autorizar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Negar" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Autorizar" })).toHaveFocus());
    expect(assign).not.toHaveBeenCalled();
  });

  it("erro de rede ao carregar oferece \"Tentar de novo\"", async () => {
    let calls = 0;
    const { user } = setup({
      [`GET ${REQUEST_PATH}`]: () => {
        calls += 1;
        return calls === 1 ? { status: 503, text: "" } : { body: makeRequest() };
      },
    });

    expect(await screen.findByText("Não foi possível carregar o pedido")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Claude quer acessar sua conta" })).toBeInTheDocument();
  });

  it("\"Tentar de novo\" fica na faixa em loading com o foco e, se falhar de novo, o foco continua nele", async () => {
    let calls = 0;
    let release: (response: MockResponse) => void = () => undefined;
    const { user } = setup({
      [`GET ${REQUEST_PATH}`]: () => {
        calls += 1;
        if (calls === 1) return { status: 503, text: "" };
        return new Promise<MockResponse>((resolve) => {
          release = resolve;
        });
      },
    });

    const retry = await screen.findByRole("button", { name: "Tentar de novo" });
    // Botão dentro da faixa de erro (B-1) e título da página sem pedido (B-6)
    expect(screen.getByRole("alert")).toContainElement(retry);
    expect(document.title).toBe("Autorizar assistente — Finami");

    await user.click(retry);

    // A faixa continua montada; o mesmo botão vira "Carregando…" e mantém o foco
    const busy = await screen.findByRole("button", { name: "Carregando…" });
    expect(busy).toBe(retry);
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(busy).toHaveFocus();
    expect(screen.getByText("Não foi possível carregar o pedido")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /quer acessar/ })).not.toBeInTheDocument();

    // Simula o navegador tirando o foco do botão `disabled`; a nova falha devolve o foco a ele
    act(() => busy.blur());
    act(() => release({ status: 503, text: "" }));

    const again = await screen.findByRole("button", { name: "Tentar de novo" });
    expect(again).toBe(retry);
    expect(again).toBeEnabled();
    await waitFor(() => expect(again).toHaveFocus());
    expect(calls).toBe(2);
  });

  it("durante o envio as opções ficam desabilitadas e apagadas", async () => {
    let release: (response: MockResponse) => void = () => undefined;
    const { user } = setup({
      [`POST ${REQUEST_PATH}/approve`]: () =>
        new Promise<MockResponse>((resolve) => {
          release = resolve;
        }),
    });

    const write = await screen.findByRole("radio", { name: /Consultar e fazer alterações/ });
    const writeLabel = write.closest("label")!;
    expect(writeLabel).toHaveClass("cursor-pointer", "hover:bg-surface-3");
    expect(screen.getByText("Consultar e fazer alterações")).not.toHaveClass("text-text-disabled");

    await user.click(screen.getByRole("button", { name: "Autorizar" }));

    expect(await screen.findByRole("button", { name: "Conectando…" })).toBeDisabled();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    expect(writeLabel).toHaveClass("cursor-not-allowed");
    expect(writeLabel).not.toHaveClass("hover:bg-surface-3");
    expect(screen.getByText("Consultar e fazer alterações")).toHaveClass("text-text-disabled");
    expect(screen.getByText(/^Também lançar receitas/)).toHaveClass("text-text-disabled");
    expect(writeLabel.querySelector("span[aria-hidden='true']")).toHaveClass("opacity-50");

    act(() => release({ body: { redirectUrl: APPROVE_URL } }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(APPROVE_URL));
  });

  it("\"Trocar de conta\" encerra a sessão e volta ao login mantendo o retorno", async () => {
    const { user } = setup();

    await user.click(await screen.findByRole("button", { name: "Trocar de conta" }));

    expect(await screen.findByText(`Tela de entrada · volta para /autorizar?pedido=${KEY}`)).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
