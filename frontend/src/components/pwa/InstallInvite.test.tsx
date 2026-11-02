import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallInvite } from "./InstallInvite";
import { INSTALL_DISMISSED_STORAGE_KEY, INSTALL_DISMISS_DAYS, InstallProvider } from "../../Contexts/InstallContext";
import { IPHONE_UA, makeInstallPromptEvent, resetNavigatorOverrides, setNavigatorProp } from "../../test/install";
import { axe } from "../../test/utils";
import type { InstallChoiceOutcome } from "../../types/install";

const DAY_MS = 24 * 60 * 60 * 1000;
const INVITE_NAME = "Instalar o Finami";

/** Home simplificada: o convite e, depois dele, o primeiro cabeçalho de seção (link) */
const renderInvite = () =>
  render(
    <main>
      <InstallProvider>
        <InstallInvite />
        <a href="/familias/1">Silva</a>
      </InstallProvider>
    </main>,
  );

const offerNativePrompt = (outcome: InstallChoiceOutcome = "accepted") => {
  const event = makeInstallPromptEvent(outcome);
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

describe("InstallInvite", () => {
  afterEach(() => resetNavigatorOverrides());

  it("aparece uma vez quando instalável: h2, descrição, 'Instalar' secundário; axe sem violações", async () => {
    const { container } = renderInvite();
    expect(screen.queryByRole("region", { name: INVITE_NAME })).not.toBeInTheDocument();

    const event = offerNativePrompt();

    const regions = screen.getAllByRole("region", { name: INVITE_NAME });
    expect(regions).toHaveLength(1);
    expect(regions[0]).toHaveAccessibleDescription("Use o Finami como um app, direto da tela inicial.");
    expect(screen.getByRole("heading", { level: 2, name: INVITE_NAME })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.setup().click(screen.getByRole("button", { name: "Instalar" }));
    await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1));
  });

  it("aceito no diálogo nativo: o convite sai e o foco vai para o próximo elemento (A-1)", async () => {
    renderInvite();
    offerNativePrompt("accepted");

    await userEvent.setup().click(screen.getByRole("button", { name: "Instalar" }));

    await waitFor(() => expect(screen.queryByRole("region", { name: INVITE_NAME })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("link", { name: "Silva" })).toHaveFocus());
  });

  it("recusado no diálogo nativo conta como dispensa e o foco não cai no body (A-1)", async () => {
    renderInvite();
    offerNativePrompt("dismissed");

    await userEvent.setup().click(screen.getByRole("button", { name: "Instalar" }));

    await waitFor(() => expect(screen.queryByRole("region", { name: INVITE_NAME })).not.toBeInTheDocument());
    expect(localStorage.getItem(INSTALL_DISMISSED_STORAGE_KEY)).not.toBeNull();
    await waitFor(() => expect(screen.getByRole("link", { name: "Silva" })).toHaveFocus());
  });

  it("no iOS, 'Instalar' abre a folha com o passo a passo", async () => {
    setNavigatorProp("userAgent", IPHONE_UA);
    setNavigatorProp("maxTouchPoints", 5);
    renderInvite();

    await userEvent.setup().click(screen.getByRole("button", { name: "Instalar" }));

    expect(await screen.findByRole("dialog", { name: "Instalar no iPhone" })).toBeInTheDocument();
  });

  it("fechar grava a data, esconde o convite e leva o foco ao próximo elemento (M-1)", async () => {
    renderInvite();
    offerNativePrompt();

    await userEvent.setup().click(screen.getByRole("button", { name: "Dispensar convite de instalação" }));

    expect(screen.queryByRole("region", { name: INVITE_NAME })).not.toBeInTheDocument();
    expect(localStorage.getItem(INSTALL_DISMISSED_STORAGE_KEY)).not.toBeNull();
    await waitFor(() => expect(screen.getByRole("link", { name: "Silva" })).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
  });

  it("dispensado há menos de 30 dias não aparece", () => {
    localStorage.setItem(INSTALL_DISMISSED_STORAGE_KEY, new Date(Date.now() - 5 * DAY_MS).toISOString());
    renderInvite();
    offerNativePrompt();

    expect(screen.queryByRole("region", { name: INVITE_NAME })).not.toBeInTheDocument();
  });

  it("dispensado há mais de 30 dias aparece de novo", () => {
    localStorage.setItem(
      INSTALL_DISMISSED_STORAGE_KEY,
      new Date(Date.now() - (INSTALL_DISMISS_DAYS + 1) * DAY_MS).toISOString(),
    );
    renderInvite();
    offerNativePrompt();

    expect(screen.getByRole("region", { name: INVITE_NAME })).toBeInTheDocument();
  });
});
