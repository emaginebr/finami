import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, SESSION_EXPIRED_MESSAGE } from "./AuthContext";
import { useAuth } from "../hooks/useAuth";
import { AUTH_STORAGE_KEY } from "../Services/apiHelpers";
import type { AuthResult, AuthSession } from "../types/auth";
import type { UserInfo } from "../types/user";
import { offlineCache } from "../utils/offlineCache";

const USER: UserInfo = {
  userId: 7,
  firstName: "Ana",
  lastName: "Silva",
  email: "ana@ex.com",
  hasPassword: true,
  hasGoogle: false,
  canLogin: true,
  createdByUserId: null,
  createdAt: "2026-01-01T00:00:00Z",
};

const FUTURE = "2999-01-01T00:00:00Z";

const storeSession = (session: AuthSession | string) => {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    typeof session === "string" ? session : JSON.stringify(session),
  );
};

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const Probe = () => {
  const { status, session, logoutReason, error, login, logout, refreshMe } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{session ? session.user.firstName : "—"}</p>
      <p data-testid="reason">{logoutReason ?? ""}</p>
      <p data-testid="error">{error ?? ""}</p>
      <button
        type="button"
        onClick={() => {
          login({ email: "ana@ex.com", password: "segredo123" }).catch(() => undefined);
        }}
      >
        entrar
      </button>
      <button type="button" onClick={logout}>
        sair
      </button>
      <button
        type="button"
        onClick={() => {
          refreshMe().catch(() => undefined);
        }}
      >
        atualizar
      </button>
    </div>
  );
};

const renderWithAuth = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

const expectStatus = async (status: string) => {
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent(status));
};

describe("AuthContext", () => {
  it("restaura uma sessão válida do localStorage", async () => {
    storeSession({ token: "jwt", expiresAt: FUTURE, user: USER });

    renderWithAuth();

    await expectStatus("authenticated");
    expect(screen.getByTestId("user")).toHaveTextContent("Ana");
  });

  it("descarta sessão expirada", async () => {
    storeSession({ token: "jwt", expiresAt: "2000-01-01T00:00:00Z", user: USER });

    renderWithAuth();

    await expectStatus("anonymous");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("descarta JSON inválido", async () => {
    storeSession("{corrompido");

    renderWithAuth();

    await expectStatus("anonymous");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("login grava a sessão na chave finami:auth", async () => {
    const result: AuthResult = { token: "novo-jwt", expiresAt: FUTURE, isNewUser: false, user: USER };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, result));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderWithAuth();
    await expectStatus("anonymous");
    await user.click(screen.getByRole("button", { name: "entrar" }));

    await expectStatus("authenticated");
    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null") as AuthSession;
    expect(stored).toEqual({ token: "novo-jwt", expiresAt: FUTURE, user: USER });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/auth\/login$/);
    expect(init.method).toBe("POST");
  });

  it("login com credenciais erradas mostra o erro e não marca sessão expirada", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, { sucesso: false, mensagem: "Email ou senha inválidos.", erros: [] }),
      ),
    );
    const user = userEvent.setup();

    renderWithAuth();
    await expectStatus("anonymous");
    await user.click(screen.getByRole("button", { name: "entrar" }));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("Email ou senha inválidos."),
    );
    expect(screen.getByTestId("reason")).toBeEmptyDOMElement();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("logout remove a sessão", async () => {
    storeSession({ token: "jwt", expiresAt: FUTURE, user: USER });
    const user = userEvent.setup();

    renderWithAuth();
    await expectStatus("authenticated");
    await user.click(screen.getByRole("button", { name: "sair" }));

    await expectStatus("anonymous");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId("reason")).toBeEmptyDOMElement();
  });

  it("logout apaga os dados guardados para uso offline (IndexedDB)", async () => {
    storeSession({ token: "jwt", expiresAt: FUTURE, user: USER });
    await offlineCache.set(USER.userId, "/api/wallets", [{ walletId: 1 }]);
    const user = userEvent.setup();

    renderWithAuth();
    await expectStatus("authenticated");
    await user.click(screen.getByRole("button", { name: "sair" }));

    await expectStatus("anonymous");
    await waitFor(async () => {
      expect(await offlineCache.get(USER.userId, "/api/wallets")).toBeUndefined();
    });
  });

  it("sessão que vence com o app aberto apaga os dados guardados", async () => {
    await offlineCache.set(USER.userId, "/api/wallets", [{ walletId: 1 }]);
    // Vence logo depois de restaurada
    storeSession({ token: "jwt", expiresAt: new Date(Date.now() + 400).toISOString(), user: USER });

    renderWithAuth();
    await expectStatus("authenticated");

    await expectStatus("anonymous");
    expect(screen.getByTestId("reason")).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
    await waitFor(async () => {
      expect(await offlineCache.get(USER.userId, "/api/wallets")).toBeUndefined();
    });
  });

  it("me offline com dado guardado mantém a pessoa logada com os dados guardados", async () => {
    storeSession({ token: "jwt", expiresAt: FUTURE, user: USER });
    await offlineCache.set(USER.userId, "/api/auth/me", { ...USER, firstName: "Ana guardada" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const user = userEvent.setup();

    renderWithAuth();
    await expectStatus("authenticated");
    await user.click(screen.getByRole("button", { name: "atualizar" }));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("Ana guardada"));
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
  });

  it("me offline sem dado guardado não derruba a sessão", async () => {
    storeSession({ token: "jwt", expiresAt: FUTURE, user: USER });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const user = userEvent.setup();

    renderWithAuth();
    await expectStatus("authenticated");
    await user.click(screen.getByRole("button", { name: "atualizar" }));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("Este conteúdo não está disponível sem internet."),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("user")).toHaveTextContent("Ana");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();
  });

  it("401 em requisição autenticada leva a anonymous com o motivo", async () => {
    storeSession({ token: "jwt", expiresAt: FUTURE, user: USER });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, { sucesso: false, mensagem: "Não autenticado.", erros: [] }),
      ),
    );
    const user = userEvent.setup();

    renderWithAuth();
    await expectStatus("authenticated");
    await user.click(screen.getByRole("button", { name: "atualizar" }));

    await expectStatus("anonymous");
    expect(screen.getByTestId("reason")).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
