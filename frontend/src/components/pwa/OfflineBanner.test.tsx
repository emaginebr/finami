import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { OfflineBanner } from "./OfflineBanner";
import { ConnectivityProvider, OFFLINE_BANNER_DELAY_MS } from "../../Contexts/ConnectivityContext";
import { reportFreshness, reportOffline, reportOnline } from "../../utils/connectivity";
import { axe } from "../../test/utils";

const renderBanner = () =>
  render(
    <ConnectivityProvider>
      <main>
        <OfflineBanner />
      </main>
    </ConnectivityProvider>,
  );

const goOffline = () => {
  act(() => reportOffline());
  act(() => vi.advanceTimersByTime(OFFLINE_BANNER_DELAY_MS));
};

describe("OfflineBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  });

  it("online: a região viva existe, mas fica vazia", () => {
    renderBanner();

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
  });

  it("antes de 2 s offline continua vazia", () => {
    renderBanner();

    act(() => reportOffline());
    act(() => vi.advanceTimersByTime(OFFLINE_BANNER_DELAY_MS - 1));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("offline sem data: só 'Sem internet'; não é focável; axe sem violações", async () => {
    const { container } = renderBanner();

    goOffline();

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent(/^Sem internet$/);
    expect(region).not.toHaveAttribute("tabindex");
    expect(region.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0);
    vi.useRealTimers();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("com dado guardado mostra 'Sem internet · dados de 01/11 às 18:42' (fuso de São Paulo)", () => {
    renderBanner();

    act(() => reportFreshness({ stale: true, fetchedAt: "2026-11-01T21:42:00.000Z" }));
    goOffline();

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent(/Sem internet\s*·.*dados de 01\/11 às 18:42/);
    expect(region.querySelector("time")).toHaveAttribute("dateTime", "2026-11-01T21:42:00.000Z");
  });

  it("some quando a conexão volta", () => {
    renderBanner();
    goOffline();

    act(() => reportOnline());

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
