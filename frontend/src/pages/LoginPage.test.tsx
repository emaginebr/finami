import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import LoginPage from "./LoginPage";
import { AUTH_STORAGE_KEY } from "../Services/apiHelpers";
import { SESSION_EXPIRED_MESSAGE } from "../Contexts/AuthContext";
import { makeUser } from "../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders } from "../test/utils";
import { reportOffline } from "../utils/connectivity";

const AUTH_RESULT = {
  token: "novo-jwt",
  expiresAt: "2999-01-01T00:00:00Z",
  isNewUser: false,
  user: makeUser(),
};

/** Tela de destino que mostra a query recebida */
const SearchProbe = () => {
  const location = useLocation();
  return <p>Tela de autorização {location.search}</p>;
};

/** Tela de cadastro que mostra o `from` recebido no state */
const RegisterProbe = () => {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
  return <p>Tela de cadastro {from ? `${from.pathname}${from.search ?? ""}` : "sem retorno"}</p>;
};

const renderLogin = (state?: unknown) =>
  renderWithProviders(<LoginPage />, {
    path: "/entrar",
    initialEntries: [{ pathname: "/entrar", state }],
    wrapInMain: false,
    extraRoutes: [
      { path: "/carteiras", element: <p>Tela de carteiras</p> },
      { path: "/autorizar", element: <SearchProbe /> },
      { path: "/cadastro", element: <RegisterProbe /> },
      { path: "/", element: <p>Tela inicial</p> },
    ],
  });

describe("LoginPage", () => {
  it("entra e volta para state.from", async () => {
    const fetchMock = mockFetch({ "POST /api/auth/login": { body: AUTH_RESULT } });
    const user = userEvent.setup();

    renderLogin({ from: { pathname: "/carteiras" } });

    await user.type(await screen.findByLabelText("Email"), "ana@ex.com");
    await user.type(screen.getByLabelText("Senha"), "segredo123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Tela de carteiras")).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toContain("novo-jwt");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ email: "ana@ex.com", password: "segredo123" });
  });

  it("volta para a rota de origem com a query string (/autorizar?pedido=…)", async () => {
    mockFetch({ "POST /api/auth/login": { body: AUTH_RESULT } });
    const user = userEvent.setup();

    renderLogin({ from: { pathname: "/autorizar", search: "?pedido=q3Jk" } });

    await user.type(await screen.findByLabelText("Email"), "ana@ex.com");
    await user.type(screen.getByLabelText("Senha"), "segredo123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Tela de autorização ?pedido=q3Jk")).toBeInTheDocument();
  });

  it("\"Criar conta\" leva a rota de retorno adiante", async () => {
    mockFetch({});
    const user = userEvent.setup();

    renderLogin({ from: { pathname: "/autorizar", search: "?pedido=q3Jk" } });

    await user.click(await screen.findByRole("link", { name: "Criar conta" }));

    expect(await screen.findByText("Tela de cadastro /autorizar?pedido=q3Jk")).toBeInTheDocument();
  });

  it("credenciais erradas mostram a mensagem e preservam o email", async () => {
    mockFetch({ "POST /api/auth/login": apiError(401, "Email ou senha inválidos.") });
    const user = userEvent.setup();

    renderLogin();

    await user.type(await screen.findByLabelText("Email"), "ana@ex.com");
    await user.type(screen.getByLabelText("Senha"), "errada123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByText("Email ou senha inválidos.");
    expect(alert.closest("[role='alert']")).toHaveTextContent("Não foi possível entrar");
    expect(screen.getByLabelText("Email")).toHaveValue("ana@ex.com");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("aria-invalid", "true");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("offline mostra a mensagem de erro de rede atual, tentando a rede (feature 005, T043)", async () => {
    reportOffline();
    const fetchMock = mockFetch({
      "POST /api/auth/login": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const user = userEvent.setup();

    renderLogin();
    await user.type(await screen.findByLabelText("Email"), "ana@ex.com");
    await user.type(screen.getByLabelText("Senha"), "segredo123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText(/Não foi possível conectar ao servidor\. Verifique sua conexão\./),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mostra 'Sua sessão expirou' quando o motivo vem no state", async () => {
    mockFetch({});

    renderLogin({ from: { pathname: "/carteiras" }, reason: SESSION_EXPIRED_MESSAGE });

    expect(await screen.findByText("Sua sessão expirou")).toBeInTheDocument();
  });

  it("valida campos vazios sem chamar a API", async () => {
    const fetchMock = mockFetch({});
    const user = userEvent.setup();

    renderLogin();

    await user.click(await screen.findByRole("button", { name: "Entrar" }));

    expect(screen.getAllByText("Campo obrigatório.")).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("oculta o botão do Google sem VITE_GOOGLE_CLIENT_ID e não tem violações do axe", async () => {
    mockFetch({});

    const { container } = renderLogin();

    expect(await screen.findByRole("heading", { level: 1, name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByText("ou")).not.toBeInTheDocument();
    expect(container.querySelector("[data-google-button]")).toBeNull();
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro");
    expect(await axe(container)).toHaveNoViolations();
  });
});
