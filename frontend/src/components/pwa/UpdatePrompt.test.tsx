import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdatePrompt } from "./UpdatePrompt";
import { AppUpdateProvider } from "../../Contexts/AppUpdateContext";
import { AppShell } from "../layout/AppShell";
import { AuthLayout } from "../layout/AuthLayout";
import { UPDATE_CHECK_INTERVAL_MS } from "../../hooks/useAppUpdate";
import { lastRegisterOptions, setPwaRegisterState, updateServiceWorkerMock } from "../../test/pwaRegisterMock";
import { storeSession } from "../../test/fixtures";
import { axe, mockFetch, renderWithProviders } from "../../test/utils";
import { notifyErrorMessage } from "../../utils/notify";

vi.mock("../../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/notify")>();
  return { ...actual, notifyErrorMessage: vi.fn() };
});

const renderPrompt = () =>
  render(
    <AppUpdateProvider>
      <main>
        <button type="button">conteúdo</button>
      </main>
      <UpdatePrompt />
    </AppUpdateProvider>,
  );

const fakeRegistration = () => {
  const update = vi.fn(async (): Promise<void> => undefined);
  const registration = { update, installing: null } as unknown as ServiceWorkerRegistration;
  return { registration, update };
};

describe("UpdatePrompt", () => {
  beforeEach(() => {
    vi.mocked(notifyErrorMessage).mockClear();
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("sem versão nova não mostra nada (a região viva fica vazia)", () => {
    renderPrompt();

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByText("Nova versão disponível")).not.toBeInTheDocument();
  });

  it("fora do AppUpdateProvider não renderiza nada", () => {
    setPwaRegisterState({ needRefresh: true });
    render(<UpdatePrompt />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("com versão nova mostra o aviso sem roubar o foco; axe sem violações", async () => {
    setPwaRegisterState({ needRefresh: true });
    const { container } = renderPrompt();

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Nova versão disponível");
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agora não" })).toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("'Atualizar' mantém o cartão, tira 'Agora não' e mostra 'Atualizando…' no botão (B-3)", async () => {
    updateServiceWorkerMock.mockImplementationOnce(() => new Promise<void>(() => undefined));
    setPwaRegisterState({ needRefresh: true });
    renderPrompt();

    await userEvent.setup().click(screen.getByRole("button", { name: "Atualizar" }));

    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Nova versão disponível");
    expect(region).toHaveTextContent("Atualizando…");
    expect(region.querySelector("[aria-busy='true']")?.tagName).toBe("BUTTON");
    expect(screen.queryByRole("button", { name: "Agora não" })).not.toBeInTheDocument();
  });

  it("se a atualização falhar, os botões voltam e há um aviso de erro (B-3)", async () => {
    updateServiceWorkerMock.mockImplementationOnce(() => Promise.reject(new Error("falhou")));
    setPwaRegisterState({ needRefresh: true });
    renderPrompt();

    await userEvent.setup().click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() =>
      expect(notifyErrorMessage).toHaveBeenCalledWith("Não foi possível atualizar. Tente de novo."),
    );
    expect(screen.getByRole("button", { name: "Agora não" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar" })).not.toHaveAttribute("aria-busy");
  });

  it("'Agora não' esconde o aviso", async () => {
    setPwaRegisterState({ needRefresh: true });
    renderPrompt();

    await userEvent.setup().click(screen.getByRole("button", { name: "Agora não" }));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(updateServiceWorkerMock).not.toHaveBeenCalled();
  });

  it("depois de registrado, procura versão nova a cada 60 min e ao voltar para a aba", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    const { registration, update } = fakeRegistration();
    const view = renderPrompt();

    act(() => {
      lastRegisterOptions()?.onRegisteredSW?.("/sw.js", registration);
    });

    act(() => vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS - 1));
    expect(update).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(update).toHaveBeenCalledTimes(1);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(update).toHaveBeenCalledTimes(2);

    view.unmount();
    act(() => vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS * 2));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(update).toHaveBeenCalledTimes(2);
  });

  describe("posição nas cascas (M-6)", () => {
    it("no AppShell fica depois do conteúdo e antes da TabBar na ordem de foco", async () => {
      storeSession();
      mockFetch({ "GET /api/notifications/unread-count": { body: { unread: 0 } } });
      setPwaRegisterState({ needRefresh: true });

      renderWithProviders(
        <AppUpdateProvider>
          <AppShell />
        </AppUpdateProvider>,
        { wrapInMain: false },
      );

      const update = await screen.findByRole("button", { name: "Atualizar" });
      const main = screen.getByRole("main");
      const navigations = screen.getAllByRole("navigation");
      const tabBar = navigations[navigations.length - 1]!;
      expect(main.compareDocumentPosition(update) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(update.compareDocumentPosition(tabBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("nas telas sem abas (AuthLayout) aparece depois do conteúdo", () => {
      setPwaRegisterState({ needRefresh: true });

      render(
        <AppUpdateProvider>
          <AuthLayout>
            <button type="button">Entrar</button>
          </AuthLayout>
        </AppUpdateProvider>,
      );

      const enter = screen.getByRole("button", { name: "Entrar" });
      const update = screen.getByRole("button", { name: "Atualizar" });
      expect(enter.compareDocumentPosition(update) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
