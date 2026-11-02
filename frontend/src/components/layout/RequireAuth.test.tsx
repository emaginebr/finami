import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { RequireAuth } from "./RequireAuth";
import { reportOffline } from "../../utils/connectivity";
import { storeSession } from "../../test/fixtures";
import { renderWithProviders } from "../../test/utils";

const renderProtected = () =>
  renderWithProviders(
    <RequireAuth>
      <p>conteúdo protegido</p>
    </RequireAuth>,
    { wrapInMain: false, extraRoutes: [{ path: "/entrar", element: <p>tela de entrada</p> }] },
  );

describe("RequireAuth (feature 005)", () => {
  it("sem sessão e sem internet mostra a OfflinePage em vez do login", async () => {
    reportOffline();

    renderProtected();

    expect(await screen.findByRole("heading", { level: 1, name: "Sem internet" })).toBeInTheDocument();
    expect(screen.queryByText("tela de entrada")).not.toBeInTheDocument();
  });

  it("sem sessão e online vai para o login", async () => {
    renderProtected();

    expect(await screen.findByText("tela de entrada")).toBeInTheDocument();
  });

  it("com sessão guardada mostra o conteúdo mesmo offline", async () => {
    storeSession();
    reportOffline();

    renderProtected();

    expect(await screen.findByText("conteúdo protegido")).toBeInTheDocument();
  });
});
