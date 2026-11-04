import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberManager } from "./MemberManager";
import type { GroupInfo, GroupMemberInfo } from "../../types/group";
import { USER_ID, makeGroup, storeSession } from "../../test/fixtures";
import { axe, mockFetch, renderWithProviders, requestsTo } from "../../test/utils";
import type { MockHandler, MockResponse } from "../../test/utils";

const member = (overrides: Partial<GroupMemberInfo> & Pick<GroupMemberInfo, "userId" | "firstName">): GroupMemberInfo => ({
  lastName: "Silva",
  joinedAt: "2026-01-01T00:00:00Z",
  canCreateTransactions: true,
  canReverse: false,
  ...overrides,
});

const GROUP = makeGroup({
  groupId: 1,
  name: "Silva",
  isResponsible: true,
  responsibleUserId: USER_ID,
  members: [
    member({ userId: USER_ID, firstName: "Ana", canCreateTransactions: true, canReverse: true }),
    member({ userId: 8, firstName: "Carlos", lastName: "Souza" }),
  ],
});

/** Família vista por Caio (membro): Ana é a responsável */
const AS_MEMBER: GroupInfo = makeGroup({
  groupId: 1,
  name: "Silva",
  isResponsible: false,
  responsibleUserId: 1,
  myPermissions: { canCreateTransactions: false, canReverse: false },
  members: [
    member({ userId: 1, firstName: "Ana", canCreateTransactions: true, canReverse: true }),
    member({ userId: 9, firstName: "Bruno", canCreateTransactions: true, canReverse: true }),
    member({ userId: USER_ID, firstName: "Caio", canCreateTransactions: false, canReverse: false }),
    member({ userId: 10, firstName: "Duda", canCreateTransactions: false, canReverse: true }),
  ],
});

const setup = (group: GroupInfo, routes: Record<string, MockResponse | MockHandler> = {}) => {
  storeSession();
  const fetchMock = mockFetch({ "GET /api/groups/1": { body: group }, ...routes });
  const user = userEvent.setup();
  const view = renderWithProviders(<MemberManager group={group} currentUserId={USER_ID} />);
  return { fetchMock, user, ...view };
};

describe("MemberManager", () => {
  it("não renderiza ações para quem não é responsável", async () => {
    setup({ ...GROUP, isResponsible: false, responsibleUserId: 8 });

    expect(await screen.findByText("Carlos Souza")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Retirar/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Só o responsável pode incluir ou retirar pessoas, mudar permissões/)).toBeInTheDocument();
  });

  it("não inclui mais membros: aponta para \"Adicionar membro\" na tela da família", async () => {
    setup(GROUP);

    expect(await screen.findByText("Carlos Souza")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email exato da pessoa")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cadastrar pessoa sem login/ })).not.toBeInTheDocument();
    expect(screen.getByText('Para incluir pessoas, use "Adicionar membro" na tela da família.')).toBeInTheDocument();
  });

  it("retirar membro avisa sobre as carteiras no ConfirmModal", async () => {
    const { fetchMock, user } = setup(GROUP, {
      "DELETE /api/groups/1/members/8": { status: 204 },
    });

    await user.click(await screen.findByRole("button", { name: "Retirar Carlos Souza" }));
    const dialog = await screen.findByRole("alertdialog", { name: /Retirar Carlos Souza\?/ });
    expect(dialog).toHaveTextContent("deixarão de pertencer à família Silva");
    await user.click(within(dialog).getByRole("button", { name: "Retirar" }));

    await waitFor(() => expect(requestsTo(fetchMock, "DELETE /api/groups/1/members/8")).toHaveLength(1));
  });

  // -------------------------------------------------------------------------
  // Feature 008 (T041, T047)
  // -------------------------------------------------------------------------

  it("membro não vê adicionar, convidar, retirar nem os interruptores de permissão (T041)", async () => {
    const { container } = setup(AS_MEMBER);

    expect(await screen.findByText("Caio Silva")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retirar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar membro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Convidar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("membro lê o resumo das permissões de cada pessoa; o responsável tem todas (T047)", async () => {
    setup(AS_MEMBER);

    const row = (name: string) => (screen.getByText(name).parentElement as HTMLElement);
    expect(await screen.findByText("Ana Silva")).toBeInTheDocument();
    expect(row("Ana Silva")).toHaveTextContent("Responsável · Todas as permissões");
    expect(row("Bruno Silva")).toHaveTextContent("Pode lançar · Pode estornar");
    // Junto ao próprio nome, Caio vê que só consulta
    expect(row("Caio Silva")).toHaveTextContent("você · Somente leitura");
    expect(row("Duda Silva")).toHaveTextContent(/Pode estornar$/);
    expect(row("Duda Silva")).not.toHaveTextContent("Pode lançar");
  });

  it("responsável: o próprio cartão mostra \"Todas as permissões\" e não tem interruptores", async () => {
    setup(GROUP);

    const ana = await screen.findByRole("group", { name: "Ana Silva" });
    expect(ana).toHaveTextContent("Todas as permissões");
    // Desce para a linha seguinte em vez de cortar (320 px / zoom 200 %, REVIEW-008 I-1)
    const all = within(ana).getByText("Todas as permissões");
    expect(all).toHaveClass("whitespace-nowrap");
    expect(all.parentElement).toHaveClass("break-words");
    expect(all.parentElement).not.toHaveClass("truncate");
    expect(within(ana).queryByRole("switch")).not.toBeInTheDocument();
    const carlos = screen.getByRole("group", { name: "Carlos Souza" });
    expect(within(carlos).getAllByRole("switch")).toHaveLength(2);
  });
});
