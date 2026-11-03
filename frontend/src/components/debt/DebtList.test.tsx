import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DebtList } from "./DebtList";
import type { DebtListProps, DebtPerson } from "./DebtList";
import { ApiError, Currency, NETWORK_ERROR_STATUS, OFFLINE_CONTENT_MESSAGE } from "../../types/api";
import { DebtDirection } from "../../types/debt";
import type { PersonDebt } from "../../types/debt";
import { AppTab } from "../layout/navigation";
import { axe, renderWithProviders } from "../../test/utils";

const ANA: DebtPerson = { userId: 7, firstName: "Ana", isSelf: true };
const ANA_SEEN_BY_OTHER: DebtPerson = { ...ANA, isSelf: false };

const makeDebt = (overrides: Partial<PersonDebt> = {}): PersonDebt => ({
  counterpartUserId: 9,
  counterpartName: "Bruno Souza",
  counterpartFirstName: "Bruno",
  currency: Currency.BRL,
  amount: 70,
  direction: DebtDirection.Owed,
  ...overrides,
});

const renderList = (props: Partial<DebtListProps> = {}) => {
  const onRetry = vi.fn();
  const view = renderWithProviders(
    <DebtList person={ANA} debts={[]} error={null} retrying={false} onRetry={onRetry} {...props} />,
    {
      path: "/pessoas/:userId",
      initialEntries: ["/pessoas/7"],
      extraRoutes: [{ path: "/pessoas/9", element: <p>Página do Bruno</p> }],
    },
  );
  return { onRetry, ...view };
};

const section = () => screen.getByRole("region", { name: "Dívidas" });

describe("DebtList", () => {
  it("na página da pessoa logada usa \"você\" e o sinal do ponto de vista dela", async () => {
    const { container } = renderList({
      debts: [
        makeDebt({ amount: 70, direction: DebtDirection.Owed }),
        makeDebt({ currency: Currency.BTC, amount: 0.0004, direction: DebtDirection.Owes }),
      ],
    });

    const links = within(section()).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName(/^Bruno deve a você, \+R\$\s70,00$/);
    expect(links[1]).toHaveAccessibleName(/^Você deve a Bruno, −₿\s0,00040$/);
    // A cor é só reforço: o sinal vem no texto
    expect(within(links[0]!).getByText(/\+R\$/)).toHaveClass("text-positive");
    expect(within(links[1]!).getByText(/−₿/)).toHaveClass("text-negative");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("na página de outra pessoa mostra \"X deve a Y\" pelos primeiros nomes", () => {
    renderList({
      person: ANA_SEEN_BY_OTHER,
      debts: [
        makeDebt({ direction: DebtDirection.Owed }),
        makeDebt({ counterpartUserId: 10, counterpartName: "Caio Lima", counterpartFirstName: "Caio", amount: 30, direction: DebtDirection.Owes }),
      ],
    });

    expect(screen.getByRole("link", { name: /^Bruno deve a Ana, \+R\$\s70,00$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Ana deve a Caio, −R\$\s30,00$/ })).toBeInTheDocument();
    expect(screen.queryByText(/você/i)).not.toBeInTheDocument();
  });

  it("vírgula de pausa colada à frase, sem espaço antes dela no nome acessível (REVIEW-006 M-4)", () => {
    renderList({ debts: [makeDebt()] });

    const link = screen.getByRole("link", { name: /Bruno deve a você/ });
    const comma = within(link).getByText(",");
    expect(comma).toHaveClass("sr-only");
    // Dentro do mesmo <span> da frase: o Chrome não abre um bloco entre "você" e ","
    expect(comma.parentElement).toHaveTextContent(/^Bruno deve a você,$/);
    expect(link).toHaveAccessibleName(/^Bruno deve a você, \+R\$\s70,00$/);
    expect(link).not.toHaveAccessibleName(/\s,/);
  });

  it("a frase não é cortada: sem line-clamp, frase e valor quebram como bloco (REVIEW-006 B-2)", () => {
    renderList({ debts: [makeDebt({ counterpartFirstName: "Maximiliano", counterpartName: "Maximiliano Souza" })] });

    const link = screen.getByRole("link", { name: /Maximiliano deve a você/ });
    const phrase = within(link).getByText(",").parentElement!;
    expect(phrase).not.toHaveClass("line-clamp-2");
    expect(phrase.parentElement).toHaveClass("flex-wrap");
    expect(within(link).getByText(/\+R\$/)).toHaveClass("whitespace-nowrap", "ml-auto");
  });

  it("bitcoin muito pequeno aparece com 8 casas (nunca \"₿ 0,00000\")", () => {
    renderList({ debts: [makeDebt({ currency: Currency.BTC, amount: 0.00000412 })] });

    expect(screen.getByText(/^\+₿\s0,00000412$/)).toBeInTheDocument();
  });

  it("a linha leva à página da contraparte com o NavState de volta", async () => {
    const { router } = renderList({ debts: [makeDebt()], tab: AppTab.Family });
    const user = userEvent.setup();

    const link = screen.getByRole("link", { name: /Bruno deve a você/ });
    expect(link).toHaveAttribute("href", "/pessoas/9");
    await user.click(link);

    expect(await screen.findByText("Página do Bruno")).toBeInTheDocument();
    expect(router.state.location.state).toEqual({
      tab: AppTab.Family,
      backTo: "/pessoas/7",
      backLabel: "Ana",
      colorIndex: 9,
    });
  });

  it("sem dívidas mostra o texto discreto", () => {
    renderList({ debts: [] });

    expect(within(section()).getByText("Nenhuma dívida em aberto.")).toBeInTheDocument();
    expect(within(section()).queryByRole("link")).not.toBeInTheDocument();
  });

  it("carregando: aria-busy e \"Carregando…\" anunciado", async () => {
    const { container } = renderList({ debts: null });

    expect(section()).toHaveAttribute("aria-busy", "true");
    expect(within(section()).getByRole("status")).toHaveTextContent("Carregando…");
    // Esqueleto do avatar redondo, sem o rounded-sm padrão competindo (REVIEW-006 I-3)
    const avatars = section().querySelectorAll(".size-10");
    expect(avatars).toHaveLength(2);
    avatars.forEach((avatar) => {
      expect(avatar).toHaveClass("rounded-pill");
      expect(avatar).not.toHaveClass("rounded-sm");
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("erro: faixa com a mensagem e \"Tentar de novo\"", async () => {
    const { onRetry, container } = renderList({
      debts: null,
      error: new ApiError(500, "Falha ao calcular as dívidas."),
    });
    const user = userEvent.setup();

    expect(within(section()).getByRole("alert")).toHaveTextContent("Falha ao calcular as dívidas.");
    expect(section()).not.toHaveAttribute("aria-busy");
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("offline sem cache: aviso de conteúdo indisponível", () => {
    renderList({
      debts: null,
      error: new ApiError(NETWORK_ERROR_STATUS, OFFLINE_CONTENT_MESSAGE, [], { offline: true }),
    });

    expect(within(section()).getByRole("alert")).toHaveTextContent("Este conteúdo não está disponível sem internet.");
  });
});
