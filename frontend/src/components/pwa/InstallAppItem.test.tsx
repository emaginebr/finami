import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallAppItem } from "./InstallAppItem";
import { InstallProvider } from "../../Contexts/InstallContext";
import {
  ANDROID_UA,
  IPAD_DESKTOP_UA,
  IPHONE_UA,
  makeInstallPromptEvent,
  resetNavigatorOverrides,
  setNavigatorProp,
  stubStandalone,
} from "../../test/install";
import { axe } from "../../test/utils";
import type { InstallChoiceOutcome } from "../../types/install";
import { notifyMessage } from "../../utils/notify";

vi.mock("../../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/notify")>();
  return { ...actual, notifyMessage: vi.fn(), notifySuccess: vi.fn() };
});

/** Conta simplificada: a seção "App" e, depois dela, o botão "Sair" */
const renderItem = () =>
  render(
    <main>
      <InstallProvider>
        <InstallAppItem />
        <button type="button">Sair</button>
      </InstallProvider>
    </main>,
  );

const useIphone = () => {
  setNavigatorProp("userAgent", IPHONE_UA);
  setNavigatorProp("maxTouchPoints", 5);
};

const offerNativePrompt = (outcome: InstallChoiceOutcome) => {
  const event = makeInstallPromptEvent(outcome);
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

const installButton = () => screen.getByRole("button", { name: "Instalar o Finami" });

describe("InstallAppItem", () => {
  beforeEach(() => {
    vi.mocked(notifyMessage).mockClear();
  });

  afterEach(() => resetNavigatorOverrides());

  it("com o diálogo nativo disponível, tocar dispara promptInstall", async () => {
    const { container } = renderItem();
    const event = offerNativePrompt("dismissed");

    const section = screen.getByRole("region", { name: "App" });
    const button = within(section).getByRole("button", { name: "Instalar o Finami" });
    expect(button).toHaveAccessibleDescription("Use o Finami como um app, direto da tela inicial.");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.setup().click(button);

    await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1));
  });

  it("recusado no diálogo nativo: o item continua, com o foco nele, e orienta a usar o navegador (A-1)", async () => {
    renderItem();
    offerNativePrompt("dismissed");
    const user = userEvent.setup();

    await user.click(installButton());

    await waitFor(() => expect(installButton()).toHaveFocus());
    expect(screen.getByRole("region", { name: "App" })).toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);

    await user.click(installButton());

    expect(notifyMessage).toHaveBeenCalledWith(
      "Use o ícone de instalar na barra de endereço ou o menu do navegador.",
    );
  });

  it("aceito no diálogo nativo: o item sai e o foco vai para 'Sair' (A-1)", async () => {
    renderItem();
    offerNativePrompt("accepted");

    await userEvent.setup().click(installButton());

    await waitFor(() => expect(screen.queryByRole("region", { name: "App" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Sair" })).toHaveFocus());
  });

  it("no iOS abre a folha 'Instalar no iPhone' com 3 passos, dicas e 'Entendi'", async () => {
    useIphone();
    const { baseElement } = renderItem();
    const user = userEvent.setup();

    await user.click(installButton());

    const dialog = await screen.findByRole("dialog", { name: "Instalar no iPhone" });
    expect(dialog).toHaveAccessibleDescription("No Safari, são 3 toques para ter o Finami na tela de início.");
    const steps = within(dialog).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("Toque em Compartilhar.");
    expect(steps[0]).toHaveTextContent("no iOS 26, dentro do menu ⋯");
    expect(steps[1]).toHaveTextContent("Adicionar à Tela de Início");
    expect(steps[2]).toHaveTextContent("Toque em Adicionar, no canto superior direito.");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Entendi" })).toHaveFocus());
    expect(within(dialog).queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(within(dialog).getByRole("button", { name: "Entendi" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("no iPad o título é 'Instalar no iPad' (M-2)", async () => {
    setNavigatorProp("userAgent", IPAD_DESKTOP_UA);
    setNavigatorProp("maxTouchPoints", 5);
    renderItem();

    await userEvent.setup().click(installButton());

    expect(await screen.findByRole("dialog", { name: "Instalar no iPad" })).toBeInTheDocument();
  });

  it("já instalado não renderiza nada", () => {
    useIphone();
    stubStandalone(true);

    renderItem();

    expect(screen.queryByRole("button", { name: "Instalar o Finami" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "App" })).not.toBeInTheDocument();
  });

  it("navegador sem suporte e fora do iOS não renderiza nada", () => {
    setNavigatorProp("userAgent", ANDROID_UA);

    renderItem();

    expect(screen.queryByRole("button", { name: "Instalar o Finami" })).not.toBeInTheDocument();
  });
});
