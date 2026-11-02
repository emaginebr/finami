import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import "../i18n";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { resetConnectivity } from "../utils/connectivity";
import { offlineCache } from "../utils/offlineCache";
import { resetNavigatorOverrides } from "./install";
import { resetPwaRegisterMock } from "./pwaRegisterMock";

expect.extend(axeMatchers);

// findBy*/waitFor: 3 s em vez de 1 s — a suíte roda em paralelo e telas com axe ficam lentas sob carga
configure({ asyncUtilTimeout: 3000 });

afterEach(async () => {
  cleanup();
  localStorage.clear();
  // Remove `fetch` simulado com vi.stubGlobal e espiões criados com vi.spyOn
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  // Feature 005: conectividade, registro do SW e cache offline não vazam entre testes
  resetConnectivity();
  resetPwaRegisterMock();
  resetNavigatorOverrides();
  await offlineCache.clearAll();
});
