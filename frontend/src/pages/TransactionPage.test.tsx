import { describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransactionPage from "./TransactionPage";
import { Currency } from "../types/api";
import { TransactionKind, TransactionType } from "../types/transaction";
import type { TransactionInfo } from "../types/transaction";
import type { TransferDestination, TransferDestinationsResult } from "../types/wallet";
import { makeWallet, storeSession } from "../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../test/utils";
import type { MockHandler, MockResponse } from "../test/utils";
import { notifySuccess, notifyWarning } from "../utils/notify";
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
        body: { type: "Transfer", sourceAmount: 250, destinationAmount: 250, quote: null },
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
    await user.type(screen.getByLabelText("Valor"), "250");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Titular do destino")).toBeInTheDocument();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 1, destinationWalletId: 12, amount: "250", description: null },
    ]);

    await user.click(screen.getByRole("button", { name: "Registrar transferência" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/1"));
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toEqual([
      { sourceWalletId: 1, destinationWalletId: 12, amount: "250", description: null },
    ]);
  });

  it("422 \"Só é possível transferir…\" aparece no topo do formulário", async () => {
    const { user } = setup(TransactionKind.Transfer, {
      "POST /api/transactions/transfer/preview": apiError(422, "Só é possível transferir para pessoas da sua família."),
    });

    await ready();
    await pickDestination(user, /Mesada/);
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
    await user.click(screen.getByRole("button", { name: "Reais" }));
    await user.type(screen.getByLabelText("Valor"), "200");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Valor informado")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 2, destinationWalletId: 14, amountBrl: "200", description: null },
    ]);
    expect(screen.getByText(/^R\$\s200,00$/)).toBeInTheDocument();
    expect(screen.getByText("Valor em bitcoin")).toBeInTheDocument();
    expect(screen.getByText(/^₿\s0,00040000$/)).toBeInTheDocument();
    expect(screen.getByText(/^= R\$\s200,00 informados$/)).toBeInTheDocument();
    expect(screen.getByText("₿ 1 = R$ 500.000,00")).toBeInTheDocument();
    expect(screen.getByText("Obtida às")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Registrar transferência" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/2"));
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toEqual([
      { sourceWalletId: 2, destinationWalletId: 14, amount: "0.0004", description: null },
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

    await screen.findByRole("button", { name: "Registrar transferência" });
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer/preview")).toEqual([
      { sourceWalletId: 2, destinationWalletId: 14, amount: "0.00012345", description: null },
    ]);

    await user.click(screen.getByRole("button", { name: "Registrar transferência" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/carteiras/2"));
    expect(requestsTo(fetchMock, "POST /api/transactions/transfer")).toEqual([
      { sourceWalletId: 2, destinationWalletId: 14, amount: "0.00012345", description: null },
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
    await user.click(screen.getByRole("button", { name: "Reais" }));
    await user.type(screen.getByLabelText("Valor"), "200");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Cotação indisponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar transferência" })).toBeDisabled();
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
