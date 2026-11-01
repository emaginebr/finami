import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberManager } from "./MemberManager";
import type { GroupInfo } from "../../types/group";
import { USER_ID, makeGroup, storeSession } from "../../test/fixtures";
import { mockFetch, renderWithProviders, requestsTo } from "../../test/utils";
import type { MockHandler, MockResponse } from "../../test/utils";

const GROUP = makeGroup({
  groupId: 1,
  name: "Silva",
  isResponsible: true,
  responsibleUserId: USER_ID,
  members: [
    { userId: USER_ID, firstName: "Ana", lastName: "Silva", joinedAt: "2026-01-01T00:00:00Z" },
    { userId: 8, firstName: "Carlos", lastName: "Souza", joinedAt: "2026-01-01T00:00:00Z" },
  ],
});

const setup = (group: GroupInfo, routes: Record<string, MockResponse | MockHandler> = {}) => {
  storeSession();
  const fetchMock = mockFetch({ "GET /api/groups/1": { body: group }, ...routes });
  const user = userEvent.setup();
  renderWithProviders(<MemberManager group={group} currentUserId={USER_ID} />);
  return { fetchMock, user };
};

describe("MemberManager", () => {
  it("não renderiza ações para quem não é responsável", async () => {
    setup({ ...GROUP, isResponsible: false, responsibleUserId: 8 });

    expect(await screen.findByText("Carlos Souza")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Retirar/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Só o responsável pode incluir ou retirar pessoas/)).toBeInTheDocument();
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
});
