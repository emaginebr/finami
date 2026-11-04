import { describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransactionPage from "./TransactionPage";
import { Currency } from "../types/api";
import { DebtDirection } from "../types/debt";
import type { PersonDebt } from "../types/debt";
import { TransactionKind, TransactionType, TransferKind } from "../types/transaction";
import type { TransactionInfo } from "../types/transaction";
import type { TransferDestination, TransferDestinationsResult } from "../types/wallet";
import { makeGroup, makeWallet, storeSession } from "../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../test/utils";
import type { MockHandler, MockResponse } from "../test/utils";
import { notifyError, notifySuccess, notifyWarning } from "../utils/notify";
import { reportOffline } from "../utils/connectivity";

vi.mock("../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/notify")>();
  return { ...actual, notifySuccess: vi.fn(), notifyError: vi.fn(), notifyWarning: vi.fn() };
});

const WALLETS = [
  makeWallet({ walletId: 1, name: "Nubank", balance: 1234.56 }),
  makeWallet({ walletId: 2, name: "Reserva BTC", currency: Currency.BTC, balance: 0.0025, estimatedBrl: 1280.85 }),
];

const QUOTE = { priceBrl: 512340, quotedAt: "2026-11-01T17:32:00Z", source: "coingecko" };

const makeDestination = (overrides: Partial<TransferDestination> = {}): TransferDestination => ({
  walletId: 6,
  name: "Poupança",
  currency: Currency.BRL,
  ownerUserId: 7,
  ownerFirstName: "Ana",
  isOwn: true,
  balance: 300,
  ...overrides,
});

const POUPANCA = makeDestination();
const MESADA = makeDestination({ walletId: 12, name: "Mesada", ownerUserId: 9, ownerFirstName: "Bruno", isOwn: false, balance: null });
const RESERVA_AS_DESTINATION = makeDestination({
  walletId: 2,
  name: "Reserva BTC",
  currency: Currency.BTC,
  balance: 0.0025,
});
const COFRE = makeDestination({
  walletId: 14,
  name: "Cofre",
  currency: Currency.BTC,
  ownerUserId: 9,
  ownerFirstName: "Bruno",
  isOwn: false,
  balance: 0.001,
});
const NUBANK_AS_DESTINATION = makeDestination({ walletId: 1, name: "Nubank", balance: 1234.56 });

/** Destinos da Nubank (real): família em real + Reserva BTC para converter */
const FROM_NUBANK: TransferDestinationsResult = {
  sourceWalletId: 1,
  sameCurrency: [POUPANCA, MESADA],
  conversion: [RESERVA_AS_DESTINATION],
};

/** Destinos da Reserva BTC (bitcoin): Cofre do Bruno + Nubank para vender */
const FROM_RESERVA: TransferDestinationsResult = {
  sourceWalletId: 2,
  sameCurrency: [COFRE],
  conversion: [NUBANK_AS_DESTINATION],
};

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
  canReverse: true,
  ...overrides,
});

const PATHS: Record<TransactionKind, string> = {
  [TransactionKind.Income]: "/depositar",
  [TransactionKind.Expense]: "/sacar",
  [TransactionKind.Transfer]: "/transferir",
};

/** Abre a página do tipo pedido vindo do extrato da carteira (pré-selecionada por `?carteira=`) */
const setup = (
  kind: TransactionKind,
  routes: Record<string, MockResponse | MockHandler> = {},
  walletId: number = 1,
) => {
  storeSession();
  const fetchMock = mockFetch({
    "GET /api/wallets": { body: WALLETS },
    "GET /api/groups": { body: [] },
    "GET /api/wallets/1/transfer-destinations": { body: FROM_NUBANK },
    "GET /api/wallets/2/transfer-destinations": { body: FROM_RESERVA },
    ...routes,
  });
  const user = userEvent.setup();
  const view = renderWithProviders(<TransactionPage kind={kind} />, {
    path: PATHS[kind],
    initialEntries: [
      `/carteiras/${walletId}`,
      { pathname: PATHS[kind], search: `?carteira=${walletId}`, state: { backTo: `/carteiras/${walletId}` } },
    ],
    extraRoutes: [{ path: "/carteiras/:walletId", element: <p>Extrato</p> }],
  });
  return { fetchMock, user, ...view };
};

type User = ReturnType<typeof userEvent.setup>;

/** A carteira pré-selecionada já aparece no formulário (nome acessível do campo De) */
const ready = (name: RegExp = /^De Ana, Nubank,/) => screen.findByRole("button", { name });

const paraButton = () => screen.getByRole("button", { name: /^Para/ });

const pickDestination = async (user: User, option: RegExp) => {
  await user.click(paraButton());
  await user.click(await screen.findByRole("option", { name: option }));
};

const pickSource = async (user: User, option: RegExp) => {
  await user.click(screen.getByRole("button", { name: /^De/ }));
  await user.click(await screen.findByRole("option", { name: option }));
};

/** Seletor "Tipo" da transferência entre pessoas (feature 007) */
const kindGroup = () => screen.getByRole("radiogroup", { name: "Tipo" });

const pickKind = async (user: User, name: "Empréstimo" | "Quitação" | "Pagamento") => {
  await user.click(within(kindGroup()).getByRole("radio", { name }));
};

describe("TransactionPage", () => {
  it("Depósito válido envia amount como string, volta ao extrato e mostra o toast", async () => {
    const { fetchMock, router, user } = setup(TransactionKind.Income, {
      "POST /api/transactions/income": { status: 201, body: makeTransaction() },
    });

    await ready(/^Carteira Ana, Nubank,/);
    await user.type(screen.getByLabelText("Valor"), "100,00");
    await user.click(screen.getByRole("button", { name: "Registrar depósito" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/1"));
    expect(requestsTo(fetchMock, "POST /api/transactions/income")).toEqual([
      { walletId: 1, amount: "100", description: null },
    ]);
    expect(notifySuccess).toHaveBeenCalledWith(expect.stringContaining("Depósito de R$"));
    expect(notifySuccess).toHaveBeenCalledWith(expect.stringContaining("Nubank"));
  });

  it("rede cai durante o envio: avisa para conferir o extrato e não reenvia (feature 005)", async () => {
    let calls = 0;
    const { router, user } = setup(TransactionKind.Income, {
      "POST /api/transactions/income": () => {
        calls += 1;
        throw new TypeError("Failed to fetch");
      },
    });

    await ready(/^Carteira Ana, Nubank,/);
    await user.type(screen.getByLabelText("Valor"), "100,00");
    await user.click(screen.getByRole("button", { name: "Registrar depósito" }));

    expect(
      await screen.findByText(
        /Não foi possível confirmar o lançamento\. Verifique o extrato quando a conexão voltar\./,
      ),
    ).toBeInTheDocument();
    expect(calls).toBe(1);
    expect(router.state.location.pathname).toBe("/depositar");
  });

  it("sem internet o envio fica aria-disabled e não chama a API (feature 005)", async () => {
    const { fetchMock, user } = setup(TransactionKind.Income);

    await ready(/^Carteira Ana, Nubank,/);
    await user.type(screen.getByLabelText("Valor"), "100,00");
    act(() => reportOffline());
    const submit = screen.getByRole("button", { name: "Registrar depósito" });
    expect(submit).toHaveAttribute("aria-disabled", "true");
    await user.click(submit);

    expect(notifyWarning).toHaveBeenCalledWith("Sem internet. Conecte-se para fazer lançamentos.");
    expect(requestsTo(fetchMock, "POST /api/transactions/income")).toHaveLength(0);
  });

  it("depósito em carteira bitcoin: alternador Bitcoin | Satoshis | Reais; satoshis viram BTC de 8 casas", async () => {
    const { container, fetchMock, router, user } = setup(
      TransactionKind.Income,
      { "POST /api/transactions/income": { status: 201, body: makeTransaction() } },
      2,
    );

    await ready(/^Carteira Ana, Reserva BTC,/);
    const toggle = screen.getByRole("group", { name: "Informar valor em" });
    expect(within(toggle).getAllByRole("button").map((b) => b.textContent)).toEqual(["Bitcoin", "Satoshis", "Reais"]);
    expect(within(toggle).getByRole("button", { name: "Bitcoin" })).toHaveAttribute("aria-pressed", "true");
    expect(await axe(container)).toHaveNoViolations();

    await user.click(within(toggle).getByRole("button", { name: "Satoshis" }));
    await user.type(screen.getByLabelText("Valor"), "12345");
    await user.click(screen.getByRole("button", { name: "Registrar depósito" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/2"));
    expect(requestsTo(fetchMock, "POST /api/transactions/income")).toEqual([
      { walletId: 2, amount: "0.00012345", description: null },
    ]);
  });

  it("saque em carteira bitcoin informado em reais: converte pela cotação e envia o BTC exibido", async () => {
    const { fetchMock, router, user } = setup(
      TransactionKind.Expense,
      {
        "GET /api/quotes/btc": { body: { ...QUOTE, isStale: false } },
        "POST /api/transactions/expense": { status: 201, body: makeTransaction() },
      },
      2,
    );

    await ready(/^Carteira Ana, Reserva BTC,/);
    await user.click(screen.getByRole("button", { name: "Reais" }));
    expect(screen.getByLabelText("Valor")).toHaveAccessibleDescription(/em reais/);
    await user.type(screen.getByLabelText("Valor"), "500");

    // R$ 500 / R$ 512.340 = ₿ 0,00097591 (truncado em 8 casas)
    expect(await screen.findByText(/^= ₿\s0,00097591 \(₿ 1 = R\$\s512\.340,00\)$/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registrar saque" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/2"));
    expect(requestsTo(fetchMock, "POST /api/transactions/expense")).toEqual([
      { walletId: 2, amount: "0.00097591", description: null },
    ]);
  });

  it("saque em reais sem cotação: avisa e não envia", async () => {
    const { fetchMock, user } = setup(
      TransactionKind.Expense,
      { "GET /api/quotes/btc": { status: 503, body: { message: "Cotação indisponível." } } },
      2,
    );

    await ready(/^Carteira Ana, Reserva BTC,/);
    await user.click(screen.getByRole("button", { name: "Reais" }));
    await user.type(screen.getByLabelText("Valor"), "500");

    expect(await screen.findByText("Cotação do bitcoin indisponível no momento.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar saque" })).toBeDisabled();
    expect(requestsTo(fetchMock, "POST /api/transactions/expense")).toHaveLength(0);
  });

  it("bloqueia o envio de 0,001 em reais", async () => {
    const { fetchMock, user } = setup(TransactionKind.Expense);

    await ready(/^Carteira Ana, Nubank,/);
    await user.type(screen.getByLabelText("Valor"), "0,001");

    expect(screen.getByText("Use no máximo 2 casas decimais para reais.")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Registrar saque" })).toBeDisabled();
    expect(requestsTo(fetchMock, "POST /api/transactions/expense")).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Campos De e Para (feature 006, US2)
  // -------------------------------------------------------------------------

  it("opções do De mostram tipo, primeiro nome e saldo, sem o nome da carteira na tela", async () => {
    const { user } = setup(TransactionKind.Transfer);

    await ready();
    await user.click(screen.getByRole("button", { name: /^De/ }));

    const listbox = await screen.findByRole("listbox", { name: "Carteira" });
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAccessibleName(/^Ana, Nubank, real, saldo R\$\s1\.234,56$/);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAccessibleName(/^Ana, Reserva BTC, bitcoin, saldo ₿\s0,00250$/);
    expect(within(options[1]!).getByText("Ana")).toBeInTheDocument();
  });

  it("Para lista a família na mesma moeda (sem a origem) e o grupo Converter", async () => {
    const { container, user } = setup(TransactionKind.Transfer);

    await ready();
    await user.click(paraButton());

    const listbox = await screen.findByRole("listbox", { name: "Destino" });
    const family = within(listbox).getByRole("group", { name: "Família" });
    expect(within(family).getAllByRole("option").map((o) => o.getAttribute("aria-label"))).toEqual([
      expect.stringMatching(/^Ana, Poupança, real, saldo R\$\s300,00$/),
      "Bruno, Mesada, real, saldo oculto",
    ]);
    const conversion = within(listbox).getByRole("group", { name: "Converter" });
    expect(within(conversion).getByRole("option", { name: /^Ana, Reserva BTC, bitcoin/ })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: /Nubank/ })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(within(family).getByRole("option", { name: /Mesada/ }));
    expect(await screen.findByRole("button", { name: /^Para Bruno, Mesada, real, saldo oculto$/ })).toBeInTheDocument();
  });

  it("não oferece mais destino por código da carteira (FR-013)", async () => {
    const { user } = setup(TransactionKind.Transfer);

    await ready();
    await user.click(paraButton());
    await screen.findByRole("listbox", { name: "Destino" });

    expect(screen.queryByRole("option", { name: /código/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Código da carteira")).not.toBeInTheDocument();
  });

  it("trocar o De recarrega o Para e limpa o destino que deixou de valer (FR-019)", async () => {
    const { fetchMock, user } = setup(TransactionKind.Transfer);

    await ready();
    await pickDestination(user, /Mesada/);
    expect(paraButton()).toHaveAccessibleName(/^Para Bruno, Mesada,/);

    await pickSource(user, /Reserva BTC/);

    await waitFor(() => expect(paraButton()).toHaveAccessibleName("Para Escolher destino"));
    expect(requestsTo(fetchMock, "GET /api/wallets/2/transfer-destinations")).toHaveLength(1);

    await user.click(paraButton());
    const listbox = await screen.findByRole("listbox", { name: "Destino" });
    expect(
      within(within(listbox).getByRole("group", { name: "Família" })).getByRole("option", { name: /Cofre/ }),
    ).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: /Mesada/ })).not.toBeInTheDocument();
  });

  it("sem destinos: aviso no lugar do Para e \"Continuar\" aria-disabled, focável, com a explicação (REVIEW-006 M-1)", async () => {
    const { container, fetchMock, user } = setup(TransactionKind.Transfer, {
      "GET /api/wallets/1/transfer-destinations": {
        body: { sourceWalletId: 1, sameCurrency: [], conversion: [] },
      },
    });

    await ready();
    const notice = await screen.findByText(
      "Não há carteiras para transferir. Só é possível transferir para pessoas da sua família, na mesma moeda.",
    );
    expect(notice.closest("[role='status']")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /^Para/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Valor"), "10");
    expect(screen.queryByRole("button", { name: "Registrar transferência" })).not.toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Continuar" });
    // aria-disabled (não disabled): continua na ordem de Tab e a explicação é lida ao chegar nele
    expect(submit).not.toBeDisabled();
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit).toHaveAccessibleDescription(/Não há carteiras para transferir/);
    await user.click(screen.getByLabelText(/Descrição/));
    await user.tab();
    expect(submit).toHaveFocus();

    // Tocar (ou Enter) não faz nada
    await user.click(submit);
    await user.keyboard("{Enter}");
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toHaveLength(0);
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toHaveLength(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  // -------------------------------------------------------------------------
  // Foco e teclado nos passos (REVIEW-006 I-1 e I-2)
  // -------------------------------------------------------------------------

  it("o foco volta ao campo que abriu o seletor, vai para o título da prévia e para o Continuar ao voltar (I-1)", async () => {
    const { user } = setup(TransactionKind.Transfer, {
      "POST /api/transactions/transfer/preview": {
        body: { type: "Transfer", sourceAmount: 250, destinationAmount: 250, quote: null },
      },
    });

    await ready();
    // De: escolher uma opção devolve o foco ao campo De
    await pickSource(user, /Nubank/);
    await waitFor(() => expect(screen.getByRole("button", { name: /^De Ana, Nubank,/ })).toHaveFocus());

    // Para: idem
    await pickDestination(user, /Mesada/);
    await waitFor(() => expect(paraButton()).toHaveFocus());

    // "‹ Voltar" do seletor também devolve ao campo que o abriu
    await user.click(paraButton());
    await screen.findByRole("listbox", { name: "Destino" });
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() => expect(paraButton()).toHaveFocus());

    // Prévia: foco no título do passo
    await pickKind(user, "Pagamento");
    await user.type(screen.getByLabelText("Valor"), "250");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    const title = await screen.findByRole("heading", { level: 2, name: "Confirmar transferência" });
    await waitFor(() => expect(title).toHaveFocus());
    expect(await screen.findByText("Titular do destino")).toBeInTheDocument();

    // Voltar da prévia: foco no "Continuar", valor preservado
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toHaveFocus());
    expect(screen.getByLabelText("Valor")).toHaveValue("250");
  });

  it("seletor do De: uma parada de Tab, setas, Home/End e aria-selected na escolhida (I-2)", async () => {
    const { user } = setup(TransactionKind.Transfer);

    await ready();
    await user.click(screen.getByRole("button", { name: /^De/ }));
    const listbox = await screen.findByRole("listbox", { name: "Carteira" });
    const options = within(listbox).getAllByRole("option");

    // Abre na selecionada, que é a única parada de Tab
    await waitFor(() => expect(options[0]).toHaveFocus());
    expect(options.map((option) => option.tabIndex)).toEqual([0, -1]);

    await user.keyboard("{ArrowDown}");
    expect(options[1]).toHaveFocus();
    expect(options.map((option) => option.tabIndex)).toEqual([-1, 0]);
    // Mover o foco não muda a seleção
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");

    await user.keyboard("{Home}");
    expect(options[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(options[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(options[0]).toHaveFocus();

    // Tab sai do listbox (não passa por cada opção)
    await user.tab();
    expect(document.activeElement?.getAttribute("role")).not.toBe("option");
  });

  it("seletor do Para: as setas atravessam os grupos e Enter escolhe (I-2)", async () => {
    const { container, user } = setup(TransactionKind.Transfer);

    await ready();
    await user.click(paraButton());
    const listbox = await screen.findByRole("listbox", { name: "Destino" });
    // Poupança e Mesada (Família) → Reserva BTC (Converter)
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(3);

    await waitFor(() => expect(options[0]).toHaveFocus());
    expect(options.map((option) => option.tabIndex)).toEqual([0, -1, -1]);

    await user.keyboard("{ArrowDown}");
    expect(options[1]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(options[2]).toHaveFocus();
    expect(within(listbox).getByRole("group", { name: "Converter" })).toContainElement(options[2]!);
    // Na última, ArrowDown não sai da lista
    await user.keyboard("{ArrowDown}");
    expect(options[2]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(options[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(options[2]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(options[1]).toHaveFocus();
    expect(await axe(container)).toHaveNoViolations();

    await user.keyboard("{Enter}");
    const para = await screen.findByRole("button", { name: /^Para Bruno, Mesada,/ });
    await waitFor(() => expect(para).toHaveFocus());

    // Reabrir: a parada de Tab é a opção escolhida
    await user.click(para);
    const reopened = await screen.findByRole("option", { name: /Mesada/ });
    expect(reopened).toHaveAttribute("aria-selected", "true");
    expect(reopened).toHaveAttribute("tabindex", "0");
    await waitFor(() => expect(reopened).toHaveFocus());
  });

  it("transferência para a família passa pela confirmação com o titular e registra", async () => {
    const { fetchMock, router, user } = setup(TransactionKind.Transfer, {
      "POST /api/transactions/transfer/preview": {
        body: { type: "Transfer", sourceAmount: 250, destinationAmount: 250, quote: null, kind: "payment", debt: null },
      },
      "POST /api/transactions/transfer": {
        status: 201,
        body: makeTransaction({
          type: TransactionType.Transfer,
          source: { accountId: 1, name: "Nubank", kind: "Wallet", currency: Currency.BRL, ownerName: "Ana Silva" },
          destination: { accountId: 12, name: "Mesada", kind: "Wallet", currency: Currency.BRL, ownerName: "Bruno Souza" },
          sourceAmount: 250,
          destinationAmount: 250,
        }),
      },
    });

    await ready();
    await pickDestination(user, /Mesada/);
    await pickKind(user, "Pagamento");
    await user.type(screen.getByLabelText("Valor"), "250");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Titular do destino")).toBeInTheDocument();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 1, destinationWalletId: 12, amount: "250", kind: "payment", description: null },
    ]);

    await user.click(screen.getByRole("button", { name: "Registrar pagamento" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/1"));
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toEqual([
      { sourceWalletId: 1, destinationWalletId: 12, amount: "250", kind: "payment", description: null },
    ]);
  });

  it("422 \"Só é possível transferir…\" aparece no topo do formulário", async () => {
    const { user } = setup(TransactionKind.Transfer, {
      "POST /api/transactions/transfer/preview": apiError(422, "Só é possível transferir para pessoas da sua família."),
    });

    await ready();
    await pickDestination(user, /Mesada/);
    await pickKind(user, "Pagamento");
    await user.type(screen.getByLabelText("Valor"), "250");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Só é possível transferir para pessoas da sua família.");
    expect(screen.getByLabelText("Valor")).toHaveValue("250");
  });

  it("BRL → BTC mostra a prévia com BTC e cotação antes de confirmar", async () => {
    const { fetchMock, router, user } = setup(TransactionKind.Transfer, {
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

    await ready();
    await pickDestination(user, /Reserva BTC/);
    // Conversão real → bitcoin: sem alternador (só bitcoin → bitcoin)
    expect(screen.queryByRole("group", { name: "Informar valor em" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Valor"), "500");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText(/0,00097/)).toBeInTheDocument();
    expect(screen.getByText("Compra de bitcoin")).toBeInTheDocument();
    expect(screen.getByText("₿ 1 = R$ 512.340,00")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 1, destinationWalletId: 2, amount: "500", description: null },
    ]);
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Confirmar compra" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/1"));
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toHaveLength(1);
  });

  it("prévia com 503 desabilita Confirmar", async () => {
    const { user } = setup(TransactionKind.Transfer, {
      "POST /api/transactions/transfer/preview": apiError(503, "Cotação indisponível."),
    });

    await ready();
    await pickDestination(user, /Reserva BTC/);
    await user.type(screen.getByLabelText("Valor"), "500");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Cotação indisponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar compra" })).toBeDisabled();
    // Fora do modo "Reais" não há "Informar em bitcoin"
    expect(screen.queryByRole("button", { name: "Informar em bitcoin" })).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Bitcoin informado em reais (feature 006, US4)
  // -------------------------------------------------------------------------

  it("alternador só aparece com De e Para em bitcoin e volta para bitcoin fora disso", async () => {
    const { container, user } = setup(TransactionKind.Transfer, {}, 2);

    await ready(/^De Ana, Reserva BTC,/);
    expect(screen.queryByRole("group", { name: "Informar valor em" })).not.toBeInTheDocument();

    await pickDestination(user, /Cofre/);
    const toggle = screen.getByRole("group", { name: "Informar valor em" });
    const btc = within(toggle).getByRole("button", { name: "Bitcoin" });
    const brl = within(toggle).getByRole("button", { name: "Reais" });
    expect(btc).toHaveAttribute("aria-pressed", "true");
    expect(brl).toHaveAttribute("aria-pressed", "false");
    expect(await axe(container)).toHaveNoViolations();

    // Trocar de unidade limpa o valor e o campo passa a ser em reais
    await user.type(screen.getByLabelText("Valor"), "0,001");
    await user.click(brl);
    expect(brl).toHaveAttribute("aria-pressed", "true");
    expect(brl).toHaveFocus();
    expect(screen.getByLabelText("Valor")).toHaveValue("");
    expect(screen.getByLabelText("Valor")).toHaveAccessibleDescription(/em reais/);
    await user.type(screen.getByLabelText("Valor"), "200");

    // Para em real (venda): o alternador some; ao voltar para o Cofre, está em bitcoin
    await pickDestination(user, /Nubank/);
    expect(screen.queryByRole("group", { name: "Informar valor em" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Valor")).toHaveValue("");
    await pickDestination(user, /Cofre/);
    expect(within(screen.getByRole("group", { name: "Informar valor em" })).getByRole("button", { name: "Bitcoin" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("em reais: prévia com amountBrl, confirmação com BTC de 8 casas e registro com o BTC da prévia", async () => {
    const { fetchMock, router, user } = setup(
      TransactionKind.Transfer,
      {
        "POST /api/transactions/transfer/preview": {
          body: {
            type: "Transfer",
            sourceAmount: 0.0004,
            destinationAmount: 0.0004,
            quote: { priceBrl: 500000, quotedAt: "2026-11-01T17:32:00Z", source: "coingecko" },
          },
        },
        "POST /api/transactions/transfer": {
          status: 201,
          body: makeTransaction({
            type: TransactionType.Transfer,
            source: { accountId: 2, name: "Reserva BTC", kind: "Wallet", currency: Currency.BTC, ownerName: "Ana Silva" },
            destination: { accountId: 14, name: "Cofre", kind: "Wallet", currency: Currency.BTC, ownerName: "Bruno Souza" },
            sourceAmount: 0.0004,
            destinationAmount: 0.0004,
          }),
        },
      },
      2,
    );

    await ready(/^De Ana, Reserva BTC,/);
    await pickDestination(user, /Cofre/);
    await pickKind(user, "Empréstimo");
    await user.click(screen.getByRole("button", { name: "Reais" }));
    await user.type(screen.getByLabelText("Valor"), "200");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Valor informado")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 2, destinationWalletId: 14, amountBrl: "200", kind: "loan", description: null },
    ]);
    expect(screen.getByText(/^R\$\s200,00$/)).toBeInTheDocument();
    expect(screen.getByText("Valor em bitcoin")).toBeInTheDocument();
    expect(screen.getByText(/^₿\s0,00040000$/)).toBeInTheDocument();
    expect(screen.getByText(/^= R\$\s200,00 informados$/)).toBeInTheDocument();
    expect(screen.getByText("₿ 1 = R$ 500.000,00")).toBeInTheDocument();
    expect(screen.getByText("Obtida às")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Registrar empréstimo" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/2"));
    // Regra existente (R-07) composta com o tipo: o registro envia o BTC da prévia
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toEqual([
      { sourceWalletId: 2, destinationWalletId: 14, amount: "0.0004", kind: "loan", description: null },
    ]);
  });

  it("em satoshis: o valor inteiro vira BTC com 8 casas na prévia e no registro", async () => {
    const { fetchMock, router, user } = setup(
      TransactionKind.Transfer,
      {
        "POST /api/transactions/transfer/preview": {
          body: { type: "Transfer", sourceAmount: 0.00012345, destinationAmount: 0.00012345, quote: null },
        },
        "POST /api/transactions/transfer": {
          status: 201,
          body: makeTransaction({
            type: TransactionType.Transfer,
            source: { accountId: 2, name: "Reserva BTC", kind: "Wallet", currency: Currency.BTC, ownerName: "Ana Silva" },
            destination: { accountId: 14, name: "Cofre", kind: "Wallet", currency: Currency.BTC, ownerName: "Bruno Souza" },
            sourceAmount: 0.00012345,
            destinationAmount: 0.00012345,
          }),
        },
      },
      2,
    );

    await ready(/^De Ana, Reserva BTC,/);
    await pickDestination(user, /Cofre/);
    await pickKind(user, "Pagamento");
    const sats = screen.getByRole("button", { name: "Satoshis" });
    await user.click(sats);
    expect(sats).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Valor")).toHaveAccessibleDescription(/em satoshis/);

    // Satoshi não tem casas decimais
    await user.type(screen.getByLabelText("Valor"), "1,5");
    expect(screen.getByText("Satoshis são números inteiros, sem vírgula.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Valor"));
    await user.type(screen.getByLabelText("Valor"), "12345");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByRole("button", { name: "Registrar pagamento" });
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 2, destinationWalletId: 14, amount: "0.00012345", kind: "payment", description: null },
    ]);

    await user.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/2"));
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toEqual([
      { sourceWalletId: 2, destinationWalletId: 14, amount: "0.00012345", kind: "payment", description: null },
    ]);
  });

  it("em reais com cotação indisponível: \"Informar em bitcoin\" volta ao formulário em bitcoin", async () => {
    const { user } = setup(
      TransactionKind.Transfer,
      { "POST /api/transactions/transfer/preview": apiError(503, "Cotação indisponível.") },
      2,
    );

    await ready(/^De Ana, Reserva BTC,/);
    await pickDestination(user, /Cofre/);
    await pickKind(user, "Pagamento");
    await user.click(screen.getByRole("button", { name: "Reais" }));
    await user.type(screen.getByLabelText("Valor"), "200");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Cotação indisponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar pagamento" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Informar em bitcoin" }));

    const amount = await screen.findByLabelText("Valor");
    expect(amount).toHaveValue("");
    expect(amount).toHaveFocus();
    expect(screen.getByRole("button", { name: "Bitcoin" })).toHaveAttribute("aria-pressed", "true");
    expect(amount).toHaveAccessibleDescription(/em bitcoin/);
  });

  it("em reais com valor pequeno demais mostra a mensagem do servidor e não registra", async () => {
    const { fetchMock, user } = setup(
      TransactionKind.Transfer,
      { "POST /api/transactions/transfer/preview": apiError(422, "Valor pequeno demais para conversão.") },
      2,
    );

    await ready(/^De Ana, Reserva BTC,/);
    await pickDestination(user, /Cofre/);
    await pickKind(user, "Pagamento");
    await user.click(screen.getByRole("button", { name: "Reais" }));
    await user.type(screen.getByLabelText("Valor"), "0,01");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Valor pequeno demais para conversão.");
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Gerais
  // -------------------------------------------------------------------------

  it("422 mantém os dados e mostra a mensagem do servidor", async () => {
    const { user } = setup(TransactionKind.Expense, {
      "POST /api/transactions/expense": apiError(422, "Saldo insuficiente na carteira de origem."),
    });

    await ready(/^Carteira Ana, Nubank,/);
    await user.type(screen.getByLabelText("Valor"), "2000");
    await user.type(screen.getByLabelText(/Descrição/), "Notebook");
    await user.click(screen.getByRole("button", { name: "Registrar saque" }));

    expect(await screen.findByText("Saldo insuficiente na carteira de origem.")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor")).toHaveValue("2000");
    expect(screen.getByLabelText(/Descrição/)).toHaveValue("Notebook");
  });

  it("duplo clique envia uma única vez", async () => {
    let release: (() => void) | null = null;
    const { fetchMock, user } = setup(TransactionKind.Income, {
      "POST /api/transactions/income": () =>
        new Promise<MockResponse>((resolve) => {
          release = () => resolve({ status: 201, body: makeTransaction() });
        }),
    });

    await ready(/^Carteira Ana, Nubank,/);
    await user.type(screen.getByLabelText("Valor"), "100");
    await user.dblClick(screen.getByRole("button", { name: "Registrar depósito" }));

    expect(requestsTo(fetchMock, "POST /api/transactions/income")).toHaveLength(1);
    await waitFor(() => expect(release).not.toBeNull());
    (release as (() => void) | null)?.();
  });

  it("é uma página (não um modal) com o título do tipo e o voltar para a origem", async () => {
    setup(TransactionKind.Expense);
    await ready(/^Carteira Ana, Nubank,/);

    expect(screen.getByRole("heading", { level: 1, name: "Sacar" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", "/carteiras/1");
    // Cada página tem um tipo só: não há troca de tipo no formulário
    expect(screen.queryByRole("radiogroup", { name: "Tipo de lançamento" })).not.toBeInTheDocument();
  });

  it("sem carteira no endereço, pré-seleciona a primeira e, ao terminar, vai para a Home", async () => {
    storeSession();
    mockFetch({
      "GET /api/wallets": { body: WALLETS },
      "GET /api/groups": { body: [] },
      "POST /api/transactions/income": { status: 201, body: makeTransaction() },
    });
    const user = userEvent.setup();
    const { router } = renderWithProviders(<TransactionPage kind={TransactionKind.Income} />, {
      path: "/depositar",
      initialEntries: ["/depositar"],
      extraRoutes: [{ path: "/", element: <p>Home</p> }],
    });

    await ready(/^Carteira Ana, Nubank,/);
    await user.type(screen.getByLabelText("Valor"), "10");
    await user.click(screen.getByRole("button", { name: "Registrar depósito" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("não tem violações do axe no formulário", async () => {
    const { container, user } = setup(TransactionKind.Transfer);

    await ready();
    await pickDestination(user, /Mesada/);

    expect(await axe(container)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// Feature 007 — tipos de transferência (Empréstimo, Quitação, Pagamento)
// ---------------------------------------------------------------------------

/** Transferência registrada de Nubank (Ana) para Mesada (Bruno) */
const transferToBruno = (overrides: Partial<TransactionInfo> = {}): TransactionInfo =>
  makeTransaction({
    type: TransactionType.Transfer,
    source: { accountId: 1, name: "Nubank", kind: "Wallet", currency: Currency.BRL, ownerName: "Ana Silva" },
    destination: { accountId: 12, name: "Mesada", kind: "Wallet", currency: Currency.BRL, ownerName: "Bruno Souza" },
    ...overrides,
  });

const debtsOf = (userId: number, debts: PersonDebt[]): MockResponse => ({ body: { userId, debts } });

const owes = (overrides: Partial<PersonDebt> = {}): PersonDebt => ({
  counterpartUserId: 9,
  counterpartName: "Bruno Souza",
  counterpartFirstName: "Bruno",
  currency: Currency.BRL,
  amount: 100,
  direction: DebtDirection.Owes,
  ...overrides,
});

const continueButton = () => screen.getByRole("button", { name: "Continuar" });

/** Frase do painel de quitação (o valor fica num <span> próprio): compara o texto inteiro do <p> */
const debtSentence = (text: string) => (_content: string, element: Element | null) =>
  element?.tagName === "P" && (element.textContent ?? "").replace(/\s+/g, " ") === text;

describe("TransactionPage — tipo da transferência (US1)", () => {
  it("seletor Tipo só aparece com destino de outra pessoa: radiogroup sem seleção, ajuda e axe", async () => {
    const { container, user } = setup(TransactionKind.Transfer);

    await ready();
    await pickDestination(user, /Poupança/);
    expect(screen.queryByRole("radiogroup", { name: "Tipo" })).not.toBeInTheDocument();

    await pickDestination(user, /Mesada/);
    const group = kindGroup();
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual(["Empréstimo", "Quitação", "Pagamento"]);
    expect(radios.every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true);
    // Sem escolha, a parada de Tab cai na primeira opção sem marcá-la
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
    expect(group).toHaveAttribute("aria-required", "true");
    // A região viva da ajuda já existe (vazia, `sr-only`, não `hidden`) antes da 1ª escolha (REVIEW-007 I-1)
    const help = screen.getByText("Tipo").parentElement?.querySelector('p[aria-live="polite"]');
    expect(help).toBeInTheDocument();
    expect(help).toBeEmptyDOMElement();
    expect(help).toHaveClass("empty:sr-only");
    expect(help).not.toHaveClass("empty:hidden");
    expect(await axe(container)).toHaveNoViolations();

    await pickKind(user, "Empréstimo");
    expect(help).toHaveTextContent("Bruno vai ficar devendo esse valor a Ana.");
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(group).toHaveAccessibleDescription("Bruno vai ficar devendo esse valor a Ana.");
    // Setas movem e selecionam
    await user.keyboard("{ArrowRight}");
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(group).toHaveAccessibleDescription("Abate uma dívida de Ana com Bruno.");
    await user.keyboard("{End}");
    expect(group).toHaveAccessibleDescription("Não gera dívida.");
  });

  it("Continuar sem tipo mostra \"Escolha o tipo da transferência.\" e foca o grupo", async () => {
    const { container, fetchMock, user } = setup(TransactionKind.Transfer);

    await ready();
    await pickDestination(user, /Mesada/);
    await user.type(screen.getByLabelText("Valor"), "100");
    await user.click(continueButton());

    expect(screen.getByRole("alert")).toHaveTextContent("Escolha o tipo da transferência.");
    const group = kindGroup();
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Escolha o tipo da transferência.");
    expect(within(group).getByRole("radio", { name: "Empréstimo" })).toHaveFocus();
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toHaveLength(0);
    expect(await axe(container)).toHaveNoViolations();

    // Escolher qualquer opção some com o erro
    await pickKind(user, "Pagamento");
    expect(screen.queryByText("Escolha o tipo da transferência.")).not.toBeInTheDocument();
  });

  it("trocar o Para limpa o tipo (mesmo titular some; outro titular, limpo)", async () => {
    const caio = makeDestination({ walletId: 15, name: "Conta do Caio", ownerUserId: 11, ownerFirstName: "Caio", isOwn: false });
    const { user } = setup(TransactionKind.Transfer, {
      "GET /api/wallets/1/transfer-destinations": {
        body: { ...FROM_NUBANK, sameCurrency: [POUPANCA, MESADA, caio] },
      },
    });

    await ready();
    await pickDestination(user, /Mesada/);
    await pickKind(user, "Pagamento");

    await pickDestination(user, /Poupança/);
    expect(screen.queryByRole("radiogroup", { name: "Tipo" })).not.toBeInTheDocument();
    await pickDestination(user, /Mesada/);
    expect(within(kindGroup()).getAllByRole("radio").map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "false",
    ]);

    await pickKind(user, "Empréstimo");
    await pickDestination(user, /Conta do Caio/);
    await waitFor(() =>
      expect(within(kindGroup()).getByRole("radio", { name: "Empréstimo" })).toHaveAttribute("aria-checked", "false"),
    );
  });

  it("empréstimo: prévia e registro enviam kind, prévia mostra Tipo e o efeito na dívida, toast por tipo", async () => {
    const { container, fetchMock, router, user } = setup(TransactionKind.Transfer, {
      "POST /api/transactions/transfer/preview": {
        body: {
          type: "Transfer",
          sourceAmount: 100,
          destinationAmount: 100,
          quote: null,
          kind: "loan",
          debt: { currency: "BRL", amount: 100, before: 0, after: 100, debtorUserId: 9, creditorUserId: 7 },
        },
      },
      "POST /api/transactions/transfer": {
        status: 201,
        body: transferToBruno({ transferKind: TransferKind.Loan, debtCurrency: Currency.BRL, debtAmount: 100 }),
      },
    });

    await ready();
    await pickDestination(user, /Mesada/);
    await pickKind(user, "Empréstimo");
    await user.type(screen.getByLabelText("Valor"), "100");
    await user.click(continueButton());

    const effect = await screen.findByRole("region", { name: "Efeito na dívida" });
    expect(effect).toHaveTextContent("Bruno vai dever R$ 100,00 a Ana");
    // Uma única linha "Tipo", com o tipo da transferência
    expect(screen.getAllByText("Tipo")).toHaveLength(1);
    expect(screen.getByText("Empréstimo")).toBeInTheDocument();
    expect(screen.queryByText("Transferência")).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 1, destinationWalletId: 12, amount: "100", kind: "loan", description: null },
    ]);
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Registrar empréstimo" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/1"));
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toEqual([
      { sourceWalletId: 1, destinationWalletId: 12, amount: "100", kind: "loan", description: null },
    ]);
    expect(notifySuccess).toHaveBeenCalledWith("Empréstimo de R$ 100,00 para Bruno registrado.");
  });

  it("pagamento: sem efeito na dívida, \"Registrar pagamento\" e toast de pagamento", async () => {
    const { fetchMock, router, user } = setup(TransactionKind.Transfer, {
      "POST /api/transactions/transfer/preview": {
        body: { type: "Transfer", sourceAmount: 50, destinationAmount: 50, quote: null, kind: "payment", debt: null },
      },
      "POST /api/transactions/transfer": {
        status: 201,
        body: transferToBruno({ sourceAmount: 50, destinationAmount: 50, transferKind: TransferKind.Payment }),
      },
    });

    await ready();
    await pickDestination(user, /Mesada/);
    await pickKind(user, "Pagamento");
    await user.type(screen.getByLabelText("Valor"), "50");
    await user.click(continueButton());

    await user.click(await screen.findByRole("button", { name: "Registrar pagamento" }));
    expect(screen.queryByRole("region", { name: "Efeito na dívida" })).not.toBeInTheDocument();

    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/1"));
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toEqual([
      { sourceWalletId: 1, destinationWalletId: 12, amount: "50", kind: "payment", description: null },
    ]);
    expect(notifySuccess).toHaveBeenCalledWith("Pagamento de R$ 50,00 para Bruno registrado.");
  });
});

describe("TransactionPage — quitação na mesma moeda (US2)", () => {
  it("carrega as dívidas do titular da origem e \"Quitar tudo\" envia settleAll: true", async () => {
    const { container, fetchMock, router, user } = setup(TransactionKind.Transfer, {
      "GET /api/users/7/debts": debtsOf(7, [owes(), owes({ counterpartUserId: 11, counterpartFirstName: "Caio" })]),
      "POST /api/transactions/transfer/preview": {
        body: {
          type: "Transfer",
          sourceAmount: 100,
          destinationAmount: 100,
          quote: null,
          kind: "settlement",
          debt: { currency: "BRL", amount: 100, before: 100, after: 0, debtorUserId: 7, creditorUserId: 9 },
        },
      },
      "POST /api/transactions/transfer": {
        status: 201,
        body: transferToBruno({ transferKind: TransferKind.Settlement, debtCurrency: Currency.BRL, debtAmount: 100 }),
      },
    });

    await ready();
    await pickDestination(user, /Mesada/);
    await pickKind(user, "Quitação");

    expect(await screen.findByText(debtSentence("Você deve R$ 100,00 a Bruno"))).toBeInTheDocument();
    expect(requestsTo(fetchMock, "GET /api/users/7/debts")).toHaveLength(1);
    // Dívida só na moeda das carteiras: sem o grupo "Quitar dívida em"
    expect(screen.queryByRole("radiogroup", { name: "Quitar dívida em" })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    const settleAll = screen.getByRole("button", { name: "Quitar tudo" });
    expect(settleAll).toHaveAttribute("aria-pressed", "false");
    expect(settleAll).toHaveClass("bg-surface-2");
    await user.click(settleAll);
    expect(settleAll).toHaveAttribute("aria-pressed", "true");
    // Ligado: as cores da variante são substituídas, não somadas (REVIEW-007 I-3)
    expect(settleAll).toHaveClass("bg-brand-tint");
    expect(settleAll).not.toHaveClass("bg-surface-2");
    expect(settleAll).toHaveFocus();
    expect(screen.getByLabelText("Valor")).toHaveValue("100,00");
    expect(screen.getByLabelText("Valor")).not.toHaveClass("sr-only");
    // O painel não vira um landmark "Tipo" (REVIEW-007 M-1)
    expect(screen.queryByRole("region", { name: "Tipo" })).not.toBeInTheDocument();

    await user.click(continueButton());
    const effect = await screen.findByRole("region", { name: "Efeito na dívida" });
    expect(effect).toHaveTextContent("Dívida de Ana com Bruno: R$ 100,00 → R$ 0,00");
    expect(within(effect).getByText("quitada")).toBeInTheDocument();
    const body = { sourceWalletId: 1, destinationWalletId: 12, kind: "settlement", debtCurrency: "BRL", settleAll: true, description: null };
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([body]);

    await user.click(screen.getByRole("button", { name: "Registrar quitação" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/1"));
    // O registro reenvia o mesmo corpo da prévia (sem valor derivado)
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toEqual([body]);
    expect(notifySuccess).toHaveBeenCalledWith("Quitação de R$ 100,00 para Bruno registrada.");
  });

  it("digitar no Valor desliga o \"Quitar tudo\" e a prévia mostra R$ 100,00 → R$ 70,00", async () => {
    const { fetchMock, user } = setup(TransactionKind.Transfer, {
      "GET /api/users/7/debts": debtsOf(7, [owes()]),
      "POST /api/transactions/transfer/preview": {
        body: {
          type: "Transfer",
          sourceAmount: 30,
          destinationAmount: 30,
          quote: null,
          kind: "settlement",
          debt: { currency: "BRL", amount: 30, before: 100, after: 70, debtorUserId: 7, creditorUserId: 9 },
        },
      },
    });

    await ready();
    await pickDestination(user, /Mesada/);
    await pickKind(user, "Quitação");
    const settleAll = await screen.findByRole("button", { name: "Quitar tudo" });
    await user.click(settleAll);
    await user.clear(screen.getByLabelText("Valor"));
    expect(settleAll).toHaveAttribute("aria-pressed", "false");
    await user.type(screen.getByLabelText("Valor"), "30");
    await user.click(continueButton());

    const effect = await screen.findByRole("region", { name: "Efeito na dívida" });
    expect(effect).toHaveTextContent("Dívida de Ana com Bruno: R$ 100,00 → R$ 70,00");
    expect(within(effect).queryByText("quitada")).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 1, destinationWalletId: 12, amount: "30", kind: "settlement", debtCurrency: "BRL", description: null },
    ]);
  });

  it("sem dívida: aviso no painel e Continuar aria-disabled com a explicação", async () => {
    const { container, fetchMock, user } = setup(TransactionKind.Transfer, {
      "GET /api/users/7/debts": debtsOf(7, [owes({ direction: DebtDirection.Owed })]),
    });

    await ready();
    await pickDestination(user, /Mesada/);
    await pickKind(user, "Quitação");
    const notice = await screen.findByText("Você não tem dívida com Bruno.");
    expect(notice.closest("[role='status']")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Quitar tudo" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Valor"), "10");
    const submit = continueButton();
    expect(submit).not.toBeDisabled();
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit).toHaveAccessibleDescription("Você não tem dívida com Bruno.");
    await user.click(submit);
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toHaveLength(0);
    expect(await axe(container)).toHaveNoViolations();

    // Trocar para Pagamento libera o Continuar sem perder o valor
    await pickKind(user, "Pagamento");
    expect(continueButton()).not.toHaveAttribute("aria-disabled");
    expect(screen.getByLabelText("Valor")).toHaveValue("10");
  });

  it("dívidas carregando: Continuar aria-disabled com \"Carregando…\" e sem ação (REVIEW-007 M-3)", async () => {
    let release: (() => void) | null = null;
    const { fetchMock, user } = setup(TransactionKind.Transfer, {
      "GET /api/users/7/debts": () =>
        new Promise<MockResponse>((resolve) => {
          release = () => resolve(debtsOf(7, [owes()]));
        }),
    });

    await ready();
    await pickDestination(user, /Mesada/);
    await user.type(screen.getByLabelText("Valor"), "30");
    await pickKind(user, "Quitação");

    await waitFor(() => expect(release).not.toBeNull());
    const submit = continueButton();
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit).toHaveAccessibleDescription("Carregando…");
    await user.click(submit);
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toHaveLength(0);

    act(() => (release as (() => void) | null)?.());
    await screen.findByText(debtSentence("Você deve R$ 100,00 a Bruno"));
    expect(continueButton()).not.toHaveAttribute("aria-disabled");
  });

  it("em satoshis, \"Quitar tudo\" preenche sats inteiros e mantém a unidade; toast com 8 casas (REVIEW-007 M-4/M-5)", async () => {
    const { router, user } = setup(
      TransactionKind.Transfer,
      {
        "GET /api/users/7/debts": debtsOf(7, [owes({ currency: Currency.BTC, amount: 0.000004 })]),
        "POST /api/transactions/transfer/preview": {
          body: {
            type: "Transfer",
            sourceAmount: 0.000004,
            destinationAmount: 0.000004,
            quote: null,
            kind: "settlement",
            debt: { currency: "BTC", amount: 0.000004, before: 0.000004, after: 0, debtorUserId: 7, creditorUserId: 9 },
          },
        },
        "POST /api/transactions/transfer": {
          status: 201,
          body: makeTransaction({
            type: TransactionType.Transfer,
            source: { accountId: 2, name: "Reserva BTC", kind: "Wallet", currency: Currency.BTC, ownerName: "Ana Silva" },
            destination: { accountId: 14, name: "Cofre", kind: "Wallet", currency: Currency.BTC, ownerName: "Bruno Souza" },
            sourceAmount: 0.000004,
            destinationAmount: 0.000004,
            transferKind: TransferKind.Settlement,
            debtCurrency: Currency.BTC,
            debtAmount: 0.000004,
          }),
        },
      },
      2,
    );

    await ready(/^De Ana, Reserva BTC,/);
    await pickDestination(user, /Cofre/);
    await user.click(screen.getByRole("button", { name: "Satoshis" }));
    await pickKind(user, "Quitação");
    // 5 casas zerariam a dívida: o painel mostra 8
    expect(await screen.findByText(debtSentence("Você deve ₿ 0,00000400 a Bruno"))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar tudo" }));
    expect(screen.getByLabelText("Valor")).toHaveValue("400");
    expect(screen.getByRole("button", { name: "Satoshis" })).toHaveAttribute("aria-pressed", "true");

    await user.click(continueButton());
    await user.click(await screen.findByRole("button", { name: "Registrar quitação" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/2"));
    expect(notifySuccess).toHaveBeenCalledWith("Quitação de ₿ 0,00000400 para Bruno registrada.");
  });

  it("origem de um dependente: \"Caio deve…\" com as dívidas do titular da origem", async () => {
    const mesadaCaio = makeWallet({
      walletId: 3,
      name: "Mesada do Caio",
      ownerUserId: 11,
      ownerName: "Caio Silva",
      ownerFirstName: "Caio",
      balance: 80,
    });
    const nubankAna = makeDestination({ walletId: 1, name: "Nubank", ownerUserId: 7, ownerFirstName: "Ana", isOwn: false });
    const { fetchMock, user } = setup(
      TransactionKind.Transfer,
      {
        "GET /api/wallets": { body: [...WALLETS, mesadaCaio] },
        "GET /api/wallets/3/transfer-destinations": {
          body: { sourceWalletId: 3, sameCurrency: [nubankAna], conversion: [] },
        },
        "GET /api/users/11/debts": debtsOf(11, [
          owes({ counterpartUserId: 7, counterpartName: "Ana Silva", counterpartFirstName: "Ana", amount: 40 }),
        ]),
      },
      3,
    );

    await ready(/^De Caio, Mesada do Caio,/);
    await pickDestination(user, /Nubank/);
    await pickKind(user, "Quitação");

    expect(await screen.findByText(debtSentence("Caio deve R$ 40,00 a Ana"))).toBeInTheDocument();
    expect(kindGroup()).toHaveAccessibleDescription("Abate uma dívida de Caio com Ana.");
    expect(requestsTo(fetchMock, "GET /api/users/11/debts")).toHaveLength(1);
  });

  it("erro 422 do registro aparece no banner do formulário", async () => {
    const { user } = setup(TransactionKind.Transfer, {
      "GET /api/users/7/debts": debtsOf(7, [owes({ amount: 70 })]),
      "POST /api/transactions/transfer/preview": {
        body: {
          type: "Transfer",
          sourceAmount: 70,
          destinationAmount: 70,
          quote: null,
          kind: "settlement",
          debt: { currency: "BRL", amount: 70, before: 70, after: 0, debtorUserId: 7, creditorUserId: 9 },
        },
      },
      "POST /api/transactions/transfer": apiError(422, "O valor é maior que a dívida (R$ 40,00)."),
    });

    await ready();
    await pickDestination(user, /Mesada/);
    await pickKind(user, "Quitação");
    await screen.findByText(debtSentence("Você deve R$ 70,00 a Bruno"));
    await user.type(screen.getByLabelText("Valor"), "70");
    await user.click(continueButton());
    await user.click(await screen.findByRole("button", { name: "Registrar quitação" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("O valor é maior que a dívida (R$ 40,00).");
    expect(screen.getByLabelText("Valor")).toHaveValue("70");
  });
});

describe("TransactionPage — quitação em outra moeda (US3)", () => {
  it("dívidas nas duas moedas: grupo \"Quitar dívida em\" sugere a moeda das carteiras; a outra mostra a nota", async () => {
    const { container, user } = setup(TransactionKind.Transfer, {
      "GET /api/users/7/debts": debtsOf(7, [owes(), owes({ currency: Currency.BTC, amount: 0.0002 })]),
    });

    await ready();
    await pickDestination(user, /Mesada/);
    await pickKind(user, "Quitação");

    const currencyGroup = await screen.findByRole("radiogroup", { name: "Quitar dívida em" });
    expect(within(currencyGroup).getByRole("radio", { name: "Real" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(debtSentence("Você deve R$ 100,00 a Bruno"))).toBeInTheDocument();
    expect(screen.queryByText("Convertido pela cotação atual na confirmação.")).not.toBeInTheDocument();

    await user.click(within(currencyGroup).getByRole("radio", { name: "Bitcoin" }));
    expect(screen.getByText(debtSentence("Você deve ₿ 0,00020 a Bruno"))).toBeInTheDocument();
    expect(currencyGroup).toHaveAccessibleDescription("Convertido pela cotação atual na confirmação.");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("dívida só na outra moeda: a moeda das carteiras fica desabilitada; quitar tudo deixa o Valor calculado na confirmação", async () => {
    const quoteRef = { priceBrl: 500000, quotedAt: "2026-11-03T17:32:00Z", source: "coingecko" };
    const { container, fetchMock, router, user } = setup(
      TransactionKind.Transfer,
      {
        "GET /api/users/7/debts": debtsOf(7, [owes({ amount: 100 })]),
        "POST /api/transactions/transfer/preview": {
          body: {
            type: "Transfer",
            sourceAmount: 0.0002,
            destinationAmount: 0.0002,
            quote: quoteRef,
            kind: "settlement",
            debt: { currency: "BRL", amount: 100, before: 100, after: 0, debtorUserId: 7, creditorUserId: 9 },
          },
        },
        "POST /api/transactions/transfer": {
          status: 201,
          body: makeTransaction({
            type: TransactionType.Transfer,
            source: { accountId: 2, name: "Reserva BTC", kind: "Wallet", currency: Currency.BTC, ownerName: "Ana Silva" },
            destination: { accountId: 14, name: "Cofre", kind: "Wallet", currency: Currency.BTC, ownerName: "Bruno Souza" },
            sourceAmount: 0.0002,
            destinationAmount: 0.0002,
            transferKind: TransferKind.Settlement,
            debtCurrency: Currency.BRL,
            debtAmount: 100,
          }),
        },
      },
      2,
    );

    await ready(/^De Ana, Reserva BTC,/);
    await pickDestination(user, /Cofre/);
    await pickKind(user, "Quitação");

    const currencyGroup = await screen.findByRole("radiogroup", { name: "Quitar dívida em" });
    // Moeda sem dívida: inativa, com o motivo no nome acessível (REVIEW-007 M-2)
    expect(within(currencyGroup).getByRole("radio", { name: "Bitcoin, sem dívida" })).toBeDisabled();
    expect(within(currencyGroup).getByRole("radio", { name: "Real" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Convertido pela cotação atual na confirmação.")).toBeInTheDocument();

    const settleAll = screen.getByRole("button", { name: "Quitar tudo" });
    await user.click(settleAll);
    const amount = screen.getByLabelText("Valor");
    expect(amount).toHaveAttribute("readonly");
    expect(amount).toHaveValue("Valor calculado na confirmação");
    // O <input> sai da tela (continua focável); a frase visível é um texto que quebra linha (REVIEW-007 I-2)
    expect(amount).toHaveClass("sr-only");
    const visible = screen.getByText("Valor calculado na confirmação");
    expect(visible.tagName).toBe("SPAN");
    expect(visible).toHaveAttribute("aria-hidden", "true");
    expect(visible).toHaveClass("break-words");
    const toggle = screen.getByRole("group", { name: "Informar valor em" });
    expect(within(toggle).getByRole("button", { name: "Bitcoin" })).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();

    // Tocar de novo sai do modo e devolve a edição (e o foco) ao Valor
    await user.click(settleAll);
    expect(amount).not.toHaveAttribute("readonly");
    expect(amount).toHaveValue("");
    expect(amount).toHaveFocus();
    await user.click(settleAll);

    await user.click(continueButton());
    expect(await screen.findByText("Abatido da dívida")).toBeInTheDocument();
    expect(screen.getByText("Abatido da dívida").nextElementSibling).toHaveTextContent(/^R\$\s100,00$/);
    expect(screen.getByText(/^−₿\s0,00020000$/)).toBeInTheDocument();
    expect(screen.getByText("₿ 1 = R$ 500.000,00")).toBeInTheDocument();
    expect(screen.getByText("Obtida às")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Efeito na dívida" })).toHaveTextContent(
      "Dívida de Ana com Bruno: R$ 100,00 → R$ 0,00",
    );
    const body = { sourceWalletId: 2, destinationWalletId: 14, kind: "settlement", debtCurrency: "BRL", settleAll: true, description: null };
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([body]);

    await user.click(screen.getByRole("button", { name: "Registrar quitação" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/2"));
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toEqual([body]);
  });

  it("quitação parcial em outra moeda envia debtCurrency; 503 mostra o aviso de cotação", async () => {
    const { fetchMock, user } = setup(
      TransactionKind.Transfer,
      {
        "GET /api/users/7/debts": debtsOf(7, [owes()]),
        "POST /api/transactions/transfer/preview": apiError(503, "Cotação indisponível."),
      },
      2,
    );

    await ready(/^De Ana, Reserva BTC,/);
    await pickDestination(user, /Cofre/);
    await pickKind(user, "Quitação");
    await screen.findByRole("radiogroup", { name: "Quitar dívida em" });
    await user.type(screen.getByLabelText("Valor"), "0,0001");
    await user.click(continueButton());

    expect(await screen.findByText("Cotação indisponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar quitação" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Informar em bitcoin" })).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 2, destinationWalletId: 14, amount: "0.0001", kind: "settlement", debtCurrency: "BRL", description: null },
    ]);
  });
});

describe("TransactionPage — permissão \"Pode lançar\" (feature 008, T024)", () => {
  const SILVA = makeGroup({ groupId: 5, name: "Silva", isResponsible: false, responsibleUserId: 1 });
  const PRAIA = makeGroup({ groupId: 6, name: "Casa de praia", isResponsible: false, responsibleUserId: 1 });
  /** Carteira da família em que a pessoa não pode lançar (controla, mas sem a permissão) */
  const readOnlyWallet = (walletId: number, name: string, groupId: number) =>
    makeWallet({ walletId, name, groupId, canControl: true, canCreateTransactions: false, balance: 85 });

  it("carteiras sem canCreateTransactions não aparecem na origem", async () => {
    const { user } = setup(TransactionKind.Transfer, {
      "GET /api/groups": { body: [SILVA] },
      "GET /api/wallets": { body: [...WALLETS, readOnlyWallet(7, "Mesada da família", 5)] },
    });

    await ready();
    await user.click(screen.getByRole("button", { name: /^De/ }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: /Nubank/ })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: /Reserva BTC/ })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: /Mesada da família/ })).not.toBeInTheDocument();
  });

  it("sem carteira permitida numa família: estado vazio com o nome dela e botão aria-disabled", async () => {
    const { container, fetchMock, user } = setup(TransactionKind.Income, {
      "GET /api/groups": { body: [SILVA] },
      "GET /api/wallets": { body: [readOnlyWallet(1, "Mesada", 5), readOnlyWallet(3, "Poupança", 5)] },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Você só pode consultar a família Silva." }),
    ).toBeInTheDocument();
    expect(screen.getByText("O responsável pela família decide quem pode lançar.")).toBeInTheDocument();
    // Sem formulário desabilitado: os campos não são renderizados
    expect(screen.queryByLabelText("Valor")).not.toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "Registrar depósito" });
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit).toHaveAccessibleDescription(/Você só pode consultar a família Silva\./);
    await user.click(submit);
    expect(requestsTo(fetchMock, "POST /api/transactions/income")).toHaveLength(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("famílias chegando depois das carteiras: espera o nome em vez de trocar o título (REVIEW-008 M-6)", async () => {
    let releaseGroups: () => void = () => undefined;
    setup(TransactionKind.Income, {
      "GET /api/groups": () =>
        new Promise<MockResponse>((resolve) => {
          releaseGroups = () => resolve({ body: [SILVA] });
        }),
      "GET /api/wallets": { body: [readOnlyWallet(1, "Mesada", 5)] },
    });

    const submit = await screen.findByRole("button", { name: "Registrar depósito" });
    await waitFor(() => expect(submit).toHaveAttribute("aria-disabled", "true"));
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(submit).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText("Você não tem carteiras em que possa lançar.")).not.toBeInTheDocument();

    act(() => releaseGroups());
    expect(
      await screen.findByRole("heading", { level: 2, name: "Você só pode consultar a família Silva." }),
    ).toBeInTheDocument();
    expect(submit).toHaveAccessibleDescription(/Você só pode consultar a família Silva\./);
  });

  it("sem carteira permitida em mais de uma família: \"Você não tem carteiras em que possa lançar.\"", async () => {
    setup(TransactionKind.Transfer, {
      "GET /api/groups": { body: [SILVA, PRAIA] },
      "GET /api/wallets": { body: [readOnlyWallet(1, "Mesada", 5), readOnlyWallet(3, "Quarto", 6)] },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Você não tem carteiras em que possa lançar." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar transferência" })).toHaveAttribute("aria-disabled", "true");
  });

  it("403 no envio: toast com a mensagem da API e recarrega as carteiras", async () => {
    const message = "Você não tem permissão para criar lançamentos na família Silva.";
    let rejected = false;
    const { fetchMock, user } = setup(TransactionKind.Income, {
      "GET /api/groups": { body: [SILVA] },
      // A permissão mudou durante o preenchimento: depois da recusa, a carteira vem sem a permissão
      "GET /api/wallets": () => ({
        body: [rejected ? readOnlyWallet(1, "Nubank", 5) : makeWallet({ walletId: 1, name: "Nubank", groupId: 5 })],
      }),
      "POST /api/transactions/income": () => {
        rejected = true;
        return apiError(403, message);
      },
    });

    await ready(/^Carteira Ana, Nubank,/);
    await user.type(screen.getByLabelText("Valor"), "100,00");
    await user.click(screen.getByRole("button", { name: "Registrar depósito" }));

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(expect.objectContaining({ mensagem: message })));
    await waitFor(() => expect(requestsTo(fetchMock, "GET /api/wallets").length).toBeGreaterThan(1));
    expect(
      await screen.findByRole("heading", { level: 2, name: "Você só pode consultar a família Silva." }),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/transactions/income")).toHaveLength(1);
  });
});
