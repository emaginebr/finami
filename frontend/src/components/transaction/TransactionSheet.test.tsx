import { describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionSheet } from "./TransactionSheet";
import { Currency } from "../../types/api";
import { TransactionType } from "../../types/transaction";
import type { TransactionInfo } from "../../types/transaction";
import { makeWallet, storeSession } from "../../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../../test/utils";
import type { MockHandler, MockResponse } from "../../test/utils";
import { notifySuccess, notifyWarning } from "../../utils/notify";
import { reportOffline } from "../../utils/connectivity";

vi.mock("../../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/notify")>();
  return { ...actual, notifySuccess: vi.fn(), notifyError: vi.fn(), notifyWarning: vi.fn() };
});

const WALLETS = [
  makeWallet({ walletId: 1, name: "Nubank", balance: 1234.56 }),
  makeWallet({ walletId: 2, name: "Reserva BTC", currency: Currency.BTC, balance: 0.0025, estimatedBrl: 1280.85 }),
];

const QUOTE = { priceBrl: 512340, quotedAt: "2026-11-01T17:32:00Z", source: "coingecko" };

const makeTransaction = (overrides: Partial<TransactionInfo> = {}): TransactionInfo => ({
  transactionId: 501,
  type: TransactionType.ExternalIncome,
  source: { accountId: 900, name: "Externo", kind: "External", currency: Currency.BRL, ownerName: null },
  destination: { accountId: 1, name: "Nubank", kind: "Wallet", currency: Currency.BRL, ownerName: "Ana Silva" },
  sourceAmount: 100,
  destinationAmount: 100,
  quote: null,
  description: null,
  occurredAt: "2026-11-01T17:40:00Z",
  createdByUserId: 7,
  reversedTransactionId: null,
  reversedByTransactionId: null,
  ...overrides,
});

const setup = (routes: Record<string, MockResponse | MockHandler> = {}) => {
  storeSession();
  const fetchMock = mockFetch({ "GET /api/wallets": { body: WALLETS }, ...routes });
  const onOpenChange = vi.fn();
  const user = userEvent.setup();
  const view = renderWithProviders(
    <TransactionSheet open onOpenChange={onOpenChange} defaultWalletId={1} />,
  );
  return { fetchMock, onOpenChange, user, ...view };
};

type User = ReturnType<typeof userEvent.setup>;

const chooseType = async (user: User, label: "Entrada" | "Saída" | "Transferência") => {
  await user.click(await screen.findByRole("button", { name: new RegExp(`^${label}`) }));
  // A carteira padrão (Nubank) já aparece selecionada
  await screen.findByText("Nubank");
};

const pickDestination = async (user: User, option: RegExp) => {
  await user.click(screen.getByRole("button", { name: /^Para/ }));
  await user.click(await screen.findByRole("option", { name: option }));
};

describe("TransactionSheet", () => {
  it("Entrada válida envia amount como string, fecha e mostra o toast", async () => {
    const { fetchMock, onOpenChange, user } = setup({
      "POST /api/transactions/income": { status: 201, body: makeTransaction() },
    });

    await chooseType(user, "Entrada");
    await user.type(screen.getByLabelText("Valor"), "100,00");
    await user.click(screen.getByRole("button", { name: "Registrar entrada" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(requestsTo(fetchMock, "POST /api/transactions/income")).toEqual([
      { walletId: 1, amount: "100", description: null },
    ]);
    expect(notifySuccess).toHaveBeenCalledWith(expect.stringContaining("Entrada de R$"));
    expect(notifySuccess).toHaveBeenCalledWith(expect.stringContaining("Nubank"));
  });

  it("rede cai durante o envio: avisa para conferir o extrato e não reenvia (feature 005)", async () => {
    let calls = 0;
    const { onOpenChange, user } = setup({
      "POST /api/transactions/income": () => {
        calls += 1;
        throw new TypeError("Failed to fetch");
      },
    });

    await chooseType(user, "Entrada");
    await user.type(screen.getByLabelText("Valor"), "100,00");
    await user.click(screen.getByRole("button", { name: "Registrar entrada" }));

    expect(
      await screen.findByText(
        /Não foi possível confirmar o lançamento\. Verifique o extrato quando a conexão voltar\./,
      ),
    ).toBeInTheDocument();
    expect(calls).toBe(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("sem internet o envio fica aria-disabled e não chama a API (feature 005)", async () => {
    const { fetchMock, user } = setup();

    await chooseType(user, "Entrada");
    await user.type(screen.getByLabelText("Valor"), "100,00");
    act(() => reportOffline());
    const submit = screen.getByRole("button", { name: "Registrar entrada" });
    expect(submit).toHaveAttribute("aria-disabled", "true");
    await user.click(submit);

    expect(notifyWarning).toHaveBeenCalledWith("Sem internet. Conecte-se para fazer lançamentos.");
    expect(requestsTo(fetchMock, "POST /api/transactions/income")).toHaveLength(0);
  });

  it("bloqueia o envio de 0,001 em reais", async () => {
    const { fetchMock, user } = setup();

    await chooseType(user, "Saída");
    await user.type(screen.getByLabelText("Valor"), "0,001");

    expect(screen.getByText("Use no máximo 2 casas decimais para reais.")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Registrar saída" })).toBeDisabled();
    expect(requestsTo(fetchMock, "POST /api/transactions/expense")).toHaveLength(0);
  });

  it("bloqueia transferência com origem igual ao destino", async () => {
    const { user } = setup();

    await chooseType(user, "Transferência");
    await pickDestination(user, /^Nubank/);

    expect(await screen.findByText("A carteira de destino deve ser diferente da origem.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Valor"), "10");
    expect(screen.getByRole("button", { name: "Registrar transferência" })).toBeDisabled();
  });

  it("BRL → BTC mostra a prévia com BTC e cotação antes de confirmar", async () => {
    const { fetchMock, onOpenChange, user } = setup({
      "POST /api/transactions/transfer/preview": {
        body: { type: "BtcPurchase", sourceAmount: 500, destinationAmount: 0.00097591, quote: QUOTE },
      },
      "POST /api/transactions/transfer": {
        status: 201,
        body: makeTransaction({
          type: TransactionType.BtcPurchase,
          source: { accountId: 1, name: "Nubank", kind: "Wallet", currency: Currency.BRL, ownerName: "Ana Silva" },
          destination: { accountId: 2, name: "Reserva BTC", kind: "Wallet", currency: Currency.BTC, ownerName: "Ana Silva" },
          sourceAmount: 500,
          destinationAmount: 0.00097591,
        }),
      },
    });

    await chooseType(user, "Transferência");
    await pickDestination(user, /^Reserva BTC/);
    await user.type(screen.getByLabelText("Valor"), "500");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText(/0,00097591/)).toBeInTheDocument();
    expect(screen.getByText("Compra de bitcoin")).toBeInTheDocument();
    expect(screen.getByText("₿ 1 = R$ 512.340,00")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 1, destinationWalletId: 2, amount: "500", description: null },
    ]);
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Confirmar compra" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toHaveLength(1);
  });

  it("prévia com 503 desabilita Confirmar", async () => {
    const { user } = setup({
      "POST /api/transactions/transfer/preview": apiError(503, "Cotação indisponível."),
    });

    await chooseType(user, "Transferência");
    await pickDestination(user, /^Reserva BTC/);
    await user.type(screen.getByLabelText("Valor"), "500");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Cotação indisponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();
  });

  it("destino por código mostra o titular e exige confirmação", async () => {
    const { fetchMock, user } = setup({
      "GET /api/wallets/1042/public": {
        body: { walletId: 1042, name: "Viagem da Lu", currency: "BRL", ownerName: "Luísa Ramos", isActive: true },
      },
      "POST /api/transactions/transfer/preview": {
        body: { type: "Transfer", sourceAmount: 250, destinationAmount: 250, quote: null },
      },
    });

    await chooseType(user, "Transferência");
    await pickDestination(user, /Outra carteira \(código\)/);
    await user.type(await screen.findByLabelText("Código da carteira"), "1042");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText("Viagem da Lu")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Valor"), "250");
    const continueButton = screen.getByRole("button", { name: "Continuar" });
    expect(continueButton).toBeDisabled();

    await user.click(screen.getByLabelText("Confirmo que esta carteira é de Luísa Ramos"));
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);

    expect(await screen.findByText("Titular do destino")).toBeInTheDocument();
    expect(screen.getAllByText("Luísa Ramos").length).toBeGreaterThan(0);
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 1, destinationWalletId: 1042, amount: "250", description: null },
    ]);
  });

  it("422 mantém os dados e mostra a mensagem do servidor", async () => {
    const { user } = setup({
      "POST /api/transactions/expense": apiError(422, "Saldo insuficiente na carteira de origem."),
    });

    await chooseType(user, "Saída");
    await user.type(screen.getByLabelText("Valor"), "2000");
    await user.type(screen.getByLabelText(/Descrição/), "Notebook");
    await user.click(screen.getByRole("button", { name: "Registrar saída" }));

    expect(await screen.findByText("Saldo insuficiente na carteira de origem.")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor")).toHaveValue("2000");
    expect(screen.getByLabelText(/Descrição/)).toHaveValue("Notebook");
  });

  it("duplo clique envia uma única vez", async () => {
    let release: (() => void) | null = null;
    const { fetchMock, user } = setup({
      "POST /api/transactions/income": () =>
        new Promise<MockResponse>((resolve) => {
          release = () => resolve({ status: 201, body: makeTransaction() });
        }),
    });

    await chooseType(user, "Entrada");
    await user.type(screen.getByLabelText("Valor"), "100");
    await user.dblClick(screen.getByRole("button", { name: "Registrar entrada" }));

    expect(requestsTo(fetchMock, "POST /api/transactions/income")).toHaveLength(1);
    await waitFor(() => expect(release).not.toBeNull());
    (release as (() => void) | null)?.();
  });

  it("Esc fecha a folha e o foco fica preso nela", async () => {
    const { onOpenChange, user } = setup();

    const first = await screen.findByRole("button", { name: /^Entrada/ });
    expect(first).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Novo lançamento" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("não tem violações do axe no formulário", async () => {
    const { user } = setup();

    await chooseType(user, "Transferência");

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
