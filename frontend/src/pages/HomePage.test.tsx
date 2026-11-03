import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "./HomePage";
import { Currency } from "../types/api";
import { USER_ID, makeGroup, makeWallet, storeSession } from "../test/fixtures";
import { offlineCache } from "../utils/offlineCache";
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
    ownerFirstName: "Pedro",
  }),
  makeWallet({ walletId: 5, name: "Casa de praia", balance: 0, groupId: 2 }),
];

const renderHome = () => renderWithProviders(<HomePage />);

describe("HomePage", () => {
  it("mostra só as carteiras próprias (total com BTC estimado) e as seções em ordem", async () => {
    storeSession();
    mockFetch({
      "GET /api/wallets": { body: WALLETS },
      "GET /api/groups": { body: GROUPS },
      "GET /api/quotes/btc": { body: QUOTE },
      [`GET /api/users/${USER_ID}/debts`]: {
        body: {
          userId: USER_ID,
          debts: [
            {
              counterpartUserId: 9,
              counterpartName: "Bruno Lima",
              counterpartFirstName: "Bruno",
              currency: "BRL",
              amount: 70,
              direction: "owed",
            },
          ],
        },
      },
    });

    const { container } = renderHome();

    // R$ 1.000 + R$ 500 + R$ 5.000 (0,01 BTC) + R$ 0; a Mesada do Pedro (outro titular) fica fora
    expect(await screen.findByText("6.500,00")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Olá, Ana" })).toBeInTheDocument();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Dívidas", "Praia", "Silva", "Avulsas"]);

    // Dívidas da pessoa logada, como na página dela (feature 006)
    const debts = screen.getByRole("region", { name: "Dívidas" });
    expect(
      await within(debts).findByRole("link", { name: /^Bruno deve a você, \+R\$\s70,00$/ }),
    ).toHaveAttribute("href", "/pessoas/9");

    const silva = screen.getByRole("region", { name: "Silva" });
    expect(within(silva).getByRole("link", { name: /Conta conjunta/ })).toHaveAttribute("href", "/carteiras/2");
    // Carteira de outro membro da família não aparece na Home
    expect(screen.queryByText("Mesada do Pedro")).not.toBeInTheDocument();
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

  it("rede fora sem dado guardado mostra 'conteúdo indisponível sem internet' (feature 005)", async () => {
    storeSession();
    mockFetch({
      "GET /api/wallets": () => {
        throw new TypeError("Failed to fetch");
      },
      "GET /api/groups": { body: GROUPS },
      "GET /api/quotes/btc": { body: QUOTE },
    });

    renderHome();

    expect(
      await screen.findByRole("heading", { name: "Este conteúdo não está disponível sem internet." }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("'Tentar de novo' sem internet mantém o aviso (ocupado) e devolve o foco ao botão (M-5)", async () => {
    storeSession();
    let release: () => void = () => undefined;
    let calls = 0;
    mockFetch({
      "GET /api/wallets": () => {
        calls += 1;
        if (calls === 1) throw new TypeError("Failed to fetch");
        return new Promise<never>((_resolve, reject) => {
          release = () => reject(new TypeError("Failed to fetch"));
        });
      },
      "GET /api/groups": { body: GROUPS },
      "GET /api/quotes/btc": { body: QUOTE },
    });
    const user = userEvent.setup();

    renderHome();
    await user.click(await screen.findByRole("button", { name: "Tentar de novo" }));

    // Durante a nova tentativa o trecho continua, com o botão ocupado (sem esqueleto)
    expect(screen.getByRole("heading", { name: "Este conteúdo não está disponível sem internet." })).toBeInTheDocument();
    await waitFor(() => expect(calls).toBe(2));
    expect(screen.getByRole("button", { name: /Tentar de novo/ })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Carregando…")).not.toBeInTheDocument();

    release();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Tentar de novo" })).not.toHaveAttribute("aria-busy"),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Tentar de novo" })).toHaveFocus());
  });

  it("rede fora com dados guardados mostra a Home guardada", async () => {
    storeSession();
    await offlineCache.set(USER_ID, "/api/wallets", WALLETS);
    await offlineCache.set(USER_ID, "/api/groups", GROUPS);
    await offlineCache.set(USER_ID, "/api/quotes/btc", QUOTE);
    const fail = () => {
      throw new TypeError("Failed to fetch");
    };
    mockFetch({ "GET /api/wallets": fail, "GET /api/groups": fail, "GET /api/quotes/btc": fail });

    renderHome();

    expect(await screen.findByRole("heading", { level: 2, name: "Silva" })).toBeInTheDocument();
    expect(screen.queryByText("Este conteúdo não está disponível sem internet.")).not.toBeInTheDocument();
    // Cotação guardada: mostra o dia e a hora dela (T042; 17:32 UTC = 14:32 em São Paulo)
    expect(await screen.findByText("cotação de 01/11 às 14:32")).toBeInTheDocument();
    expect(screen.getByText("desatualizada")).toBeInTheDocument();
  });

  it("atalho antigo /?acao=novo-lancamento leva à página Depositar (replace)", async () => {
    storeSession();
    mockFetch({
      "GET /api/wallets": { body: WALLETS },
      "GET /api/groups": { body: GROUPS },
      "GET /api/quotes/btc": { body: QUOTE },
    });

    const { router } = renderWithProviders(<HomePage />, {
      initialEntries: ["/?acao=novo-lancamento"],
      extraRoutes: [{ path: "/depositar", element: <p>Página Depositar</p> }],
    });

    expect(await screen.findByText("Página Depositar")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/depositar");
    expect(router.state.historyAction).toBe("REPLACE");
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
