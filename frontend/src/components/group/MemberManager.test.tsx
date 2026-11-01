import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberManager } from "./MemberManager";
import type { GroupInfo } from "../../types/group";
import { USER_ID, makeGroup, makeUser, storeSession } from "../../test/fixtures";
import { apiError, mockFetch, renderWithProviders, requestsTo } from "../../test/utils";
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
    expect(screen.queryByLabelText("Email exato da pessoa")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cadastrar pessoa sem login/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Só o responsável pode incluir ou retirar pessoas/)).toBeInTheDocument();
  });

  it("busca por email e inclui o membro", async () => {
    const { fetchMock, user } = setup(GROUP, {
      "GET /api/users/search": { body: { userId: 20, firstName: "Rafael", lastName: "Lima" } },
      "POST /api/groups/1/members": { status: 201, body: GROUP },
    });

    await user.type(await screen.findByLabelText("Email exato da pessoa"), "rafa@exemplo.com");
    await user.click(screen.getByRole("button", { name: "Buscar pessoa" }));
    await user.click(await screen.findByRole("button", { name: "Incluir Rafael Lima" }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, "POST /api/groups/1/members")).toEqual([{ userId: 20 }]),
    );
    const search = fetchMock.mock.calls.find(([input]) => String(input).includes("/api/users/search"));
    expect(String(search?.[0])).toContain("email=rafa%40exemplo.com");
  });

  it("cadastra pessoa sem login e inclui na família", async () => {
    const { fetchMock, user } = setup(GROUP, {
      "POST /api/users": {
        status: 201,
        body: makeUser({ userId: 21, firstName: "Lia", lastName: "Silva", email: null, canLogin: false, hasPassword: false }),
      },
      "POST /api/groups/1/members": { status: 201, body: GROUP },
    });

    await user.click(await screen.findByRole("button", { name: /Cadastrar pessoa sem login/ }));
    const form = await screen.findByRole("group", { name: "Pessoa sem login" });
    await user.type(within(form).getByLabelText("Nome"), "Lia");
    await user.type(within(form).getByLabelText("Sobrenome"), "Silva");
    await user.click(within(form).getByRole("button", { name: "Cadastrar e incluir" }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, "POST /api/groups/1/members")).toEqual([{ userId: 21 }]),
    );
    expect(requestsTo(fetchMock, "POST /api/users")).toEqual([
      { firstName: "Lia", lastName: "Silva", email: null, password: null },
    ]);
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

  it("409 mostra que a pessoa já é membro", async () => {
    const { user } = setup(GROUP, {
      "GET /api/users/search": { body: { userId: 8, firstName: "Carlos", lastName: "Souza" } },
      "POST /api/groups/1/members": apiError(409, "Usuário já é membro do grupo."),
    });

    await user.type(await screen.findByLabelText("Email exato da pessoa"), "carlos@exemplo.com");
    await user.click(screen.getByRole("button", { name: "Buscar pessoa" }));
    await user.click(await screen.findByRole("button", { name: "Incluir Carlos Souza" }));

    expect(await screen.findByText("Essa pessoa já é membro da família.")).toBeInTheDocument();
  });
});
