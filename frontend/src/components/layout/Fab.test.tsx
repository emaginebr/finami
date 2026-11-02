import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Fab } from "./Fab";
import { ConnectivityProvider } from "../../Contexts/ConnectivityContext";
import { reportOffline } from "../../utils/connectivity";
import { notifyWarning } from "../../utils/notify";
import { axe } from "../../test/utils";

vi.mock("../../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/notify")>();
  return { ...actual, notifyWarning: vi.fn() };
});

const renderFab = (onClick = vi.fn()) => {
  const view = render(
    <ConnectivityProvider>
      <main>
        <Fab onClick={onClick} />
      </main>
    </ConnectivityProvider>,
  );
  return { onClick, ...view };
};

describe("Fab", () => {
  beforeEach(() => {
    vi.mocked(notifyWarning).mockClear();
  });

  it("online abre a folha de lançamento", async () => {
    const { onClick } = renderFab();

    const fab = screen.getByRole("button", { name: "Novo lançamento" });
    expect(fab).not.toHaveAttribute("aria-disabled");
    await userEvent.setup().click(fab);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it("offline fica aria-disabled, continua focável e o toque só avisa", async () => {
    const { onClick, container } = renderFab();
    act(() => reportOffline());
    const user = userEvent.setup();

    const fab = screen.getByRole("button", { name: "Novo lançamento" });
    expect(fab).toHaveAttribute("aria-disabled", "true");
    expect(fab).not.toBeDisabled();
    await user.tab();
    expect(fab).toHaveFocus();

    await user.click(fab);
    await user.keyboard("{Enter}");

    expect(onClick).not.toHaveBeenCalled();
    expect(notifyWarning).toHaveBeenCalledWith("Sem internet. Conecte-se para fazer lançamentos.");
    expect(await axe(container)).toHaveNoViolations();
  });
});
