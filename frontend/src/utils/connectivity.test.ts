import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOldestStaleFetchedAt,
  getStatus,
  reportFreshness,
  reportOffline,
  reportOnline,
  resetConnectivity,
  resetFreshness,
  subscribe,
} from "./connectivity";
import { ConnectivityStatus } from "../types/connectivity";

describe("connectivity (store fora do React)", () => {
  afterEach(() => resetConnectivity());

  it("começa online (navigator.onLine no jsdom) e muda com reportOffline/reportOnline", () => {
    expect(getStatus()).toBe(ConnectivityStatus.Online);

    reportOffline();
    expect(getStatus()).toBe(ConnectivityStatus.Offline);

    reportOnline();
    expect(getStatus()).toBe(ConnectivityStatus.Online);
  });

  it("avisa os assinantes só quando o estado muda e permite cancelar", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    reportOnline();
    expect(listener).not.toHaveBeenCalled();

    reportOffline();
    reportOffline();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    reportOnline();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("o evento offline do navegador marca offline", () => {
    window.dispatchEvent(new Event("offline"));
    expect(getStatus()).toBe(ConnectivityStatus.Offline);
  });

  it("reportFreshness guarda o fetchedAt stale mais antigo; dados novos não contam", () => {
    const listener = vi.fn();
    subscribe(listener);

    reportFreshness({ stale: false, fetchedAt: "2026-11-01T10:00:00.000Z" });
    expect(getOldestStaleFetchedAt()).toBeNull();

    reportFreshness({ stale: true, fetchedAt: "2026-11-01T18:42:00.000Z" });
    reportFreshness({ stale: true, fetchedAt: "2026-11-01T17:00:00.000Z" });
    reportFreshness({ stale: true, fetchedAt: "2026-11-01T19:00:00.000Z" });

    expect(getOldestStaleFetchedAt()).toBe("2026-11-01T17:00:00.000Z");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("resetFreshness limpa a data (troca de tela)", () => {
    reportFreshness({ stale: true, fetchedAt: "2026-11-01T18:42:00.000Z" });

    resetFreshness();

    expect(getOldestStaleFetchedAt()).toBeNull();
  });
});
