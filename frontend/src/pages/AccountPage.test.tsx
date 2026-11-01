import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountPage from "./AccountPage";
import { AUTH_STORAGE_KEY } from "../Services/apiHelpers";
import type { AuthSession } from "../types/auth";
import type { UserInfo } from "../types/user";
import { makeSession, makeUser, storeSession } from "../test/fixtures";
import { axe, mockFetch, renderWithProviders, requestsTo } from "../test/utils";
import type { MockHandler, MockResponse } from "../test/utils";

const setup = (user: UserInfo = makeUser(), routes: Record<string, MockResponse | MockHandler> = {}) => {
  storeSession(makeSession({ user }));
  const fetchMock = mockFetch({
    "GET /api/users/created-by-me": {
      body: [makeUser({ userId: 9, firstName: "Pedro", lastName: "Silva", email: null, canLogin: false })],
    },
    "GET /api/oauth/connections": { body: [] },
    "GET /api/oauth/mcp-info": { body: { mcpUrl: "https://finami.app/mcp" } },
    ...routes,
  });
  const userEv = userEvent.setup();
  const view = renderWithProviders(<AccountPage />, {
    path: "/conta",
    initialEntries: ["/conta"],
    extraRoutes: [{ path: "/entrar", element: <p>Tela de entrada</p> }],
  });
  return { fetchMock, user: userEv, ...view };
};

describe("AccountPage", () => {
  it("editar o nome atualiza a sessão", async () => {
    const updated = makeUser({ lastName: "Silva Ramos" });
    const { fetchMock, user, container } = setup(makeUser(), {
      "PUT /api/users/7": { body: updated },
      "GET /api/auth/me": { body: updated },
    });

    expect(await screen.findByText("Pedro Silva")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: /^Sobrenome/ }));
    const dialog = await screen.findByRole("dialog", { name: "Dados pessoais" });
    const lastName = within(dialog).getByLabelText("Sobrenome");
    await user.clear(lastName);
    await user.type(lastName, "Silva Ramos");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, "PUT /api/users/7")).toEqual([
        { firstName: "Ana", lastName: "Silva Ramos", email: "ana@ex.com" },
      ]),
    );
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null") as AuthSession;
      expect(stored.user.lastName).toBe("Silva Ramos");
    });
    expect(await screen.findByRole("link", { name: "Ana Silva Ramos" })).toHaveAttribute("href", "/pessoas/7");
  });

  it("trocar senha exige a senha atual quando a pessoa já tem senha", async () => {
    const { fetchMock, user } = setup(makeUser(), { "PUT /api/users/7/password": { status: 204 } });

    await user.click(await screen.findByRole("button", { name: "Trocar senha" }));
    const dialog = await screen.findByRole("dialog", { name: "Trocar senha" });
    await user.type(within(dialog).getByLabelText("Senha atual"), "antiga123");
    await user.type(within(dialog).getByLabelText("Nova senha"), "nova12345");
    await user.click(within(dialog).getByRole("button", { name: "Trocar senha" }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, "PUT /api/users/7/password")).toEqual([
        { currentPassword: "antiga123", newPassword: "nova12345" },
      ]),
    );
  });

  it("definir senha sem a atual quando a pessoa só usa Google", async () => {
    const { fetchMock, user } = setup(makeUser({ hasPassword: false, hasGoogle: true }), {
      "PUT /api/users/7/password": { status: 204 },
    });

    expect(await screen.findByText("Vinculado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Definir senha" }));
    const dialog = await screen.findByRole("dialog", { name: "Definir senha" });
    expect(within(dialog).queryByLabelText("Senha atual")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Nova senha"), "nova12345");
    await user.click(within(dialog).getByRole("button", { name: "Definir senha" }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, "PUT /api/users/7/password")).toEqual([
        { currentPassword: null, newPassword: "nova12345" },
      ]),
    );
  });

  it("seção \"Assistentes conectados\" fica entre Segurança e Pessoas que cadastrei", async () => {
    setup();

    expect(await screen.findByText("Nenhum assistente conectado.")).toBeInTheDocument();
    const titles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(titles).toEqual(["Dados pessoais", "Segurança", "Assistentes conectados", "Pessoas que cadastrei"]);
  });

  it("sair com confirmação remove finami:auth e vai para /entrar", async () => {
    const { user } = setup();

    await user.click(await screen.findByRole("button", { name: "Sair" }));
    const dialog = await screen.findByRole("alertdialog", { name: /Sair do Finami\?/ });
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Sair" }));

    expect(await screen.findByText("Tela de entrada")).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
