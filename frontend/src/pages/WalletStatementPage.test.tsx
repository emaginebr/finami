import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WalletStatementPage from "./WalletStatementPage";
import { Currency } from "../types/api";
import { TransactionType } from "../types/transaction";
import { makeWallet, storeSession } from "../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../test/utils";
import type { MockRequest, MockResponse } from "../test/utils";

const WALLET = makeWallet({ walletId: 1, name: "Conta conjunta", balance: 8420.15 });

const ENTRIES = [
  {
    transactionId: 10,
    occurredAt: "2026-11-05T10:30:00Z",
    type: TransactionType.ExternalIncome,
    sourceName: "Externo",
    destinationName: "Conta conjunta",
    currency: Currency.BRL,
    amount: 7500,
    quotePriceBrl: null,
    description: "Salário",
    internal: false,
  },
  {
    transactionId: 11,
    occurredAt: "2026-11-12T22:22:00Z",
    type: TransactionType.ExternalExpense,
    sourceName: "Conta conjunta",
    destinationName: "Externo",
    currency: Currency.BRL,
    amount: -812.35,
    quotePriceBrl: null,
    description: "Mercado",
    internal: false,
  },
];

const statement = (request: MockRequest, entries = ENTRIES): MockResponse => {
  const params = new URLSearchParams(request.search);
  return {
    body: {
      scope: "Wallet",
      scopeId: 1,
      start: params.get("start"),
      end: params.get("end"),
      detailLevel: "Full",
      totals: [
        { currency: "BRL", openingBalance: 1732.5, totalIn: 7500, totalOut: 812.35, closingBalance: 8420.15 },
      ],
      entries,
    },
  };
};

const TRANSACTION = {
  transactionId: 11,
  type: TransactionType.ExternalExpense,
  source: { accountId: 1, name: "Conta conjunta", kind: "Wallet", currency: "BRL", ownerName: "Ana Silva" },
  destination: { accountId: 900, name: "Externo", kind: "External", currency: "BRL", ownerName: null },
  sourceAmount: 812.35,
  destinationAmount: 812.35,
  quote: null,
  description: "Mercado",
  occurredAt: "2026-11-12T22:22:00Z",
  createdByUserId: 7,
  reversedTransactionId: null,
  reversedByTransactionId: null,
};

const statementSearches = (fetchMock: ReturnType<typeof mockFetch>): string[] =>
  fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/statements/wallets/1")
    .map((url) => url.search);

const renderPage = () =>
  renderWithProviders(<WalletStatementPage />, {
    path: "/carteiras/:walletId",
    initialEntries: ["/carteiras/1"],
  });

describe("WalletStatementPage", () => {
  const fixClock = () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T15:00:00Z"));
  };

  it("carrega o mês corrente com totais e lançamentos do mais recente ao mais antigo", async () => {
    fixClock();
    storeSession();
    const fetchMock = mockFetch({
      "GET /api/wallets/1": { body: WALLET },
      "GET /api/statements/wallets/1": (request) => statement(request),
    });

    const { container } = renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Conta conjunta" })).toBeInTheDocument();
    await screen.findByText("Mercado");
    expect(statementSearches(fetchMock)[0]).toBe("?start=2026-11-01&end=2026-11-15");

    expect(screen.getByText("Saldo inicial")).toBeInTheDocument();
    expect(screen.getByText("Saldo final")).toBeInTheDocument();

    const rows = screen.getAllByRole("button", { name: /Mercado|Salário/ });
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Mercado"),
      expect.stringContaining("Salário"),
    ]);
    expect(rows[0]).toHaveTextContent("−R$");
    expect(rows[1]).toHaveTextContent("+R$");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("'Mês passado' refaz a chamada com as datas do mês anterior", async () => {
    fixClock();
    storeSession();
    const fetchMock = mockFetch({
      "GET /api/wallets/1": { body: WALLET },
      "GET /api/statements/wallets/1": (request) => statement(request),
    });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Mercado");
    await user.click(screen.getByRole("radio", { name: "Mês passado" }));

    await waitFor(() =>
      expect(statementSearches(fetchMock)).toContain("?start=2026-10-01&end=2026-10-31"),
    );
    expect(screen.getByText("01/10/2026 – 31/10/2026")).toBeInTheDocument();
  });

  it("bloqueia período personalizado maior que 366 dias", async () => {
    fixClock();
    storeSession();
    const fetchMock = mockFetch({
      "GET /api/wallets/1": { body: WALLET },
      "GET /api/statements/wallets/1": (request) => statement(request),
    });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Mercado");
    await user.click(screen.getByRole("radio", { name: "Personalizado" }));
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2025-01-01" } });

    expect(await screen.findByText("O período máximo do extrato é de 366 dias.")).toBeInTheDocument();
    expect(screen.getByLabelText("De")).toHaveAttribute("aria-invalid", "true");
    expect(statementSearches(fetchMock)).not.toContain("?start=2025-01-01&end=2026-11-15");
  });

  it("estorna com ConfirmModal e recarrega o extrato", async () => {
    fixClock();
    storeSession();
    const fetchMock = mockFetch({
      "GET /api/wallets/1": { body: WALLET },
      "GET /api/wallets": { body: [WALLET] },
      "GET /api/statements/wallets/1": (request) => statement(request),
      "GET /api/transactions/11": { body: TRANSACTION },
      "POST /api/transactions/11/reverse": {
        status: 201,
        body: { ...TRANSACTION, transactionId: 12, type: TransactionType.Reversal, reversedTransactionId: 11 },
      },
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole("button", { name: /Mercado/ }));
    const sheet = await screen.findByRole("dialog", { name: "Lançamento" });
    await user.click(await within(sheet).findByRole("button", { name: "Estornar lançamento" }));

    const confirm = await screen.findByRole("alertdialog", { name: /Estornar lançamento\?/ });
    expect(within(confirm).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    const before = statementSearches(fetchMock).length;
    await user.click(within(confirm).getByRole("button", { name: "Estornar" }));

    await waitFor(() => expect(requestsTo(fetchMock, "POST /api/transactions/11/reverse")).toHaveLength(1));
    await waitFor(() => expect(statementSearches(fetchMock).length).toBeGreaterThan(before));
  });

  it("mostra 'Sem permissão' em 403 e 'Não encontrado' em 404", async () => {
    storeSession();
    mockFetch({
      "GET /api/wallets/1": apiError(403, "Sem permissão."),
      "GET /api/statements/wallets/1": apiError(403, "Sem permissão."),
    });

    const first = renderPage();
    expect(await screen.findByText("Sem permissão")).toBeInTheDocument();
    first.unmount();

    mockFetch({
      "GET /api/wallets/1": apiError(404, "Carteira não encontrada."),
      "GET /api/statements/wallets/1": apiError(404, "Carteira não encontrada."),
    });
    renderPage();
    expect(await screen.findByText("Não encontrado")).toBeInTheDocument();
  });

  it("mostra o estado vazio sem lançamentos", async () => {
    fixClock();
    storeSession();
    mockFetch({
      "GET /api/wallets/1": { body: WALLET },
      "GET /api/statements/wallets/1": (request) => statement(request, []),
    });

    renderPage();

    expect(await screen.findByText("Nenhum lançamento no período")).toBeInTheDocument();
  });
});
