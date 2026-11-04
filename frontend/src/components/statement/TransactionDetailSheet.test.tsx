import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionDetailSheet } from "./TransactionDetailSheet";
import { Currency } from "../../types/api";
import { TransactionType, TransferKind } from "../../types/transaction";
import type { TransactionInfo } from "../../types/transaction";
import type { StatementEntryInfo } from "../../types/statement";
import { storeSession } from "../../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../../test/utils";
import type { MockHandler, MockResponse } from "../../test/utils";
import { notifyError } from "../../utils/notify";

vi.mock("../../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/notify")>();
  return { ...actual, notifySuccess: vi.fn(), notifyError: vi.fn() };
});

const makeEntry = (overrides: Partial<StatementEntryInfo> = {}): StatementEntryInfo => ({
  transactionId: 61204,
  occurredAt: "2026-11-03T17:32:00Z",
  type: TransactionType.ExternalExpense,
  sourceName: "Mesada",
  destinationName: "Externo",
  currency: Currency.BRL,
  amount: -80,
  quotePriceBrl: null,
  description: null,
  internal: false,
  ...overrides,
});

const makeTransaction = (overrides: Partial<TransactionInfo> = {}): TransactionInfo => ({
  transactionId: 61204,
  type: TransactionType.ExternalExpense,
  source: { accountId: 1, name: "Mesada", kind: "Wallet", currency: Currency.BRL, ownerName: "Bruno Silva" },
  destination: { accountId: 900, name: "Externo", kind: "ExternalSink", currency: Currency.BRL, ownerName: null },
  sourceAmount: 80,
  destinationAmount: 80,
  quote: null,
  description: null,
  occurredAt: "2026-11-03T17:32:00Z",
  createdByUserId: 9,
  reversedTransactionId: null,
  reversedByTransactionId: null,
  canReverse: true,
  ...overrides,
});

const setup = (entry: StatementEntryInfo, routes: Record<string, MockResponse | MockHandler>) => {
  storeSession();
  const fetchMock = mockFetch(routes);
  const user = userEvent.setup();
  const onClose = vi.fn();
  const view = renderWithProviders(<TransactionDetailSheet entry={entry} onClose={onClose} />);
  return { fetchMock, user, onClose, ...view };
};

/** Abre a confirmação e devolve o `alertdialog` */
const openConfirm = async (user: ReturnType<typeof userEvent.setup>) => {
  const sheet = await screen.findByRole("dialog", { name: "Lançamento" });
  await user.click(await within(sheet).findByRole("button", { name: "Estornar lançamento" }));
  return screen.findByRole("alertdialog", { name: /Estornar lançamento\?/ });
};

describe("TransactionDetailSheet — estorno (feature 008)", () => {
  beforeEach(() => {
    vi.mocked(notifyError).mockClear();
  });

  it("\"Estornar\" aparece quando o servidor diz canReverse", async () => {
    const { baseElement } = setup(makeEntry(), {
      "GET /api/transactions/61204": { body: makeTransaction({ canReverse: true }) },
    });

    const sheet = await screen.findByRole("dialog", { name: "Lançamento" });
    expect(await within(sheet).findByRole("button", { name: "Estornar lançamento" })).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("sem canReverse (ex.: membro sem \"Pode estornar\") não mostra \"Estornar\"", async () => {
    setup(makeEntry(), {
      "GET /api/transactions/61204": { body: makeTransaction({ canReverse: false }) },
    });

    const sheet = await screen.findByRole("dialog", { name: "Lançamento" });
    expect(await within(sheet).findByText("#61204")).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: "Estornar lançamento" })).not.toBeInTheDocument();
  });

  it("confirmação da despesa: \"R$ 80,00 voltam para Mesada.\" na descrição do alertdialog", async () => {
    const { baseElement, user } = setup(makeEntry(), {
      "GET /api/transactions/61204": { body: makeTransaction() },
    });

    const confirm = await openConfirm(user);
    expect(within(confirm).getByRole("heading", { name: "O que acontece" })).toBeInTheDocument();
    // Não vira landmark dentro do alertdialog (REVIEW-008 M-5)
    expect(within(confirm).queryByRole("region")).not.toBeInTheDocument();
    expect(confirm).toHaveTextContent("R$ 80,00 voltam para Mesada.");
    expect(confirm).toHaveAccessibleDescription(/R\$\s80,00 voltam para Mesada\./);
    expect(within(confirm).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("confirmação da compra de bitcoin: real volta e bitcoin sai, com 8 casas", async () => {
    const { user } = setup(
      makeEntry({ type: TransactionType.BtcPurchase, sourceName: "Nubank", destinationName: "Ledger", amount: -500 }),
      {
        "GET /api/transactions/61204": {
          body: makeTransaction({
            type: TransactionType.BtcPurchase,
            source: { accountId: 1, name: "Nubank", kind: "Wallet", currency: Currency.BRL, ownerName: "Ana Silva" },
            destination: { accountId: 2, name: "Ledger", kind: "Wallet", currency: Currency.BTC, ownerName: "Ana Silva" },
            sourceAmount: 500,
            destinationAmount: 0.001,
            quote: { priceBrl: 500000, quotedAt: "2026-11-03T17:32:00Z", source: "coingecko" },
          }),
        },
      },
    );

    const confirm = await openConfirm(user);
    expect(confirm).toHaveTextContent("R$ 500,00 voltam para Nubank e ₿ 0,00100000 saem de Ledger.");
  });

  it.each([
    [TransferKind.Loan, "A dívida de Bruno com Ana diminui R$ 100,00."],
    [TransferKind.Settlement, "A dívida de Ana com Bruno aumenta R$ 100,00."],
  ])("confirmação de %s: frase do dinheiro e efeito na dívida", async (kind, debtSentence) => {
    const { user } = setup(
      makeEntry({
        type: TransactionType.Transfer,
        sourceName: "Nubank",
        destinationName: "Mesada",
        amount: -100,
        transferKind: kind,
        debtCurrency: Currency.BRL,
        debtAmount: 100,
        sourceOwnerFirstName: "Ana",
        destinationOwnerFirstName: "Bruno",
      }),
      {
        "GET /api/transactions/61204": {
          body: makeTransaction({
            type: TransactionType.Transfer,
            source: { accountId: 1, name: "Nubank", kind: "Wallet", currency: Currency.BRL, ownerName: "Ana Silva" },
            destination: { accountId: 3, name: "Mesada", kind: "Wallet", currency: Currency.BRL, ownerName: "Bruno Silva" },
            sourceAmount: 100,
            destinationAmount: 100,
            transferKind: kind,
            debtCurrency: Currency.BRL,
            debtAmount: 100,
          }),
        },
      },
    );

    const confirm = await openConfirm(user);
    expect(confirm).toHaveTextContent("R$ 100,00 voltam para Nubank e R$ 100,00 saem de Mesada.");
    expect(confirm).toHaveTextContent(debtSentence);
  });

  it("pagamento: só a frase do dinheiro, sem efeito na dívida", async () => {
    const { user } = setup(makeEntry({ type: TransactionType.Transfer, amount: -50, transferKind: TransferKind.Payment }), {
      "GET /api/transactions/61204": {
        body: makeTransaction({
          type: TransactionType.Transfer,
          destination: { accountId: 3, name: "Cofre", kind: "Wallet", currency: Currency.BRL, ownerName: "Caio Silva" },
          sourceAmount: 50,
          destinationAmount: 50,
          transferKind: TransferKind.Payment,
        }),
      },
    });

    const confirm = await openConfirm(user);
    expect(confirm).toHaveTextContent("R$ 50,00 voltam para Mesada e R$ 50,00 saem de Cofre.");
    expect(confirm).not.toHaveTextContent(/dívida/);
  });

  it("estorno mostra \"Estorno de #id\", que abre o original na mesma folha, e \"Voltar\" retorna", async () => {
    const { baseElement, user } = setup(
      makeEntry({ transactionId: 61250, type: TransactionType.Reversal, amount: 80 }),
      {
        "GET /api/transactions/61250": {
          body: makeTransaction({
            transactionId: 61250,
            type: TransactionType.Reversal,
            source: makeTransaction().destination,
            destination: makeTransaction().source,
            reversedTransactionId: 61204,
            canReverse: false,
          }),
        },
        "GET /api/transactions/61204": {
          body: makeTransaction({ reversedByTransactionId: 61250, canReverse: false }),
        },
      },
    );

    const sheet = await screen.findByRole("dialog", { name: "Lançamento" });
    const link = await within(sheet).findByRole("button", { name: /Estorno de #61204/ });
    expect(link).toHaveAccessibleName(/^Estorno de #61204\s*Abrir o lançamento original$/);
    // Um estorno nunca mostra "Estornar"
    expect(within(sheet).queryByRole("button", { name: "Estornar lançamento" })).not.toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(link);

    // O original estornado: valor riscado, ligação de volta ao estorno
    const back = await within(sheet).findByRole("button", { name: /Estornado por #61250/ });
    expect(back).toHaveAccessibleName(/^Estornado por #61250\s*Abrir o estorno$/);
    expect(within(sheet).getByText("#61204")).toBeInTheDocument();
    expect(within(sheet).getByText("estornado")).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Voltar" }));
    const again = await within(sheet).findByRole("button", { name: /Estorno de #61204/ });
    await waitFor(() => expect(again).toHaveFocus());
    expect(within(sheet).queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
  });

  it("409 no estorno: toast com a mensagem, a confirmação fecha e o detalhe recarrega", async () => {
    let loads = 0;
    const { fetchMock, user } = setup(makeEntry(), {
      "GET /api/transactions/61204": () => {
        loads += 1;
        return loads === 1
          ? { body: makeTransaction() }
          : { body: makeTransaction({ reversedByTransactionId: 61250, canReverse: false }) };
      },
      "POST /api/transactions/61204/reverse": apiError(409, "Este lançamento já foi estornado."),
    });

    const confirm = await openConfirm(user);
    await user.click(within(confirm).getByRole("button", { name: "Estornar" }));

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const sheet = screen.getByRole("dialog", { name: "Lançamento" });
    expect(await within(sheet).findByRole("button", { name: /Estornado por #61250/ })).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: "Estornar lançamento" })).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/transactions/61204/reverse")).toHaveLength(1);
    // O foco vai para o resumo do lançamento, não para o contêiner da folha (REVIEW-008 M-4)
    await waitFor(() => {
      const focused = document.activeElement as HTMLElement;
      expect(focused).toHaveAttribute("tabindex", "-1");
      expect(focused).not.toHaveAttribute("role", "dialog");
      expect(focused).toHaveTextContent(/R\$\s80,00/);
    });
  });
});
