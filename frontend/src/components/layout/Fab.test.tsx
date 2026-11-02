import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Fab } from "./Fab";
import { reportOffline } from "../../utils/connectivity";
import { notifyWarning } from "../../utils/notify";
import { axe, renderWithProviders } from "../../test/utils";

vi.mock("../../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/notify")>();
  return { ...actual, notifyWarning: vi.fn() };
});

const renderFab = (walletId: number | null = null) =>
  renderWithProviders(<Fab walletId={walletId} />, {
    path: "/carteiras/:walletId",
    initialEntries: ["/carteiras/12"],
    extraRoutes: [
      { path: "/depositar", element: <p>Página Depositar</p> },
      { path: "/sacar", element: <p>Página Sacar</p> },
      { path: "/transferir", element: <p>Página Transferir</p> },
    ],
  });

describe("Fab", () => {
  beforeEach(() => {
    vi.mocked(notifyWarning).mockClear();
  });

  it("abre o menu com Depositar, Sacar e Transferir; Esc fecha e devolve o foco", async () => {
    const { container } = renderFab(12);
    const user = userEvent.setup();

    const fab = screen.getByRole("button", { name: "Novo lançamento" });
    expect(fab).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Depositar" })).not.toBeInTheDocument();

    await user.click(fab);
    expect(fab).toHaveAttribute("aria-expanded", "true");
    const deposit = screen.getByRole("link", { name: "Depositar" });
    expect(deposit).toHaveFocus();
    // A carteira do extrato vai pré-selecionada
    expect(deposit).toHaveAttribute("href", "/depositar?carteira=12");
    expect(screen.getByRole("link", { name: "Sacar" })).toHaveAttribute("href", "/sacar?carteira=12");
    expect(screen.getByRole("link", { name: "Transferir" })).toHaveAttribute("href", "/transferir?carteira=12");
    expect(await axe(container)).toHaveNoViolations();

    await user.keyboard("{Escape}");
    expect(fab).toHaveAttribute("aria-expanded", "false");
    expect(fab).toHaveFocus();
  });

  it("escolher um item abre a página do lançamento", async () => {
    const { router } = renderFab();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    await user.click(screen.getByRole("link", { name: "Sacar" }));

    expect(await screen.findByText("Página Sacar")).toBeInTheDocument();
    expect(router.state.location.state).toMatchObject({ backTo: "/carteiras/12" });
  });

  it("offline fica aria-disabled, continua focável e o toque só avisa", async () => {
    const { container } = renderFab();
    act(() => reportOffline());
    const user = userEvent.setup();

    const fab = screen.getByRole("button", { name: "Novo lançamento" });
    expect(fab).toHaveAttribute("aria-disabled", "true");
    expect(fab).not.toBeDisabled();
    await user.tab();
    expect(fab).toHaveFocus();

    await user.click(fab);
    await user.keyboard("{Enter}");

    expect(fab).toHaveAttribute("aria-expanded", "false");
    expect(notifyWarning).toHaveBeenCalledWith("Sem internet. Conecte-se para fazer lançamentos.");
    expect(await axe(container)).toHaveNoViolations();
  });
});
