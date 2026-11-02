import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ConnectivityProvider, OFFLINE_BANNER_DELAY_MS } from "./ConnectivityContext";
import { useConnectivity } from "../hooks/useConnectivity";
import { reportFreshness, reportOffline, reportOnline } from "../utils/connectivity";
import { notifyInfo } from "../utils/notify";

vi.mock("../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/notify")>();
  return { ...actual, notifyInfo: vi.fn() };
});

const Probe = ({ onReconnected }: { onReconnected?: () => void }) => {
  const connectivity = useConnectivity();
  const { onReconnected: subscribeReconnected } = connectivity;
  useEffect(() => (onReconnected ? subscribeReconnected(onReconnected) : undefined), [
    onReconnected,
    subscribeReconnected,
  ]);
  return (
    <div>
      <p data-testid="status">{connectivity.status}</p>
      <p data-testid="banner">{connectivity.showBanner ? "visível" : "oculto"}</p>
      <p data-testid="stale">{connectivity.staleSince ?? ""}</p>
    </div>
  );
};

const renderProbe = (onReconnected?: () => void) =>
  render(
    <ConnectivityProvider>
      <Probe onReconnected={onReconnected} />
    </ConnectivityProvider>,
  );

const banner = () => screen.getByTestId("banner");

describe("ConnectivityContext", () => {
  beforeEach(() => {
    vi.mocked(notifyInfo).mockClear();
  });

  describe("com timers falsos", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it(`mostra o indicador só depois de ${OFFLINE_BANNER_DELAY_MS / 1000} s offline`, () => {
      renderProbe();
      act(() => reportOffline());

      expect(screen.getByTestId("status")).toHaveTextContent("offline");
      act(() => vi.advanceTimersByTime(OFFLINE_BANNER_DELAY_MS - 1));
      expect(banner()).toHaveTextContent("oculto");

      act(() => vi.advanceTimersByTime(1));
      expect(banner()).toHaveTextContent("visível");
    });

    it("oscilação menor que 2 s não mostra o indicador nem o toast", () => {
      renderProbe();

      act(() => reportOffline());
      act(() => vi.advanceTimersByTime(1000));
      act(() => reportOnline());
      act(() => vi.advanceTimersByTime(OFFLINE_BANNER_DELAY_MS * 2));

      expect(banner()).toHaveTextContent("oculto");
      expect(notifyInfo).not.toHaveBeenCalled();
    });

    it("ao voltar online esconde o indicador, dispara reconnected e anuncia a reconexão", () => {
      const onReconnected = vi.fn();
      renderProbe(onReconnected);

      act(() => reportOffline());
      act(() => vi.advanceTimersByTime(OFFLINE_BANNER_DELAY_MS));
      expect(banner()).toHaveTextContent("visível");

      act(() => reportOnline());

      expect(banner()).toHaveTextContent("oculto");
      expect(onReconnected).toHaveBeenCalledTimes(1);
      expect(notifyInfo).toHaveBeenCalledWith("Conexão restabelecida.");
    });
  });

  it("expõe a data do dado guardado mais antigo (staleSince)", () => {
    renderProbe();

    act(() => reportFreshness({ stale: true, fetchedAt: "2026-11-01T18:42:00.000Z" }));

    expect(screen.getByTestId("stale")).toHaveTextContent("2026-11-01T18:42:00.000Z");
  });

  it("o evento online do navegador faz um ping em /api/auth/me antes de declarar online", async () => {
    let respond: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderProbe();
    act(() => reportOffline());

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/auth\/me$/);
    expect(init.method).toBe("GET");
    expect(screen.getByTestId("status")).toHaveTextContent("offline");

    await act(async () => {
      respond(new Response(JSON.stringify({}), { status: 200 }));
    });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("online"));
  });
});
