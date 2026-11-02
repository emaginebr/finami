import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { INSTALL_DISMISSED_STORAGE_KEY, INSTALL_DISMISS_DAYS, InstallProvider } from "./InstallContext";
import { useInstall } from "../hooks/useInstall";
import { notifySuccess } from "../utils/notify";
import {
  IPAD_DESKTOP_UA,
  IPHONE_UA,
  MAC_UA,
  makeInstallPromptEvent,
  resetNavigatorOverrides,
  setNavigatorProp,
  stubStandalone,
} from "../test/install";

vi.mock("../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/notify")>();
  return { ...actual, notifySuccess: vi.fn() };
});

const DAY_MS = 24 * 60 * 60 * 1000;

const Probe = () => {
  const install = useInstall();
  return (
    <div>
      <p data-testid="native">{String(install.canPromptNative)}</p>
      <p data-testid="installed">{String(install.isInstalled)}</p>
      <p data-testid="ios">{String(install.isIos)}</p>
      <p data-testid="invite">{String(install.showInvite)}</p>
      <p data-testid="canInstall">{String(install.canInstall)}</p>
      <p data-testid="ipad">{String(install.isIpad)}</p>
      <button type="button" onClick={() => void install.promptInstall()}>
        instalar
      </button>
      <button type="button" onClick={install.dismissInvite}>
        dispensar
      </button>
    </div>
  );
};

const renderProbe = () =>
  render(
    <InstallProvider>
      <Probe />
    </InstallProvider>,
  );

const value = (testId: string) => screen.getByTestId(testId).textContent;

describe("InstallContext", () => {
  beforeEach(() => {
    vi.mocked(notifySuccess).mockClear();
  });

  afterEach(() => {
    resetNavigatorOverrides();
  });

  it("captura beforeinstallprompt (com preventDefault) e habilita o diálogo nativo", () => {
    renderProbe();
    expect(value("native")).toBe("false");
    const event = makeInstallPromptEvent("accepted");

    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(value("native")).toBe("true");
    expect(value("invite")).toBe("true");
  });

  it("promptInstall chama prompt() e, aceito, mostra 'Finami instalado.'", async () => {
    renderProbe();
    const event = makeInstallPromptEvent("accepted");
    act(() => {
      window.dispatchEvent(event);
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "instalar" }));

    expect(event.prompt).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Finami instalado."));
    expect(value("native")).toBe("false");
    expect(value("installed")).toBe("true");
  });

  it("recusado no diálogo nativo não mostra o toast", async () => {
    renderProbe();
    const event = makeInstallPromptEvent("dismissed");
    act(() => {
      window.dispatchEvent(event);
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "instalar" }));

    await waitFor(() => expect(event.prompt).toHaveBeenCalled());
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(value("installed")).toBe("false");
    // REVIEW-005 A-1: o evento sai, mas o item da Conta continua (o convite não)
    await waitFor(() => expect(value("native")).toBe("false"));
    expect(value("canInstall")).toBe("true");
    expect(value("invite")).toBe("false");
  });

  it("durante o diálogo nativo as entradas de instalação continuam disponíveis (A-1)", async () => {
    renderProbe();
    let choose: (outcome: "accepted" | "dismissed") => void = () => undefined;
    const event = Object.assign(makeInstallPromptEvent("dismissed"), {
      userChoice: new Promise<{ outcome: "accepted" | "dismissed"; platform: string }>((resolve) => {
        choose = (outcome) => resolve({ outcome, platform: "web" });
      }),
    });
    act(() => {
      window.dispatchEvent(event);
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "instalar" }));

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(value("native")).toBe("true");
    expect(value("canInstall")).toBe("true");
    expect(value("invite")).toBe("true");

    await act(async () => {
      choose("dismissed");
    });
    expect(value("canInstall")).toBe("true");
  });

  it("appinstalled marca como instalado e esconde o convite", () => {
    renderProbe();
    act(() => {
      window.dispatchEvent(makeInstallPromptEvent("accepted"));
    });

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(value("installed")).toBe("true");
    expect(value("native")).toBe("false");
    expect(value("invite")).toBe("false");
  });

  it("display-mode: standalone conta como instalado", () => {
    stubStandalone(true);

    renderProbe();

    expect(value("installed")).toBe("true");
  });

  it.each([
    ["iPhone", IPHONE_UA, 5, "true", "false"],
    ["iPad com user agent de desktop", IPAD_DESKTOP_UA, 5, "true", "true"],
    ["Mac sem toque", MAC_UA, 0, "false", "false"],
  ])("detecta iOS/iPadOS: %s", (_name, userAgent, maxTouchPoints, expectedIos, expectedIpad) => {
    setNavigatorProp("userAgent", String(userAgent));
    setNavigatorProp("maxTouchPoints", Number(maxTouchPoints));

    renderProbe();

    expect(value("ios")).toBe(String(expectedIos));
    expect(value("ipad")).toBe(String(expectedIpad));
  });

  it(`dispensar grava ${INSTALL_DISMISSED_STORAGE_KEY} e oculta o convite por ${INSTALL_DISMISS_DAYS} dias`, async () => {
    setNavigatorProp("userAgent", IPHONE_UA);
    setNavigatorProp("maxTouchPoints", 5);
    renderProbe();
    expect(value("invite")).toBe("true");

    await userEvent.setup().click(screen.getByRole("button", { name: "dispensar" }));

    expect(value("invite")).toBe("false");
    const stored = localStorage.getItem(INSTALL_DISMISSED_STORAGE_KEY);
    expect(Number.isNaN(Date.parse(stored ?? ""))).toBe(false);
  });

  it.each([
    [10, "false"],
    [INSTALL_DISMISS_DAYS + 1, "true"],
  ])("convite dispensado há %i dias → visível: %s", (daysAgo, expected) => {
    setNavigatorProp("userAgent", IPHONE_UA);
    setNavigatorProp("maxTouchPoints", 5);
    localStorage.setItem(INSTALL_DISMISSED_STORAGE_KEY, new Date(Date.now() - Number(daysAgo) * DAY_MS).toISOString());

    renderProbe();

    expect(value("invite")).toBe(expected);
  });
});
