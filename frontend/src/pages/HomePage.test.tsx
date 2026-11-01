import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "./HomePage";
import { Currency } from "../types/api";
import { makeGroup, makeWallet, storeSession } from "../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders } from "../test/utils";

const QUOTE = {
  priceBrl: 500000,
  quotedAt: "2026-11-01T17:32:00Z",
  source: "coingecko",
  isStale: false,
};

const GROUPS = [makeGroup({ groupId: 1, name: "Silva" }), makeGroup({ groupId: 2, name: "Praia" })];

const WALLETS = [
  makeWallet({ walletId: 1, name: "Nubank", balance: 1000, groupId: null }),
  makeWallet({ walletId: 2, name: "Conta conjunta", balance: 500, groupId: 1 }),
  makeWallet({
    walletId: 3,
    name: "Reserva BTC",
    currency: Currency.BTC,
    balance: 0.01,
    estimatedBrl: 5000,
    groupId: null,
  }),
  makeWallet({
    walletId: 4,
    name: "Mesada do Pedro",
    balance: 100,
    groupId: 1,
    ownerUserId: 99,
    ownerName: "Pedro Silva",
  }),
  makeWallet({ walletId: 5, name: "Casa de praia", balance: 0, groupId: 2 }),
];

const renderHome = () => renderWithProviders(<HomePage />);

describe("HomePage", () => {
  it("mostra o total (só carteiras próprias, BTC estimado) e as seções em ordem", async () => {
    storeSession();
    mockFetch({
      "GET /api/wallets": { body: WALLETS },
      "GET /api/groups": { body: GROUPS },
      "GET /api/quotes/btc": { body: QUOTE },
    });

    const { container } = renderHome();

    // R$ 1.000 + R$ 500 + R$ 5.000 (0,01 BTC) + R$ 0; a Mesada do Pedro (outro titular) fica fora
    expect(await screen.findByText("6.500,00")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Olá, Ana" })).toBeInTheDocument();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Praia", "Silva", "Avulsas"]);

    const silva = screen.getByRole("region", { name: "Silva" });
    expect(within(silva).getByRole("link", { name: /Mesada do Pedro.*de Pedro Silva/ })).toHaveAttribute(
      "href",
      "/carteiras/4",
    );
    expect(screen.getByRole("link", { name: "Silva" })).toHaveAttribute("href", "/familias/1");
    expect(screen.queryByText("Cotação do bitcoin indisponível")).not.toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("avisa quando a cotação devolve 503 e tira o BTC do total", async () => {
    storeSession();
    mockFetch({
      "GET /api/wallets": { body: WALLETS },
      "GET /api/groups": { body: GROUPS },
      "GET /api/quotes/btc": apiError(503, "Cotação indisponível."),
    });

    renderHome();

    expect(await screen.findByText("Cotação do bitcoin indisponível")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Suas carteiras em bitcoin não entraram no total.");
    expect(screen.getByText("1.500,00")).toBeInTheDocument();
    expect(screen.getByText("sem cotação")).toBeInTheDocument();
  });

  it("mostra o estado vazio com convite para criar carteira", async () => {
    storeSession();
    mockFetch({
      "GET /api/wallets": { body: [] },
      "GET /api/groups": { body: [] },
      "GET /api/quotes/btc": { body: QUOTE },
    });

    const { container } = renderHome();

    expect(await screen.findByText("Você ainda não tem carteiras")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar carteira" })).toHaveAttribute("href", "/carteiras");
    expect(screen.getByText("0,00")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("mostra 'Não foi possível conectar' só quando a rede falha", async () => {
    storeSession();
    mockFetch({
      "GET /api/wallets": () => {
        throw new TypeError("Failed to fetch");
      },
      "GET /api/groups": { body: GROUPS },
      "GET /api/quotes/btc": { body: QUOTE },
    });

    renderHome();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
  });

  it("mostra erro com 'Tentar novamente' quando a API falha e recarrega ao tocar", async () => {
    storeSession();
    let fail = true;
    mockFetch({
      "GET /api/wallets": () => (fail ? { status: 500, text: "boom" } : { body: WALLETS }),
      "GET /api/groups": { body: GROUPS },
      "GET /api/quotes/btc": { body: QUOTE },
    });

    renderHome();

    const retry = await screen.findByRole("button", { name: "Tentar novamente" });
    // 500 é erro do servidor, não falta de conexão (REVIEW G-6)
    expect(screen.getByRole("alert")).toHaveTextContent("Algo deu errado");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Não foi possível conectar");

    fail = false;
    await userEvent.setup().click(retry);

    await waitFor(() => expect(screen.getByText("6.500,00")).toBeInTheDocument());
  });
});
