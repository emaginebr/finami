import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddMemberSheet } from "./AddMemberSheet";
import { GroupInvitationStatus, MemberLookupStatus } from "../../types/invitation";
import type { GroupInvitationInfo, MemberLookupResult } from "../../types/invitation";
import { USER_ID, makeGroup, storeSession } from "../../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../../test/utils";
import type { MockHandler, MockResponse } from "../../test/utils";
import { notifySuccess } from "../../utils/notify";

vi.mock("../../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/notify")>();
  return { ...actual, notifySuccess: vi.fn(), notifyError: vi.fn() };
});

const GROUP_ID = 3;
const LOOKUP = `POST /api/groups/${GROUP_ID}/member-lookup`;
const CREATE = `POST /api/groups/${GROUP_ID}/members/new`;
const INVITE = `POST /api/groups/${GROUP_ID}/invitations`;

const lookup = (overrides: Partial<MemberLookupResult>): MockResponse => ({
  body: {
    status: MemberLookupStatus.Available,
    email: "pedro@exemplo.com",
    user: null,
    invitationId: null,
    ...overrides,
  } satisfies MemberLookupResult,
});

const PENDING: GroupInvitationInfo = {
  invitationId: 12,
  groupId: GROUP_ID,
  groupName: "Silva",
  invitedUser: { userId: 9, firstName: "Bruno", lastName: "Lima" },
  invitedBy: { userId: USER_ID, firstName: "Ana", lastName: "Silva" },
  status: GroupInvitationStatus.Pending,
  createdAt: "2026-10-30T15:00:00Z",
  respondedAt: null,
};

const GROUP = makeGroup({ groupId: GROUP_ID, name: "Silva" });

const setup = (routes: Record<string, MockResponse | MockHandler> = {}) => {
  storeSession();
  const fetchMock = mockFetch(routes);
  const onOpenChange = vi.fn();
  const onChanged = vi.fn();
  const user = userEvent.setup();
  const view = renderWithProviders(
    <AddMemberSheet
      open
      onOpenChange={onOpenChange}
      groupId={GROUP_ID}
      groupName="Silva"
      pendingInvitations={[PENDING]}
      onChanged={onChanged}
    />,
  );
  return { fetchMock, onOpenChange, onChanged, user, ...view };
};

type User = ReturnType<typeof userEvent.setup>;

const submitEmail = async (user: User, email: string) => {
  const dialog = await screen.findByRole("dialog", { name: "Adicionar membro" });
  await user.type(within(dialog).getByLabelText("Email"), email);
  await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
  return dialog;
};

describe("AddMemberSheet", () => {
  beforeEach(() => {
    vi.mocked(notifySuccess).mockClear();
  });

  it("começa pelo email, com atalho \"Adicionar sem email\" e sem violações do axe", async () => {
    const { baseElement } = setup();

    const dialog = await screen.findByRole("dialog", { name: "Adicionar membro" });
    const email = within(dialog).getByLabelText("Email");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toHaveAttribute("inputmode", "email");
    await waitFor(() => expect(email).toHaveFocus());
    expect(within(dialog).getByRole("button", { name: /Adicionar sem email/ })).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Nome")).not.toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("email inválido mostra o erro no campo e não verifica", async () => {
    const { fetchMock, user } = setup();

    const dialog = await submitEmail(user, "ana@");

    expect(await within(dialog).findByText("Informe um email válido.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(requestsTo(fetchMock, LOOKUP)).toHaveLength(0);
  });

  it("Available → nome e sobrenome → cria com o email e mostra o toast", async () => {
    const { fetchMock, onChanged, onOpenChange, user } = setup({
      [LOOKUP]: lookup({}),
      [CREATE]: { status: 201, body: GROUP },
    });

    const dialog = await submitEmail(user, " pedro@exemplo.com ");
    expect(await within(dialog).findByRole("heading", { name: "Nova pessoa" })).toBeInTheDocument();
    expect(within(dialog).getByText("pedro@exemplo.com")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Nome"), "Pedro");
    await user.type(within(dialog).getByLabelText("Sobrenome"), "Silva");
    await user.click(within(dialog).getByRole("button", { name: "Adicionar à família" }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, CREATE)).toEqual([
        { firstName: "Pedro", lastName: "Silva", email: "pedro@exemplo.com" },
      ]),
    );
    expect(requestsTo(fetchMock, LOOKUP)).toEqual([{ email: "pedro@exemplo.com" }]);
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Pedro Silva agora faz parte da família."));
    expect(onChanged).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("\"Adicionar sem email\" envia email null", async () => {
    const { fetchMock, user } = setup({ [CREATE]: { status: 201, body: GROUP } });

    const dialog = await screen.findByRole("dialog", { name: "Adicionar membro" });
    await user.click(within(dialog).getByRole("button", { name: /Adicionar sem email/ }));
    expect(await within(dialog).findByRole("heading", { name: "Nova pessoa sem email" })).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Nome"), "Lia");
    await user.type(within(dialog).getByLabelText("Sobrenome"), "Silva");
    await user.click(within(dialog).getByRole("button", { name: "Adicionar à família" }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, CREATE)).toEqual([{ firstName: "Lia", lastName: "Silva", email: null }]),
    );
    expect(requestsTo(fetchMock, LOOKUP)).toHaveLength(0);
  });

  it("nome e sobrenome são obrigatórios", async () => {
    const { fetchMock, user } = setup();

    const dialog = await screen.findByRole("dialog", { name: "Adicionar membro" });
    await user.click(within(dialog).getByRole("button", { name: /Adicionar sem email/ }));
    await user.click(await within(dialog).findByRole("button", { name: "Adicionar à família" }));

    expect(await within(dialog).findAllByText("Campo obrigatório.")).toHaveLength(2);
    expect(requestsTo(fetchMock, CREATE)).toHaveLength(0);
  });

  it("Registered mostra o nome e só oferece convite, sem formulário de cadastro", async () => {
    const { baseElement, user } = setup({
      [LOOKUP]: lookup({
        status: MemberLookupStatus.Registered,
        email: "ana@exemplo.com",
        user: { userId: 9, firstName: "Ana", lastName: "Souza" },
      }),
    });

    const dialog = await submitEmail(user, "Ana@Exemplo.com");

    expect(
      await within(dialog).findByText(
        "Esse email já pertence a Ana Souza. Você pode enviar um convite para a família.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole("heading", { name: "Pessoa encontrada" })).toHaveFocus(),
    );
    expect(within(dialog).getByRole("button", { name: "Convidar para a família" })).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Nome")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Adicionar à família" })).not.toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("Registered → \"Convidar para a família\" envia o convite e mostra o toast", async () => {
    const { fetchMock, onChanged, onOpenChange, user } = setup({
      [LOOKUP]: lookup({
        status: MemberLookupStatus.Registered,
        email: "ana@exemplo.com",
        user: { userId: 9, firstName: "Ana", lastName: "Souza" },
      }),
      [INVITE]: { status: 201, body: { ...PENDING, invitedUser: { userId: 9, firstName: "Ana", lastName: "Souza" } } },
    });

    const dialog = await submitEmail(user, "ana@exemplo.com");
    await user.click(await within(dialog).findByRole("button", { name: "Convidar para a família" }));

    await waitFor(() => expect(requestsTo(fetchMock, INVITE)).toEqual([{ email: "ana@exemplo.com" }]));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Convite enviado para Ana Souza."));
    expect(onChanged).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("AlreadyMember avisa e não oferece convite", async () => {
    const { user } = setup({
      [LOOKUP]: lookup({
        status: MemberLookupStatus.AlreadyMember,
        email: "carlos@exemplo.com",
        user: { userId: 8, firstName: "Carlos", lastName: "Souza" },
      }),
    });

    const dialog = await submitEmail(user, "carlos@exemplo.com");

    expect(await within(dialog).findByText("Carlos Souza já é membro desta família.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Convidar para a família" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Usar outro email" }));
    expect(await within(dialog).findByLabelText("Email")).toHaveValue("carlos@exemplo.com");
  });

  it("o próprio email mostra \"Você já faz parte desta família.\"", async () => {
    const { user } = setup({
      [LOOKUP]: lookup({
        status: MemberLookupStatus.AlreadyMember,
        email: "ana@ex.com",
        user: { userId: USER_ID, firstName: "Ana", lastName: "Silva" },
      }),
    });

    const dialog = await submitEmail(user, "ana@ex.com");

    expect(await within(dialog).findByText("Você já faz parte desta família.")).toBeInTheDocument();
    expect(within(dialog).queryByText("Ana Silva já é membro desta família.")).not.toBeInTheDocument();
  });

  it("PendingInvite avisa e permite cancelar o convite com ConfirmModal", async () => {
    const { fetchMock, onChanged, user } = setup({
      [LOOKUP]: lookup({
        status: MemberLookupStatus.PendingInvite,
        email: "bruno@exemplo.com",
        user: { userId: 9, firstName: "Bruno", lastName: "Lima" },
        invitationId: 12,
      }),
      [`DELETE /api/groups/${GROUP_ID}/invitations/12`]: {
        body: { ...PENDING, status: GroupInvitationStatus.Canceled },
      },
    });

    const dialog = await submitEmail(user, "bruno@exemplo.com");

    expect(await within(dialog).findByText("Já existe um convite pendente para Bruno Lima.")).toBeInTheDocument();
    expect(within(dialog).getByText(/^Enviado em/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Convidar para a família" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancelar convite" }));
    const confirm = await screen.findByRole("alertdialog", { name: /Cancelar o convite de Bruno Lima\?/ });
    expect(within(confirm).getByRole("button", { name: "Manter convite" })).toHaveFocus();
    await user.click(within(confirm).getByRole("button", { name: "Cancelar convite" }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, `DELETE /api/groups/${GROUP_ID}/invitations/12`)).toHaveLength(1),
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Convite cancelado."));
    expect(onChanged).toHaveBeenCalled();
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
  });

  it("erro do servidor ao criar mantém os dados no passo", async () => {
    const { user } = setup({
      [LOOKUP]: lookup({}),
      [CREATE]: apiError(500, "Falha ao salvar a pessoa."),
    });

    const dialog = await submitEmail(user, "pedro@exemplo.com");
    await user.type(await within(dialog).findByLabelText("Nome"), "Pedro");
    await user.type(within(dialog).getByLabelText("Sobrenome"), "Silva");
    await user.click(within(dialog).getByRole("button", { name: "Adicionar à família" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Falha ao salvar a pessoa.");
    expect(within(dialog).getByLabelText("Nome")).toHaveValue("Pedro");
    expect(within(dialog).getByLabelText("Sobrenome")).toHaveValue("Silva");
    expect(within(dialog).getByRole("button", { name: "Adicionar à família" })).toBeEnabled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("409 de email ao criar refaz a verificação e cai no convite", async () => {
    let lookups = 0;
    const { fetchMock, user } = setup({
      [LOOKUP]: () => {
        lookups += 1;
        return lookups === 1
          ? lookup({})
          : lookup({
              status: MemberLookupStatus.Registered,
              user: { userId: 30, firstName: "Pedro", lastName: "Souza" },
            });
      },
      [CREATE]: apiError(409, "Email já cadastrado."),
    });

    const dialog = await submitEmail(user, "pedro@exemplo.com");
    await user.type(await within(dialog).findByLabelText("Nome"), "Pedro");
    await user.type(within(dialog).getByLabelText("Sobrenome"), "Silva");
    await user.click(within(dialog).getByRole("button", { name: "Adicionar à família" }));

    expect(
      await within(dialog).findByText(
        "Esse email já pertence a Pedro Souza. Você pode enviar um convite para a família.",
      ),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, LOOKUP)).toHaveLength(2);
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });
});
