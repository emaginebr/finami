import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";
import { storeSession } from "../../test/fixtures";
import { mockFetch, renderWithProviders } from "../../test/utils";

/** Renderiza a casca numa rota qualquer (o conteúdo da rota não importa para o Fab) */
const renderShellAt = (pathname: string) => {
  storeSession();
  mockFetch({ "GET /api/notifications/unread-count": { body: { unread: 0 } } });
  return renderWithProviders(<AppShell />, { path: "*", initialEntries: [pathname], wrapInMain: false });
};

describe("AppShell — botão flutuante (feature 006, FR-024/025)", () => {
  it.each(["/", "/carteiras", "/familias", "/familias/3", "/pessoas/8", "/conta", "/notificacoes"])(
    "mostra o Fab em %s",
    (pathname) => {
      renderShellAt(pathname);

      expect(screen.getByRole("button", { name: "Novo lançamento" })).toBeInTheDocument();
    },
  );

  it.each(["/depositar", "/sacar", "/transferir"])("não mostra o Fab na tela de lançamento %s", (pathname) => {
    renderShellAt(pathname);

    expect(screen.queryByRole("button", { name: "Novo lançamento" })).not.toBeInTheDocument();
  });

  it("no extrato de uma carteira repassa o walletId para o lançamento", async () => {
    renderShellAt("/carteiras/12");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));

    const menu = screen.getByRole("list", { name: "Novo lançamento" });
    expect(within(menu).getByRole("link", { name: "Transferir" })).toHaveAttribute(
      "href",
      "/transferir?carteira=12",
    );
  });

  it("fora do extrato não pré-seleciona carteira", async () => {
    renderShellAt("/pessoas/8");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));

    const menu = screen.getByRole("list", { name: "Novo lançamento" });
    expect(within(menu).getByRole("link", { name: "Depositar" })).toHaveAttribute("href", "/depositar");
  });
});
