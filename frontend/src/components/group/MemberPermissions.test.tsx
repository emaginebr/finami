import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberManager } from "./MemberManager";
import { useGroup } from "../../hooks/useGroup";
import { StatementVisibility } from "../../types/group";
import type { GroupInfo, GroupMemberInfo, MemberPermissionsInfo } from "../../types/group";
import { USER_ID, makeGroup, storeSession } from "../../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../../test/utils";
import type { MockHandler, MockRequest, MockResponse } from "../../test/utils";
import { reportOffline } from "../../utils/connectivity";
import { notifyError, notifySuccess, notifyWarning } from "../../utils/notify";

vi.mock("../../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/notify")>();
  return { ...actual, notifySuccess: vi.fn(), notifyError: vi.fn(), notifyWarning: vi.fn() };
});

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
  statementVisibility: StatementVisibility.AllMembers,
  members: [
    member({ userId: USER_ID, firstName: "Ana", canCreateTransactions: true, canReverse: true }),
    member({ userId: 8, firstName: "Bruno" }),
    member({ userId: 9, firstName: "Caio" }),
  ],
});

const PERMISSIONS_ROUTE = "PUT /api/groups/1/members/8/permissions";

/** Responde o PUT com a família já atualizada (como a API) */
const updatedGroup = (group: GroupInfo, userId: number) => (request: MockRequest): MockResponse => {
  const body = request.body as MemberPermissionsInfo;
  return {
    body: {
      ...group,
      members: group.members.map((m) => (m.userId === userId ? { ...m, ...body } : m)),
    },
  };
};

/** A página da família lê a família do contexto: a resposta do PUT chega à folha por ele */
const Harness = ({ initial }: { initial: GroupInfo }) => {
  const { groups } = useGroup();
  const group = groups.find((g) => g.groupId === initial.groupId) ?? initial;
  return <MemberManager group={group} currentUserId={USER_ID} />;
};

const setup = (group: GroupInfo = GROUP, routes: Record<string, MockResponse | MockHandler> = {}) => {
  storeSession();
  const fetchMock = mockFetch({
    "GET /api/groups/1": { body: group },
    [PERMISSIONS_ROUTE]: updatedGroup(group, 8),
    ...routes,
  });
  const user = userEvent.setup();
  const view = renderWithProviders(<Harness initial={group} />);
  return { fetchMock, user, ...view };
};

const brunoCard = () => screen.getByRole("group", { name: "Bruno Silva" });
const brunoSwitch = (name: "Pode lançar" | "Pode estornar") => within(brunoCard()).getByRole("switch", { name });

describe("MemberPermissions", () => {
  beforeEach(() => {
    vi.mocked(notifySuccess).mockClear();
    vi.mocked(notifyError).mockClear();
    vi.mocked(notifyWarning).mockClear();
  });

  it("interruptores com rótulo, ajuda e estado; a linha do responsável não tem interruptores", async () => {
    const { container } = setup();

    const create = await screen.findAllByRole("switch", { name: "Pode lançar" });
    expect(create).toHaveLength(2);
    expect(brunoSwitch("Pode lançar")).toHaveAttribute("aria-checked", "true");
    expect(brunoSwitch("Pode lançar")).toHaveAccessibleDescription(
      "Receitas, despesas e transferências nas carteiras da família.",
    );
    expect(brunoSwitch("Pode estornar")).toHaveAttribute("aria-checked", "false");
    expect(brunoSwitch("Pode estornar")).toHaveAccessibleDescription(
      "Desfazer qualquer lançamento das carteiras da família.",
    );

    const ana = screen.getByRole("group", { name: "Ana Silva" });
    expect(within(ana).queryByRole("switch")).not.toBeInTheDocument();
    expect(ana).toHaveTextContent("Todas as permissões");
    // Com "Todos os membros" a nota de alcance não aparece
    expect(screen.queryByText(/não estão visíveis a todos/)).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("mudar um interruptor envia o PUT com os dois valores e mostra o toast", async () => {
    const { fetchMock, user } = setup();

    await screen.findByRole("group", { name: "Bruno Silva" });
    await user.click(brunoSwitch("Pode estornar"));

    await waitFor(() =>
      expect(requestsTo(fetchMock, PERMISSIONS_ROUTE)).toEqual([{ canCreateTransactions: true, canReverse: true }]),
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Permissões de Bruno atualizadas."));
    expect(brunoSwitch("Pode estornar")).toHaveAttribute("aria-checked", "true");
    expect(brunoSwitch("Pode estornar")).not.toHaveAttribute("aria-busy");
    // O foco continua no interruptor
    expect(brunoSwitch("Pode estornar")).toHaveFocus();
  });

  it("tocar no rótulo também alterna", async () => {
    const { fetchMock, user } = setup();

    await screen.findByRole("group", { name: "Bruno Silva" });
    await user.click(within(brunoCard()).getByText("Pode lançar"));

    await waitFor(() =>
      expect(requestsTo(fetchMock, PERMISSIONS_ROUTE)).toEqual([{ canCreateTransactions: false, canReverse: false }]),
    );
  });

  it("enquanto envia: estado novo, aria-busy, \"Salvando…\" e o outro interruptor do membro bloqueado", async () => {
    let release: () => void = () => undefined;
    const { fetchMock, user } = setup(GROUP, {
      [PERMISSIONS_ROUTE]: (request) =>
        new Promise<MockResponse>((resolve) => {
          release = () => resolve(updatedGroup(GROUP, 8)(request));
        }),
    });

    await screen.findByRole("group", { name: "Bruno Silva" });
    await user.click(brunoSwitch("Pode estornar"));

    const reverse = brunoSwitch("Pode estornar");
    expect(reverse).toHaveAttribute("aria-checked", "true");
    expect(reverse).toHaveAttribute("aria-busy", "true");
    expect(within(brunoCard()).getByRole("status")).toHaveTextContent("Salvando…");
    const create = brunoSwitch("Pode lançar");
    expect(create).toHaveAttribute("aria-disabled", "true");
    // Um envio por membro: tocar no outro não manda um segundo PUT
    await user.click(create);
    expect(requestsTo(fetchMock, PERMISSIONS_ROUTE)).toHaveLength(1);
    // Os interruptores de outros membros seguem livres
    const caio = screen.getByRole("group", { name: "Caio Silva" });
    expect(within(caio).getByRole("switch", { name: "Pode lançar" })).not.toHaveAttribute("aria-disabled");

    await act(async () => {
      release();
    });
    await waitFor(() => expect(brunoSwitch("Pode estornar")).not.toHaveAttribute("aria-busy"));
    expect(brunoSwitch("Pode lançar")).not.toHaveAttribute("aria-disabled");
  });

  it("erro: volta ao estado anterior e mostra a mensagem no cartão, sem toast", async () => {
    const { user } = setup(GROUP, {
      [PERMISSIONS_ROUTE]: apiError(500, "Falha ao salvar as permissões."),
    });

    await screen.findByRole("group", { name: "Bruno Silva" });
    await user.click(brunoSwitch("Pode lançar"));

    const alert = await within(brunoCard()).findByRole("alert");
    expect(alert).toHaveTextContent("Falha ao salvar as permissões.");
    expect(brunoSwitch("Pode lançar")).toHaveAttribute("aria-checked", "true");
    expect(brunoSwitch("Pode lançar")).toHaveAccessibleDescription(/Falha ao salvar as permissões\./);
    expect(brunoSwitch("Pode estornar")).toHaveAccessibleDescription(/Falha ao salvar as permissões\./);
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("a mesma falha duas vezes remonta o alerta para ser anunciada de novo (REVIEW-008 M-2)", async () => {
    const { user } = setup(GROUP, {
      [PERMISSIONS_ROUTE]: apiError(500, "Falha ao salvar as permissões."),
    });

    await screen.findByRole("group", { name: "Bruno Silva" });
    await user.click(brunoSwitch("Pode lançar"));
    const first = await within(brunoCard()).findByRole("alert");

    await user.click(brunoSwitch("Pode lançar"));
    await waitFor(() => expect(within(brunoCard()).getByRole("alert")).not.toBe(first));
    expect(within(brunoCard()).getByRole("alert")).toHaveTextContent("Falha ao salvar as permissões.");
  });

  it("403/404/422 (ex.: deixou de ser responsável): erro no cartão, toast que sobrevive à folha e recarga", async () => {
    const message = "As permissões do responsável não podem ser alteradas.";
    const { fetchMock, user } = setup(GROUP, { [PERMISSIONS_ROUTE]: apiError(422, message) });

    await screen.findByRole("group", { name: "Bruno Silva" });
    const before = requestsTo(fetchMock, "GET /api/groups/1").length;
    await user.click(brunoSwitch("Pode lançar"));

    expect(await within(brunoCard()).findByRole("alert")).toHaveTextContent(message);
    expect(notifyError).toHaveBeenCalledWith(expect.objectContaining({ mensagem: message }));
    await waitFor(() => expect(requestsTo(fetchMock, "GET /api/groups/1").length).toBeGreaterThan(before));
  });

  it("rede cai durante o envio: mensagem sobre a permissão, não sobre lançamento (REVIEW-008 I-2)", async () => {
    const { user } = setup(GROUP, {
      [PERMISSIONS_ROUTE]: () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await screen.findByRole("group", { name: "Bruno Silva" });
    await user.click(brunoSwitch("Pode estornar"));

    const alert = await within(brunoCard()).findByRole("alert");
    expect(alert).toHaveTextContent(
      "Não foi possível confirmar a mudança. Confira as permissões de Bruno quando a conexão voltar.",
    );
    expect(alert).not.toHaveTextContent(/lançamento|extrato/);
  });

  it("sem internet: interruptores aria-disabled com a nota da feature 005 e nenhum PUT", async () => {
    const { fetchMock, user } = setup();

    await screen.findByRole("group", { name: "Bruno Silva" });
    act(() => reportOffline());

    const note = await screen.findByText("Sem internet. Conecte-se para fazer alterações.");
    expect(note).toBeInTheDocument();
    const create = brunoSwitch("Pode lançar");
    expect(create).toHaveAttribute("aria-disabled", "true");
    expect(create).toHaveAccessibleDescription(/Sem internet\. Conecte-se para fazer alterações\./);
    // Continua focável e mostra o estado atual
    expect(create).not.toBeDisabled();
    expect(create).toHaveAttribute("aria-checked", "true");

    await user.click(create);
    expect(notifyWarning).toHaveBeenCalledWith("Sem internet. Conecte-se para fazer alterações.");
    expect(requestsTo(fetchMock, PERMISSIONS_ROUTE)).toHaveLength(0);
  });

  it("visibilidade restrita: nota de alcance ligada a todos os \"Pode estornar\"", async () => {
    setup({ ...GROUP, statementVisibility: StatementVisibility.ResponsibleOnly });

    await screen.findByRole("group", { name: "Bruno Silva" });
    expect(screen.getByText(/Os extratos desta família não estão visíveis a todos/)).toBeInTheDocument();
    for (const reverse of screen.getAllByRole("switch", { name: "Pode estornar" })) {
      expect(reverse).toHaveAccessibleDescription(/o membro só estorna lançamentos/);
    }
    expect(brunoSwitch("Pode lançar")).not.toHaveAccessibleDescription(/só estorna/);
  });
});
