import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { NotificationBell } from "./NotificationBell";
import { NotificationBellVariant } from "../ui/variants";
import { storeSession } from "../../test/fixtures";
import { axe, mockFetch, renderWithProviders } from "../../test/utils";

const renderBell = (count?: number, path = "/") => {
  storeSession();
  mockFetch({ "GET /api/notifications/unread-count": { body: { unread: 0 } } });
  return renderWithProviders(<NotificationBell variant={NotificationBellVariant.Header} count={count} />, {
    path,
    initialEntries: [path],
  });
};

describe("NotificationBell", () => {
  it("sem não lidas: sino sem número", async () => {
    const { container } = renderBell(0);

    const link = screen.getByRole("link", { name: "Notificações" });
    expect(link).toHaveAttribute("href", "/notificacoes");
    expect(link.textContent).toBe("");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("1 não lida: selo com 1 e rótulo no singular", () => {
    renderBell(1);

    expect(screen.getByRole("link", { name: "Notificações, 1 não lida" })).toHaveTextContent("1");
  });

  it("3 não lidas: selo com 3", () => {
    renderBell(3);

    const link = screen.getByRole("link", { name: "Notificações, 3 não lidas" });
    expect(link).toHaveTextContent("3");
    expect(screen.getByText("3")).toHaveAttribute("aria-hidden", "true");
  });

  it("acima de 9: selo \"9+\" e número real no aria-label", () => {
    renderBell(12);

    expect(screen.getByRole("link", { name: "Notificações, 12 não lidas" })).toHaveTextContent("9+");
  });

  it("usa o contador do NotificationContext", async () => {
    storeSession();
    mockFetch({ "GET /api/notifications/unread-count": { body: { unread: 2 } } });
    renderWithProviders(<NotificationBell variant={NotificationBellVariant.Header} />);

    expect(await screen.findByRole("link", { name: "Notificações, 2 não lidas" })).toHaveTextContent("2");
  });

  it("na rota /notificacoes o sino da sidebar fica ativo", async () => {
    storeSession();
    mockFetch({ "GET /api/notifications/unread-count": { body: { unread: 0 } } });
    renderWithProviders(<NotificationBell variant={NotificationBellVariant.Sidebar} />, {
      path: "/notificacoes",
    });

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Notificações" })).toHaveAttribute("aria-current", "page"),
    );
  });
});
