import "@testing-library/jest-dom/vitest";
import "../i18n";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";

expect.extend(axeMatchers);

afterEach(() => {
  cleanup();
  localStorage.clear();
  // Remove `fetch` simulado com vi.stubGlobal e espiões criados com vi.spyOn
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
