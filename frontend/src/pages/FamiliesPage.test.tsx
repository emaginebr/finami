import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FamiliesPage from "./FamiliesPage";
import { DetailLevel } from "../types/balance";
import type { GroupBalancesResult } from "../types/balance";
import { StatementVisibility } from "../types/group";
import type { GroupInfo } from "../types/group";
import { USER_ID, makeGroup, storeSession } from "../test/fixtures";
import { axe, mockFetch, renderWithProviders } from "../test/utils";

const ANA = { userId: USER_ID, firstName: "Ana", lastName: "Silva", joinedAt: "2026-01-01T00:00:00Z", canCreateTransactions: true, canReverse: false };

const SILVA = makeGroup({ groupId: 3, name: "Silva", members: [ANA] });
const PRAIA = makeGroup({
  groupId: 4,
  name: "Casa de praia",
  isResponsible: false,
  responsibleUserId: 8,
  statementVisibility: StatementVisibility.ResponsibleOnly,
  members: [{ userId: 8, firstName: "Carlos", lastName: "Souza", joinedAt: "2026-01-01T00:00:00Z", canCreateTransactions: true, canReverse: false }, ANA],
});

const balancesOf = (group: GroupInfo, totalBrl: number | null): GroupBalancesResult => ({
  groupId: group.groupId,
  name: group.name,
  statementVisibility: group.statementVisibility,
  isResponsible: group.isResponsible,
  detailLevel: totalBrl === null ? DetailLevel.Hidden : DetailLevel.Full,
  quote: null,
  btcExcluded: false,
  totalBrl,
  members: [],
});

const renderFamilies = (routes: Parameters<typeof mockFetch>[0]) => {
  storeSession();
  const fetchMock = mockFetch(routes);
  const result = renderWithProviders(<FamiliesPage />, { path: "/familias", initialEntries: ["/familias"] });
  return { ...result, fetchMock };
};

describe("FamiliesPage", () => {
  it("com mais de uma família lista cada uma com o saldo", async () => {
    const { container } = renderFamilies({
      "GET /api/groups": { body: [SILVA, PRAIA] },
      "GET /api/groups/3/balances": { body: balancesOf(SILVA, 1234.56) },
      "GET /api/groups/4/balances": { body: balancesOf(PRAIA, null) },
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Famílias" })).toBeInTheDocument();

    // Ordem alfabética; cada linha leva à tela da família
    const links = screen.getAllByRole("link", { name: /Silva|Casa de praia/ });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/familias/4", "/familias/3"]);

    const silva = screen.getByRole("link", { name: /Silva/ });
    expect(await within(silva).findByText("R$ 1.234,56")).toBeInTheDocument();
    // Família em que o saldo é restrito: valor oculto
    const praia = screen.getByRole("link", { name: /Casa de praia/ });
    expect(await within(praia).findByText("valor oculto")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Nova família" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("com uma família mostra a tela dela direto, sem voltar", async () => {
    renderFamilies({
      "GET /api/groups": { body: [SILVA] },
      "GET /api/groups/3": { body: SILVA },
      "GET /api/groups/3/balances": {
        body: {
          ...balancesOf(SILVA, 100),
          members: [
            {
              userId: USER_ID,
              firstName: "Ana",
              lastName: "Silva",
              isResponsible: true,
              balanceBrl: 100,
              balanceBtc: 0,
              estimatedBrl: 0,
              totalBrl: 100,
              wallets: [],
            },
          ],
        },
      },
      "GET /api/groups/3/invitations": { body: [] },
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Silva" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Membros" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Voltar/ })).not.toBeInTheDocument();
  });

  it("sem família mostra o botão para criar e, criada, abre a tela dela", async () => {
    const created = makeGroup({ groupId: 9, name: "Nova casa", members: [ANA] });
    renderFamilies({
      "GET /api/groups": { body: [] },
      "POST /api/groups": { status: 201, body: created },
      "GET /api/groups/9": { body: created },
      "GET /api/groups/9/balances": { body: balancesOf(created, 0) },
      "GET /api/groups/9/invitations": { body: [] },
    });
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Crie sua primeira família" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar família" }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome da família"), "Nova casa");
    await user.click(within(dialog).getByRole("button", { name: "Criar família" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Nova casa" })).toBeInTheDocument();
  });
});
