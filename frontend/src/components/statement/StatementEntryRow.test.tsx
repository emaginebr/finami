import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { StatementEntryRow } from "./StatementEntryRow";
import { TransactionDetailSheet } from "./TransactionDetailSheet";
import { Currency } from "../../types/api";
import { TransactionType, TransferKind } from "../../types/transaction";
import type { TransactionInfo } from "../../types/transaction";
import type { StatementEntryInfo } from "../../types/statement";
import { storeSession } from "../../test/fixtures";
import { axe, mockFetch, renderWithProviders } from "../../test/utils";

const makeEntry = (overrides: Partial<StatementEntryInfo> = {}): StatementEntryInfo => ({
  transactionId: 31,
  occurredAt: "2026-11-03T17:32:00Z",
  type: TransactionType.Transfer,
  sourceName: "Nubank",
  destinationName: "Mesada",
  currency: Currency.BRL,
  amount: -100,
  quotePriceBrl: null,
  description: null,
  internal: false,
  transferKind: TransferKind.Loan,
  debtCurrency: Currency.BRL,
  debtAmount: 100,
  sourceOwnerFirstName: "Ana",
  destinationOwnerFirstName: "Bruno",
  ...overrides,
});

const renderRow = (entry: StatementEntryInfo) => render(<StatementEntryRow entry={entry} onOpen={vi.fn()} />);

describe("StatementEntryRow — rótulos por tipo (feature 007)", () => {
  it.each([
    [TransferKind.Loan, -100, "Empréstimo para Bruno"],
    [TransferKind.Loan, 100, "Empréstimo de Ana"],
    [TransferKind.Settlement, -30, "Quitação para Bruno"],
    [TransferKind.Settlement, 30, "Quitação de Ana"],
    [TransferKind.Payment, -50, "Pagamento para Bruno"],
    [TransferKind.Payment, 50, "Pagamento de Ana"],
  ])("%s com valor %d → \"%s\" como título, sem o nome repetido", (kind, amount, label) => {
    renderRow(makeEntry({ transferKind: kind, amount }));

    const row = screen.getByRole("button");
    expect(within(row).getByText(label)).toBeInTheDocument();
    expect(row).toHaveAccessibleName(new RegExp(`^${label}`));
    expect(row.textContent).not.toMatch(/[→←]/);
  });

  it("com descrição: a descrição é o título e o rótulo do tipo vai para a linha 2", () => {
    renderRow(makeEntry({ transferKind: TransferKind.Payment, amount: -50, description: "Mesada de novembro" }));

    expect(screen.getByText("Mesada de novembro")).toBeInTheDocument();
    const details = screen.getByText(/· Pagamento para Bruno$/);
    // Quebra em 2 linhas em vez de cortar o nome da pessoa (REVIEW-007 M-6)
    expect(details).toHaveClass("line-clamp-2");
    expect(details).not.toHaveClass("truncate");
  });

  it("estorno de uma transferência com tipo: \"Estorno de empréstimo\"", () => {
    renderRow(makeEntry({ type: TransactionType.Reversal, amount: 100 }));
    expect(screen.getByText("Estorno de empréstimo")).toBeInTheDocument();
  });

  it("sem o primeiro nome do titular (fora do contrato), usa o nome da carteira", () => {
    renderRow(makeEntry({ sourceOwnerFirstName: undefined, destinationOwnerFirstName: undefined }));
    expect(screen.getByText("Empréstimo para Mesada")).toBeInTheDocument();
  });

  it("transferência sem tipo (mesmo titular) segue como antes", async () => {
    const { container } = renderRow(
      makeEntry({ transferKind: null, debtCurrency: null, debtAmount: null, destinationName: "Reserva" }),
    );
    expect(screen.getByText("Transferência")).toBeInTheDocument();
    expect(screen.getByText(/→ Reserva/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("TransactionDetailSheet — Tipo e Abatido da dívida (feature 007)", () => {
  const settlementInBtc: TransactionInfo = {
    transactionId: 31,
    type: TransactionType.Transfer,
    source: { accountId: 2, name: "Reserva BTC", kind: "Wallet", currency: Currency.BTC, ownerName: "Ana Silva" },
    destination: { accountId: 14, name: "Cofre", kind: "Wallet", currency: Currency.BTC, ownerName: "Bruno Souza" },
    sourceAmount: 0.0002,
    destinationAmount: 0.0002,
    quote: { priceBrl: 500000, quotedAt: "2026-11-03T17:32:00Z", source: "coingecko" },
    description: null,
    occurredAt: "2026-11-03T17:32:00Z",
    createdByUserId: 7,
    reversedTransactionId: null,
    reversedByTransactionId: null,
    canReverse: false,
    transferKind: TransferKind.Settlement,
    debtCurrency: Currency.BRL,
    debtAmount: 100,
  };

  it("cabeçalho com o rótulo do extrato, linha Tipo e Abatido da dívida em outra moeda", async () => {
    storeSession();
    mockFetch({ "GET /api/transactions/31": { body: settlementInBtc } });
    const entry = makeEntry({
      transferKind: TransferKind.Settlement,
      currency: Currency.BTC,
      amount: -0.0002,
      quotePriceBrl: 500000,
      sourceName: "Reserva BTC",
      destinationName: "Cofre",
    });

    const { baseElement } = renderWithProviders(
      <TransactionDetailSheet entry={entry} onClose={vi.fn()} />,
    );

    const sheet = await screen.findByRole("dialog", { name: "Lançamento" });
    expect(within(sheet).getByText("Quitação para Bruno")).toBeInTheDocument();
    const kindLabel = await within(sheet).findByText("Tipo");
    expect(kindLabel.nextElementSibling).toHaveTextContent("Quitação");
    const abated = within(sheet).getByText("Abatido da dívida");
    expect(abated.nextElementSibling).toHaveTextContent(/^R\$\s100,00$/);
    // "Abatido da dívida" vem logo depois de "Tipo" e antes de "Cotação"
    const terms = within(sheet)
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(terms.indexOf("Abatido da dívida")).toBe(terms.indexOf("Tipo") + 1);
    expect(terms.indexOf("Cotação")).toBeGreaterThan(terms.indexOf("Abatido da dívida"));
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("estorno de quitação: linha Tipo com o estorno e \"Devolvido à dívida\" (REVIEW-007 I-4)", async () => {
    storeSession();
    mockFetch({
      "GET /api/transactions/32": {
        body: {
          ...settlementInBtc,
          transactionId: 32,
          type: TransactionType.Reversal,
          // O estorno inverte origem e destino e herda tipo e efeito do original
          source: settlementInBtc.destination,
          destination: settlementInBtc.source,
          reversedTransactionId: 31,
        },
      },
    });
    const entry = makeEntry({
      transactionId: 32,
      type: TransactionType.Reversal,
      transferKind: TransferKind.Settlement,
      currency: Currency.BTC,
      amount: 0.0002,
      sourceName: "Cofre",
      destinationName: "Reserva BTC",
    });

    renderWithProviders(<TransactionDetailSheet entry={entry} onClose={vi.fn()} />);

    const sheet = await screen.findByRole("dialog", { name: "Lançamento" });
    const kindLabel = await within(sheet).findByText("Tipo");
    expect(kindLabel.nextElementSibling).toHaveTextContent("Estorno de quitação");
    const restored = within(sheet).getByText("Devolvido à dívida");
    expect(restored.nextElementSibling).toHaveTextContent(/^R\$\s100,00$/);
    expect(within(sheet).queryByText("Abatido da dívida")).not.toBeInTheDocument();
  });

  it("empréstimo na mesma moeda: linha Tipo sem Abatido da dívida", async () => {
    storeSession();
    mockFetch({
      "GET /api/transactions/31": {
        body: {
          ...settlementInBtc,
          source: { ...settlementInBtc.source, currency: Currency.BRL, name: "Nubank" },
          destination: { ...settlementInBtc.destination, currency: Currency.BRL, name: "Mesada" },
          sourceAmount: 100,
          destinationAmount: 100,
          quote: null,
          transferKind: TransferKind.Loan,
        },
      },
    });

    renderWithProviders(<TransactionDetailSheet entry={makeEntry()} onClose={vi.fn()} />);

    const sheet = await screen.findByRole("dialog", { name: "Lançamento" });
    const kindLabel = await within(sheet).findByText("Tipo");
    expect(kindLabel.nextElementSibling).toHaveTextContent("Empréstimo");
    expect(within(sheet).queryByText("Abatido da dívida")).not.toBeInTheDocument();
  });
});
