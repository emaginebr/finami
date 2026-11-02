import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OfflinePage from "./OfflinePage";
import { ConnectivityProvider } from "../Contexts/ConnectivityContext";
import { reportOffline } from "../utils/connectivity";
import { axe } from "../test/utils";

describe("OfflinePage", () => {
  it("mostra 'Sem internet' com o foco no título e 'Tentar de novo' chama onRetry", async () => {
    const onRetry = vi.fn();
    const { container } = render(<OfflinePage onRetry={onRetry} />);

    const heading = screen.getByRole("heading", { level: 1, name: "Sem internet" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(
      screen.getByText("Conecte-se para usar o Finami pela primeira vez neste aparelho."),
    ).toBeInTheDocument();
    expect(document.title).toBe("Sem internet — Finami");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("'Tentar de novo' confere a conexão; ainda offline, fica na tela e devolve o foco ao título (B-4)", async () => {
    reportOffline();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ConnectivityProvider>
        <OfflinePage />
      </ConnectivityProvider>,
    );
    const user = userEvent.setup();
    const heading = await screen.findByRole("heading", { level: 1, name: "Sem internet" });
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/api\/auth\/me$/);
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("button", { name: "Tentar de novo" })).not.toHaveAttribute("aria-busy");
  });
});
