import { vi } from "vitest";
import type { Mock } from "vitest";
import type { BeforeInstallPromptEvent, InstallChoiceOutcome } from "../types/install";

/** Utilitários de teste da instalação (feature 005, US1) */

export const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
export const IPAD_DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
export const MAC_UA = IPAD_DESKTOP_UA;
export const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

const overridden = new Set<string>();

/** Sobrescreve uma propriedade de `navigator` até `resetNavigatorOverrides()` */
export const setNavigatorProp = (name: string, value: unknown): void => {
  Object.defineProperty(navigator, name, { value, configurable: true });
  overridden.add(name);
};

/** Desfaz `setNavigatorProp` (volta aos getters do jsdom) */
export const resetNavigatorOverrides = (): void => {
  overridden.forEach((name) => Reflect.deleteProperty(navigator, name));
  overridden.clear();
};

/** Simula `matchMedia("(display-mode: standalone)")` */
export const stubStandalone = (matches: boolean): void => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: matches && query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  );
};

/** Evento `beforeinstallprompt` com `prompt()` simulado e a escolha já definida */
export const makeInstallPromptEvent = (
  outcome: InstallChoiceOutcome,
): BeforeInstallPromptEvent & { prompt: Mock<() => Promise<void>> } => {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  return Object.assign(event, {
    platforms: ["web"],
    userChoice: Promise.resolve({ outcome, platform: "web" }),
    prompt: vi.fn(async (): Promise<void> => undefined),
  });
};
