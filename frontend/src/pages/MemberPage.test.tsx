import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemberPage from "./MemberPage";
import { DetailLevel } from "../types/balance";
import type { UserGroupBalancesResult } from "../types/balance";
import type { GroupInfo } from "../types/group";
import { USER_ID, makeGroup, makeWallet, storeSession } from "../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../test/utils";
import type { MockHandler, MockResponse } from "../test/utils";
import { notifySuccess } from "../utils/notify";

vi.mock("../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/notify")>();
  return { ...actual, notifySuccess: vi.fn(), notifyError: vi.fn() };
});

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

const SELF_RESULT = { ...RESULT, userId: USER_ID, firstName: "Ana", lastName: "Silva" } as UserGroupBalancesResult;

const members = [
  { userId: USER_ID, firstName: "Ana", lastName: "Silva", joinedAt: "2026-01-01T00:00:00Z" },
  { userId: 8, firstName: "Carlos", lastName: "Souza", joinedAt: "2026-01-01T00:00:00Z" },
];

/** Silva: Ana é responsável; Praia: o responsável é outra pessoa */
const SILVA = makeGroup({ groupId: 3, name: "Silva", isResponsible: true, responsibleUserId: USER_ID, members });
const PRAIA = makeGroup({ groupId: 2, name: "Praia", isResponsible: false, responsibleUserId: 8, members });

const setup = (
  groups: GroupInfo[],
  options: { userId?: number; result?: UserGroupBalancesResult; routes?: Record<string, MockResponse | MockHandler> } = {},
) => {
  const userId = options.userId ?? 8;
  storeSession();
  const fetchMock = mockFetch({
    [`GET /api/users/${userId}/group-balances`]: { body: options.result ?? RESULT },
    [`GET /api/users/${userId}/debts`]: { body: { userId, debts: [] } },
    "GET /api/quotes/btc": { body: QUOTE },
    "GET /api/groups": { body: groups },
    "GET /api/wallets": { body: [] },
    ...options.routes,
  });
  const user = userEvent.setup();
  const view = renderWithProviders(<MemberPage />, {
    path: "/pessoas/:userId",
    initialEntries: [`/pessoas/${userId}`],
  });
  return { fetchMock, user, ...view };
};

describe("MemberPage", () => {
  beforeEach(() => {
    vi.mocked(notifySuccess).mockClear();
  });

  it("mostra o total e as famílias: Full com carteiras, Summary só com o total", async () => {
    const { container } = setup([]);

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
    setup([], { routes: { "GET /api/users/8/group-balances": apiError(404, "Usuário não encontrado.") } });

    expect(await screen.findByText("Não encontrado")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Dívidas (feature 006)
  // -------------------------------------------------------------------------

  it("seção Dívidas fica depois do total e antes das famílias, com frases do ponto de vista da pessoa", async () => {
    const { container } = setup([], {
      routes: {
        "GET /api/users/8/debts": {
          body: {
            userId: 8,
            debts: [
              {
                counterpartUserId: USER_ID,
                counterpartName: "Ana Silva",
                counterpartFirstName: "Ana",
                currency: "BRL",
                amount: 70,
                direction: "owes",
              },
              {
                counterpartUserId: 9,
                counterpartName: "Bruno Lima",
                counterpartFirstName: "Bruno",
                currency: "BTC",
                amount: 0.0004,
                direction: "owed",
              },
            ],
          },
        },
      },
    });

    const debts = await screen.findByRole("region", { name: "Dívidas" });
    // Ordem: total → Dívidas → famílias
    const silva = screen.getByRole("region", { name: "Silva" });
    expect(debts.compareDocumentPosition(silva) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("3.750,00").compareDocumentPosition(debts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Página de outra pessoa: sem "você", nomes pelo primeiro nome
    const toAna = await within(debts).findByRole("link", { name: /^Carlos deve a Ana, −R\$\s70,00$/ });
    expect(toAna).toHaveAttribute("href", `/pessoas/${USER_ID}`);
    expect(within(debts).getByRole("link", { name: /^Bruno deve a Carlos, \+₿\s0,00040$/ })).toHaveAttribute(
      "href",
      "/pessoas/9",
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("na própria página usa \"você\"", async () => {
    setup([], {
      userId: USER_ID,
      result: SELF_RESULT,
      routes: {
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
              {
                counterpartUserId: 9,
                counterpartName: "Bruno Lima",
                counterpartFirstName: "Bruno",
                currency: "BTC",
                amount: 0.0004,
                direction: "owes",
              },
            ],
          },
        },
      },
    });

    const debts = await screen.findByRole("region", { name: "Dívidas" });
    expect(
      await within(debts).findByRole("link", { name: /^Bruno deve a você, \+R\$\s70,00$/ }),
    ).toBeInTheDocument();
    expect(within(debts).getByRole("link", { name: /^Você deve a Bruno, −₿\s0,00040$/ })).toBeInTheDocument();
  });

  it("erro nas dívidas não derruba a página e permite tentar de novo", async () => {
    let calls = 0;
    const { user, fetchMock } = setup([], {
      routes: {
        "GET /api/users/8/debts": () => {
          calls += 1;
          return calls === 1 ? apiError(500, "Falha ao calcular as dívidas.") : { body: { userId: 8, debts: [] } };
        },
      },
    });

    const debts = await screen.findByRole("region", { name: "Dívidas" });
    expect(await within(debts).findByRole("alert")).toHaveTextContent("Falha ao calcular as dívidas.");
    // O resto da página continua
    expect(screen.getByRole("heading", { level: 1, name: "Carlos Souza" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Silva" })).toBeInTheDocument();

    await user.click(within(debts).getByRole("button", { name: "Tentar de novo" }));

    expect(await within(debts).findByText("Nenhuma dívida em aberto.")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "GET /api/users/8/debts").length).toBeGreaterThan(1);
    // A faixa com o foco sumiu: o foco vai para o título da seção (REVIEW-006 M-2)
    await waitFor(() => expect(within(debts).getByRole("heading", { level: 2, name: "Dívidas" })).toHaveFocus());
  });

  it("ao tocar numa dívida, não mostra a pessoa anterior enquanto carrega e leva o foco ao título (REVIEW-006 B-1)", async () => {
    let release: (() => void) | null = null;
    const bruno = {
      ...RESULT,
      userId: 9,
      firstName: "Bruno",
      lastName: "Lima",
      totalBrl: 120,
      groups: [],
    } as UserGroupBalancesResult;
    const { user, container, router } = setup([SILVA], {
      routes: {
        "GET /api/users/8/debts": {
          body: {
            userId: 8,
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
        "GET /api/users/9/group-balances": () =>
          new Promise<MockResponse>((resolve) => {
            release = () => resolve({ body: bruno });
          }),
        "GET /api/users/9/debts": { body: { userId: 9, debts: [] } },
      },
    });

    // Página do Carlos, com o botão de adicionar carteira para ele (Ana é responsável da Silva)
    expect(await screen.findByRole("button", { name: "Adicionar carteira para Carlos Souza" })).toBeInTheDocument();
    await user.click(await screen.findByRole("link", { name: /^Bruno deve a Carlos/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/pessoas/9"));
    // Resposta da nova pessoa ainda não chegou: carregando, nada do Carlos na tela
    expect(await screen.findByRole("heading", { level: 1, name: "Pessoa" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Carlos Souza" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar carteira/ })).not.toBeInTheDocument();
    expect(screen.queryByText("3.750,00")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
    expect(await axe(container)).toHaveNoViolations();

    await waitFor(() => expect(release).not.toBeNull());
    (release as (() => void) | null)?.();

    const title = await screen.findByRole("heading", { level: 1, name: "Bruno Lima" });
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Adicionar carteira para Carlos Souza" })).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Adicionar carteira
  // -------------------------------------------------------------------------

  it("na própria página: \"Adicionar carteira\" cria carteira da própria pessoa", async () => {
    const { fetchMock, user, container } = setup([SILVA, PRAIA], {
      userId: USER_ID,
      result: SELF_RESULT,
      routes: { "POST /api/wallets": { status: 201, body: makeWallet({ name: "Viagem" }) } },
    });

    const add = await screen.findByRole("button", { name: "Adicionar carteira" });
    expect(add).toHaveAttribute("aria-haspopup", "dialog");
    expect(await axe(container)).toHaveNoViolations();

    await user.click(add);
    const dialog = await screen.findByRole("dialog", { name: "Nova carteira" });
    // Família opcional, como na aba Carteiras
    expect(within(dialog).getByLabelText("Família")).toHaveValue("");
    expect(within(dialog).getByRole("option", { name: "Nenhuma (avulsa)" })).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Nome"), "Viagem");
    await user.click(within(dialog).getByRole("button", { name: "Criar carteira" }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, "POST /api/wallets")).toEqual([
        { name: "Viagem", description: null, currency: "BRL", isVirtual: false, ownerUserId: null, groupId: null },
      ]),
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Carteira Viagem criada."));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("responsável de família em comum: cria para a pessoa, com a família pré-selecionada", async () => {
    const { fetchMock, user, baseElement } = setup([SILVA, PRAIA], {
      routes: {
        "POST /api/wallets": {
          status: 201,
          body: makeWallet({ name: "Mesada", ownerUserId: 8, ownerName: "Carlos Souza", ownerFirstName: "Carlos", groupId: 3 }),
        },
      },
    });

    await user.click(await screen.findByRole("button", { name: "Adicionar carteira para Carlos Souza" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova carteira" });

    // Só Silva (Ana é responsável); Praia não entra, e não há "Nenhuma"
    const family = within(dialog).getByLabelText("Família");
    expect(family).toHaveValue("3");
    expect(within(family).getAllByRole("option").map((o) => o.textContent)).toEqual(["Silva"]);
    // Titular fixo, sem seletor
    expect(within(dialog).queryByLabelText("Titular")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Titular")).toBeInTheDocument();
    expect(within(dialog).getByText("Carlos Souza")).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.type(within(dialog).getByLabelText("Nome"), "Mesada");
    await user.click(within(dialog).getByRole("button", { name: "Criar carteira" }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, "POST /api/wallets")).toEqual([
        { name: "Mesada", description: null, currency: "BRL", isVirtual: false, ownerUserId: 8, groupId: 3 },
      ]),
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Carteira Mesada criada."));
    // Recarrega os dados da página
    await waitFor(() => expect(requestsTo(fetchMock, "GET /api/users/8/group-balances").length).toBeGreaterThan(1));
  });

  it("com mais de uma família em comum, a família é obrigatória", async () => {
    const { fetchMock, user } = setup([SILVA, { ...PRAIA, isResponsible: true, responsibleUserId: USER_ID }]);

    await user.click(await screen.findByRole("button", { name: "Adicionar carteira para Carlos Souza" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova carteira" });
    expect(within(dialog).getByLabelText("Família")).toHaveValue("");
    await user.type(within(dialog).getByLabelText("Nome"), "Mesada");
    await user.click(within(dialog).getByRole("button", { name: "Criar carteira" }));

    expect(await within(dialog).findByText("Escolha a família.")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/wallets")).toHaveLength(0);
  });

  it("membro comum (não responsável) não vê o botão", async () => {
    const { fetchMock } = setup([{ ...SILVA, isResponsible: false, responsibleUserId: 8 }, PRAIA]);

    expect(await screen.findByRole("heading", { level: 1, name: "Carlos Souza" })).toBeInTheDocument();
    await waitFor(() => expect(requestsTo(fetchMock, "GET /api/groups")).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("region", { name: "Silva" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Adicionar carteira/ })).not.toBeInTheDocument();
  });

  it("erro do servidor fica na folha com os dados preservados", async () => {
    const { user } = setup([SILVA], {
      routes: { "POST /api/wallets": apiError(422, "A pessoa não pertence a essa família.") },
    });

    await user.click(await screen.findByRole("button", { name: "Adicionar carteira para Carlos Souza" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova carteira" });
    await user.type(within(dialog).getByLabelText("Nome"), "Mesada");
    await user.click(within(dialog).getByRole("button", { name: "Criar carteira" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("A pessoa não pertence a essa família.");
    expect(within(dialog).getByLabelText("Nome")).toHaveValue("Mesada");
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
