import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GroupPage from "./GroupPage";
import { DetailLevel } from "../types/balance";
import type { GroupBalancesResult, MemberBalanceInfo } from "../types/balance";
import { StatementVisibility } from "../types/group";
import { USER_ID, makeGroup, storeSession } from "../test/fixtures";
import { axe, mockFetch, renderWithProviders } from "../test/utils";

const QUOTE = { priceBrl: 512340, quotedAt: "2026-11-01T17:32:00Z", isStale: false };

const GROUP = makeGroup({
  groupId: 3,
  name: "Silva",
  isResponsible: false,
  responsibleUserId: 8,
  statementVisibility: StatementVisibility.AllMembers,
  members: [
    { userId: 8, firstName: "Carlos", lastName: "Souza", joinedAt: "2026-01-01T00:00:00Z" },
    { userId: USER_ID, firstName: "Ana", lastName: "Silva", joinedAt: "2026-01-01T00:00:00Z" },
  ],
});

const fullMembers: MemberBalanceInfo[] = [
  {
    userId: 8,
    firstName: "Carlos",
    lastName: "Souza",
    isResponsible: true,
    balanceBrl: 300,
    balanceBtc: 0,
    estimatedBrl: 0,
    totalBrl: 300,
    wallets: [
      {
        walletId: 21,
        name: "Salário Carlos",
        currency: "BRL",
        isVirtual: false,
        balance: 300,
        estimatedBrl: null,
        canViewStatement: false,
      },
    ] as MemberBalanceInfo["wallets"],
  },
  {
    userId: USER_ID,
    firstName: "Ana",
    lastName: "Silva",
    isResponsible: false,
    balanceBrl: 100,
    balanceBtc: 0,
    estimatedBrl: 0,
    totalBrl: 100,
    wallets: [
      {
        walletId: 22,
        name: "Mesada",
        currency: "BRL",
        isVirtual: true,
        balance: 100,
        estimatedBrl: null,
        canViewStatement: true,
      },
    ] as MemberBalanceInfo["wallets"],
  },
];

const balances = (detailLevel: DetailLevel): GroupBalancesResult => {
  const hidden = detailLevel === DetailLevel.Hidden;
  return {
    groupId: 3,
    name: "Silva",
    statementVisibility: hidden
      ? StatementVisibility.ResponsibleOnly
      : detailLevel === DetailLevel.Summary
        ? StatementVisibility.MembersSummary
        : StatementVisibility.AllMembers,
    isResponsible: false,
    detailLevel,
    quote: QUOTE,
    btcExcluded: false,
    totalBrl: hidden ? null : 400,
    members: fullMembers.map((member) => ({
      ...member,
      balanceBrl: hidden ? null : member.balanceBrl,
      balanceBtc: hidden ? null : member.balanceBtc,
      estimatedBrl: hidden ? null : member.estimatedBrl,
      totalBrl: hidden ? null : member.totalBrl,
      wallets: detailLevel === DetailLevel.Full ? member.wallets : [],
    })),
  };
};

const renderGroup = (detailLevel: DetailLevel) => {
  storeSession();
  mockFetch({
    "GET /api/groups/3": { body: GROUP },
    "GET /api/groups/3/balances": { body: balances(detailLevel) },
  });
  return renderWithProviders(<GroupPage />, { path: "/familias/:groupId", initialEntries: ["/familias/3"] });
};

describe("GroupPage", () => {
  it("Full: total, valores por membro e carteiras (link só com canViewStatement)", async () => {
    const { container } = renderGroup(DetailLevel.Full);

    expect(await screen.findByRole("heading", { level: 1, name: "Silva" })).toBeInTheDocument();
    expect(await screen.findByText("400,00")).toBeInTheDocument();

    const members = screen.getByRole("region", { name: "Membros" });
    expect(within(members).getByRole("link", { name: /^Carlos Souza, responsável/ })).toHaveAttribute(
      "href",
      "/pessoas/8",
    );

    const wallets = screen.getByRole("region", { name: "Carteiras da família" });
    expect(within(wallets).getByRole("link", { name: /^Mesada/ })).toHaveAttribute("href", "/carteiras/22");
    expect(within(wallets).queryByRole("link", { name: /Salário Carlos/ })).not.toBeInTheDocument();
    expect(within(wallets).getByText("Salário Carlos")).toBeInTheDocument();
    expect(within(wallets).getByText(/extrato restrito/)).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Gerenciar família" })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Summary: valores por membro, sem lista de carteiras", async () => {
    renderGroup(DetailLevel.Summary);

    expect(await screen.findByText("Você vê só os totais")).toBeInTheDocument();
    expect(screen.getByText("400,00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Carlos Souza.*R\$\s300,00/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Carteiras da família" })).not.toBeInTheDocument();
    expect(screen.queryByText("Mesada")).not.toBeInTheDocument();
  });

  it("membro comum não vê \"Adicionar membro\" nem convites pendentes", async () => {
    renderGroup(DetailLevel.Full);

    expect(await screen.findByRole("region", { name: "Membros" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar membro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Convites pendentes" })).not.toBeInTheDocument();
  });

  it("responsável vê \"Adicionar membro\" na seção Membros e os convites pendentes", async () => {
    storeSession();
    const owned = { ...GROUP, isResponsible: true, responsibleUserId: USER_ID };
    mockFetch({
      "GET /api/groups/3": { body: owned },
      "GET /api/groups/3/balances": { body: { ...balances(DetailLevel.Full), isResponsible: true } },
      "GET /api/groups/3/invitations": {
        body: [
          {
            invitationId: 12,
            groupId: 3,
            groupName: "Silva",
            invitedUser: { userId: 9, firstName: "Bruno", lastName: "Lima" },
            invitedBy: { userId: USER_ID, firstName: "Ana", lastName: "Silva" },
            status: "Pending",
            createdAt: "2026-10-30T15:00:00Z",
            respondedAt: null,
          },
        ],
      },
    });
    const user = userEvent.setup();
    const { container } = renderWithProviders(<GroupPage />, {
      path: "/familias/:groupId",
      initialEntries: ["/familias/3"],
    });

    const members = await screen.findByRole("region", { name: "Membros" });
    const add = within(members).getByRole("button", { name: "Adicionar membro" });
    expect(add).toHaveAttribute("aria-haspopup", "dialog");
    const pending = await screen.findByRole("region", { name: "Convites pendentes" });
    expect(within(pending).getByText("Bruno Lima")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(add);
    expect(await screen.findByRole("dialog", { name: "Adicionar membro" })).toBeInTheDocument();
  });

  it("Hidden: sem valores, sem links e com a explicação", async () => {
    const { container } = renderGroup(DetailLevel.Hidden);

    expect(await screen.findByText("Valores restritos")).toBeInTheDocument();
    expect(screen.getByText(/O responsável restringiu a visualização/)).toBeInTheDocument();
    expect(screen.getByText("Carlos Souza")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Carlos Souza/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
    expect(screen.getAllByText("valor oculto")).toHaveLength(2);
    expect(await axe(container)).toHaveNoViolations();
  });
});
