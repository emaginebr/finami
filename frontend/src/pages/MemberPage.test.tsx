import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import MemberPage from "./MemberPage";
import { DetailLevel } from "../types/balance";
import type { UserGroupBalancesResult } from "../types/balance";
import { storeSession } from "../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders } from "../test/utils";

const QUOTE = { priceBrl: 512340, quotedAt: "2026-11-01T17:32:00Z", source: "coingecko", isStale: false };

const RESULT = {
  userId: 8,
  firstName: "Carlos",
  lastName: "Souza",
  btcExcluded: false,
  totalBrl: 3750,
  groups: [
    {
      groupId: 2,
      name: "Praia",
      detailLevel: DetailLevel.Summary,
      balanceBrl: 600,
      balanceBtc: 0,
      estimatedBrl: 0,
      totalBrl: 600,
      wallets: [],
    },
    {
      groupId: 3,
      name: "Silva",
      detailLevel: DetailLevel.Full,
      balanceBrl: 2900,
      balanceBtc: 0.00048796,
      estimatedBrl: 250,
      totalBrl: 3150,
      wallets: [
        {
          walletId: 21,
          name: "Salário Carlos",
          currency: "BRL",
          isVirtual: false,
          balance: 2900,
          estimatedBrl: null,
          canViewStatement: true,
        },
        {
          walletId: 23,
          name: "Cofrinho",
          currency: "BTC",
          isVirtual: true,
          balance: 0.00048796,
          estimatedBrl: 250,
          canViewStatement: false,
        },
      ],
    },
  ],
} as UserGroupBalancesResult;

const renderMember = () =>
  renderWithProviders(<MemberPage />, { path: "/pessoas/:userId", initialEntries: ["/pessoas/8"] });

describe("MemberPage", () => {
  it("mostra o total e as famílias: Full com carteiras, Summary só com o total", async () => {
    storeSession();
    mockFetch({
      "GET /api/users/8/group-balances": { body: RESULT },
      "GET /api/quotes/btc": { body: QUOTE },
    });

    const { container } = renderMember();

    expect(await screen.findByRole("heading", { level: 1, name: "Carlos Souza" })).toBeInTheDocument();
    expect(screen.getByText("3.750,00")).toBeInTheDocument();

    const silva = screen.getByRole("region", { name: "Silva" });
    expect(within(silva).getByRole("link", { name: /^Salário Carlos/ })).toHaveAttribute("href", "/carteiras/21");
    expect(within(silva).queryByRole("link", { name: /Cofrinho/ })).not.toBeInTheDocument();
    expect(within(silva).getByText("Cofrinho")).toBeInTheDocument();

    const praia = screen.getByRole("region", { name: "Praia" });
    expect(within(praia).getByText("Só o total")).toBeInTheDocument();
    expect(within(praia).queryByRole("link", { name: /carteira/i })).not.toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("404 mostra 'Não encontrado'", async () => {
    storeSession();
    mockFetch({
      "GET /api/users/8/group-balances": apiError(404, "Usuário não encontrado."),
      "GET /api/quotes/btc": { body: QUOTE },
    });

    renderMember();

    expect(await screen.findByText("Não encontrado")).toBeInTheDocument();
  });
});
