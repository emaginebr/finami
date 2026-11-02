import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WalletsPage from "./WalletsPage";
import { Currency } from "../types/api";
import type { GroupInfo } from "../types/group";
import type { WalletInfo } from "../types/wallet";
import { USER_ID, makeGroup, makeWallet, storeSession } from "../test/fixtures";
import { axe, mockFetch, renderWithProviders, requestsTo } from "../test/utils";

const SILVA = makeGroup({
  groupId: 1,
  name: "Silva",
  isResponsible: true,
  members: [
    { userId: USER_ID, firstName: "Ana", lastName: "Silva", joinedAt: "2026-01-01T00:00:00Z" },
    { userId: 9, firstName: "Pedro", lastName: "Silva", joinedAt: "2026-01-01T00:00:00Z" },
  ],
});

const PRAIA = makeGroup({
  groupId: 2,
  name: "Praia",
  isResponsible: false,
  responsibleUserId: 30,
  members: [
    { userId: 30, firstName: "Carlos", lastName: "Souza", joinedAt: "2026-01-01T00:00:00Z" },
    { userId: USER_ID, firstName: "Ana", lastName: "Silva", joinedAt: "2026-01-01T00:00:00Z" },
  ],
});

const WALLETS = [
  makeWallet({ walletId: 1, name: "Conta conjunta", balance: 8420.15, groupId: 1 }),
  makeWallet({ walletId: 2, name: "Nubank", balance: 1234.56 }),
  makeWallet({ walletId: 3, name: "Reserva BTC", currency: Currency.BTC, balance: 0.0025, estimatedBrl: 1280.85 }),
  makeWallet({ walletId: 4, name: "Poupança antiga", balance: 0, isActive: false }),
  makeWallet({ walletId: 5, name: "Mesada do Pedro", balance: 50, groupId: 1, ownerUserId: 9, ownerName: "Pedro Silva" }),
];

const QUOTE = { priceBrl: 512340, quotedAt: "2026-11-01T17:32:00Z", source: "coingecko", isStale: false };

const setup = (initialGroups: GroupInfo[] = [SILVA, PRAIA]) => {
  storeSession();
  let wallets: WalletInfo[] = [...WALLETS];
  let groups = [...initialGroups];
  const fetchMock = mockFetch({
    "GET /api/wallets": () => ({ body: wallets }),
    "GET /api/groups": () => ({ body: groups }),
    "GET /api/quotes/btc": { body: QUOTE },
    "POST /api/wallets": (request) => {
      const created = makeWallet({ walletId: 50, ...(request.body as Partial<WalletInfo>) });
      wallets = [...wallets, created];
      return { status: 201, body: created };
    },
    "POST /api/groups": (request) => {
      const created = makeGroup({ groupId: 60, name: (request.body as { name: string }).name });
      groups = [...groups, created];
      return { status: 201, body: created };
    },
  });
  const user = userEvent.setup();
  const view = renderWithProviders(<WalletsPage />, { path: "/carteiras", initialEntries: ["/carteiras"] });
  return { fetchMock, user, ...view };
};

describe("WalletsPage", () => {
  it("lista Família → Pessoa → Carteira (todos links); inativas ficam recolhidas", async () => {
    const { user, container, fetchMock } = setup();

    // Família: link para a página da família, com responsável
    const silva = await screen.findByRole("region", { name: "Silva" });
    expect(within(silva).getByRole("link", { name: /^Silva/ })).toHaveAttribute("href", "/familias/1");
    expect(within(silva).getByText("Responsável")).toBeInTheDocument();
    const praia = screen.getByRole("region", { name: "Praia" });
    expect(within(praia).getByRole("link", { name: /^Praia/ })).toHaveTextContent("Carlos Souza");
    expect(within(praia).getByText("Nenhuma carteira nesta família")).toBeInTheDocument();

    // Pessoas da família (a pessoa logada primeiro), cada uma com link para a página dela
    const people = within(silva).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(people).toEqual(["Ana Silva (você)", "Pedro Silva"]);
    expect(within(silva).getByRole("link", { name: /^Pedro Silva/ })).toHaveAttribute("href", "/pessoas/9");

    // Carteiras sob cada pessoa, sem repetir "de {titular}"
    expect(within(silva).getByRole("link", { name: /^Conta conjunta/ })).toHaveAttribute("href", "/carteiras/1");
    const mesada = within(silva).getByRole("link", { name: /^Mesada do Pedro/ });
    expect(mesada).toHaveAttribute("href", "/carteiras/5");
    expect(mesada).not.toHaveTextContent("de Pedro Silva");

    // Avulsas também por pessoa
    const loose = screen.getByRole("region", { name: "Avulsas" });
    expect(within(loose).getByRole("link", { name: /^Ana Silva/ })).toHaveAttribute("href", `/pessoas/${USER_ID}`);
    expect(within(loose).getByRole("link", { name: /^Nubank/ })).toBeInTheDocument();
    expect(within(loose).getByRole("link", { name: /^Reserva BTC/ })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: /^Poupança antiga/ })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("includeInactive=true"))).toBe(true);

    const toggle = screen.getByRole("button", { name: "Inativas (1)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /^Poupança antiga.*inativa/ })).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("criar carteira atualiza a lista", async () => {
    const { user, fetchMock } = setup();

    await screen.findByRole("link", { name: /^Conta conjunta/ });
    await user.click(screen.getByRole("button", { name: "Nova carteira" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova carteira" });
    await user.type(within(dialog).getByLabelText("Nome"), "Mesada da Lia");
    await user.click(within(dialog).getByRole("button", { name: "Criar carteira" }));

    expect(await screen.findByRole("link", { name: /^Mesada da Lia/ })).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/wallets")).toEqual([
      {
        name: "Mesada da Lia",
        description: null,
        currency: "BRL",
        isVirtual: false,
        ownerUserId: null,
        groupId: null,
      },
    ]);
  });

  it("sem família mostra o convite e criar família atualiza a lista", async () => {
    const { user, fetchMock } = setup([]);

    expect(await screen.findByText("Crie sua primeira família")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Nova família" })[0] as HTMLElement);
    const dialog = await screen.findByRole("dialog", { name: "Nova família" });
    await user.type(within(dialog).getByLabelText("Nome da família"), "Praia");
    await user.click(within(dialog).getByRole("button", { name: "Criar família" }));

    await waitFor(() => expect(requestsTo(fetchMock, "POST /api/groups")).toEqual([{ name: "Praia" }]));
    expect(await screen.findByRole("link", { name: /^Praia/ })).toHaveAttribute("href", "/familias/60");
  });
});
