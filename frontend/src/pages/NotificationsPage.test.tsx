import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationsPage from "./NotificationsPage";
import { NotificationBell } from "../components/notification/NotificationBell";
import { NotificationBellVariant } from "../components/ui/variants";
import { GroupInvitationStatus } from "../types/invitation";
import type { GroupInvitationInfo } from "../types/invitation";
import { NotificationType } from "../types/notification";
import type { NotificationInfo, NotificationPage } from "../types/notification";
import { USER_ID, storeSession } from "../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../test/utils";
import type { MockHandler, MockRequest, MockResponse } from "../test/utils";
import { notifySuccess } from "../utils/notify";

vi.mock("../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/notify")>();
  return { ...actual, notifySuccess: vi.fn(), notifyError: vi.fn() };
});

const NOW = new Date("2026-11-01T18:00:00Z");

const received = (overrides: Partial<NotificationInfo> = {}): NotificationInfo => ({
  notificationId: 40,
  type: NotificationType.GroupInvitationReceived,
  createdAt: "2026-11-01T17:32:00Z",
  isRead: false,
  group: { groupId: 3, name: "Silva" },
  actor: { userId: 1, firstName: "Ana", lastName: "Silva" },
  invitation: { invitationId: 12, status: GroupInvitationStatus.Pending },
  ...overrides,
});

const answered = (status: GroupInvitationStatus): GroupInvitationInfo => ({
  invitationId: 12,
  groupId: 3,
  groupName: "Silva",
  invitedUser: { userId: USER_ID, firstName: "Bruno", lastName: "Lima" },
  invitedBy: { userId: 1, firstName: "Ana", lastName: "Silva" },
  status,
  createdAt: "2026-11-01T17:32:00Z",
  respondedAt: "2026-11-01T18:00:00Z",
});

const page = (items: NotificationInfo[], nextBeforeId: number | null = null): MockResponse => ({
  body: { items, nextBeforeId } satisfies NotificationPage,
});

const setup = (routes: Record<string, MockResponse | MockHandler>, withBell = false) => {
  storeSession();
  const fetchMock = mockFetch({
    "GET /api/notifications/unread-count": { body: { unread: 0 } },
    "POST /api/notifications/read": { status: 204 },
    "GET /api/groups": { body: [] },
    "GET /api/wallets": { body: [] },
    ...routes,
  });
  const user = userEvent.setup();
  const view = renderWithProviders(
    withBell ? (
      <>
        <NotificationBell variant={NotificationBellVariant.Sidebar} />
        <NotificationsPage />
      </>
    ) : (
      <NotificationsPage />
    ),
    {
      path: "/notificacoes",
      extraRoutes: [
        { path: "/familias/:groupId", element: <p>Tela da família</p> },
        { path: "/carteiras/:walletId", element: <p>Extrato da carteira</p> },
      ],
    },
  );
  return { fetchMock, user, ...view };
};

const listItems = async () => within(await screen.findByRole("list", { name: "Notificações" })).getAllByRole("listitem");

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.mocked(notifySuccess).mockClear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  // -------------------------------------------------------------------------
  // US2 — convites
  // -------------------------------------------------------------------------

  it("convite pendente mostra família, quem convidou, data e Aceitar/Recusar", async () => {
    const { container } = setup({ "GET /api/notifications": page([received()]) });

    const [item] = await listItems();
    expect(item).toHaveTextContent("Não lida. Ana Silva convidou você para a família Silva");
    expect(item).toHaveTextContent("Hoje às 14:32");
    expect(item?.querySelector("time")).toHaveAttribute("datetime", "2026-11-01T17:32:00.000Z");
    expect(screen.getByRole("heading", { level: 1, name: "Notificações" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceitar convite para a família Silva" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recusar convite para a família Silva" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("aceitar chama a rota, mostra o toast e recarrega famílias e carteiras", async () => {
    const { fetchMock, user } = setup({
      "GET /api/notifications": page([received()]),
      "POST /api/invitations/12/accept": { body: answered(GroupInvitationStatus.Accepted) },
    });

    await user.click(await screen.findByRole("button", { name: "Aceitar convite para a família Silva" }));

    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Você agora faz parte de Silva."));
    expect(requestsTo(fetchMock, "POST /api/invitations/12/accept")).toHaveLength(1);
    expect(await screen.findByText("Você aceitou")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/convidou você para a família/).closest("p")).toHaveFocus(),
    );
    expect(screen.queryByRole("button", { name: /Aceitar convite/ })).not.toBeInTheDocument();
    await waitFor(() => expect(requestsTo(fetchMock, "GET /api/groups")).toHaveLength(1));
    await waitFor(() => expect(requestsTo(fetchMock, "GET /api/wallets")).toHaveLength(1));
  });

  it("recusar mostra \"Você recusou\"", async () => {
    const { fetchMock, user } = setup({
      "GET /api/notifications": page([received()]),
      "POST /api/invitations/12/decline": { body: answered(GroupInvitationStatus.Declined) },
    });

    await user.click(await screen.findByRole("button", { name: "Recusar convite para a família Silva" }));

    expect(await screen.findByText("Você recusou")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST /api/invitations/12/decline")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Recusar convite/ })).not.toBeInTheDocument();
  });

  it("409 mostra \"Este convite não está mais disponível.\"", async () => {
    const { user } = setup({
      "GET /api/notifications": page([received()]),
      "POST /api/invitations/12/accept": apiError(409, "Este convite não está mais disponível."),
    });

    await user.click(await screen.findByRole("button", { name: "Aceitar convite para a família Silva" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Este convite não está mais disponível.");
    expect(screen.queryByRole("button", { name: /Aceitar convite/ })).not.toBeInTheDocument();
    // O foco vai para a frase do item, não para o <body>
    await waitFor(() =>
      expect(screen.getByText(/convidou você para a família/).closest("p")).toHaveFocus(),
    );
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("botões ficam bloqueados durante o envio", async () => {
    let release: (response: MockResponse) => void = () => undefined;
    const { user } = setup({
      "GET /api/notifications": page([received()]),
      "POST /api/invitations/12/accept": () =>
        new Promise<MockResponse>((resolve) => {
          release = resolve;
        }),
    });

    await user.click(await screen.findByRole("button", { name: "Aceitar convite para a família Silva" }));

    const accept = screen.getByRole("button", { name: "Aceitar convite para a família Silva" });
    expect(accept).toBeDisabled();
    expect(accept).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Recusar convite para a família Silva" })).toBeDisabled();

    release({ body: answered(GroupInvitationStatus.Accepted) });
    expect(await screen.findByText("Você aceitou")).toBeInTheDocument();
  });

  it("estados finais aparecem sem botões", async () => {
    setup({
      "GET /api/notifications": page([
        received({ notificationId: 40, isRead: true, invitation: { invitationId: 12, status: GroupInvitationStatus.Canceled } }),
        received({ notificationId: 39, isRead: true, invitation: { invitationId: 11, status: GroupInvitationStatus.Accepted } }),
        received({ notificationId: 38, isRead: true, invitation: { invitationId: 10, status: GroupInvitationStatus.Declined } }),
      ]),
    });

    const items = await listItems();
    expect(items[0]).toHaveTextContent("Convite cancelado");
    expect(items[1]).toHaveTextContent("Você aceitou");
    expect(items[2]).toHaveTextContent("Você recusou");
    expect(screen.queryByRole("button", { name: /Aceitar convite/ })).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // US3 — área de notificações
  // -------------------------------------------------------------------------

  it("abrir marca as exibidas como lidas e zera o contador do sino", async () => {
    let unread = 2;
    const { fetchMock } = setup(
      {
        "GET /api/notifications/unread-count": () => ({ body: { unread } }),
        "POST /api/notifications/read": (request: MockRequest) => {
          const ids = (request.body as { notificationIds: number[] }).notificationIds;
          unread -= ids.length;
          return { status: 204 };
        },
        "GET /api/notifications": page([
          received({ notificationId: 40 }),
          received({
            notificationId: 39,
            type: NotificationType.GroupInvitationAccepted,
            actor: { userId: 9, firstName: "Bruno", lastName: "Lima" },
            invitation: { invitationId: 8, status: GroupInvitationStatus.Accepted },
          }),
          received({ notificationId: 38, isRead: true, invitation: { invitationId: 7, status: GroupInvitationStatus.Accepted } }),
        ]),
      },
      true,
    );

    await waitFor(() =>
      expect(requestsTo(fetchMock, "POST /api/notifications/read")).toEqual([{ notificationIds: [40, 39] }]),
    );
    await waitFor(() => expect(screen.getByRole("link", { name: "Notificações" })).toBeInTheDocument());
    // O indicador de "não lida" continua visível enquanto a pessoa está na tela
    const items = await listItems();
    expect(items[0]).toHaveTextContent("Não lida.");
  });

  it("aceito e recusado para o responsável; o aceito leva à família", async () => {
    const { user } = setup({
      "GET /api/notifications": page([
        received({
          notificationId: 50,
          isRead: true,
          type: NotificationType.GroupInvitationAccepted,
          actor: { userId: 9, firstName: "Bruno", lastName: "Lima" },
          invitation: { invitationId: 12, status: GroupInvitationStatus.Accepted },
        }),
        received({
          notificationId: 49,
          isRead: true,
          type: NotificationType.GroupInvitationDeclined,
          actor: { userId: 10, firstName: "Marina", lastName: "Costa" },
          invitation: { invitationId: 13, status: GroupInvitationStatus.Declined },
        }),
      ]),
    });

    const items = await listItems();
    expect(items[0]).toHaveTextContent("Bruno Lima aceitou o convite para Silva");
    expect(items[1]).toHaveTextContent("Marina Costa recusou o convite para Silva");
    expect(within(items[1] as HTMLElement).queryByRole("link")).not.toBeInTheDocument();

    const link = within(items[0] as HTMLElement).getByRole("link", { name: /Bruno Lima aceitou o convite para Silva/ });
    expect(link).toHaveAttribute("href", "/familias/3");
    await user.click(link);
    expect(await screen.findByText("Tela da família")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Feature 008 — permissões e estornos (T046)
  // -------------------------------------------------------------------------

  const permissionsChanged = (overrides: Partial<NotificationInfo> = {}): NotificationInfo =>
    received({
      notificationId: 60,
      isRead: true,
      type: NotificationType.MemberPermissionsChanged,
      invitation: null,
      permissions: { canCreateTransactions: true, canReverse: false },
      ...overrides,
    });

  const transactionReversed = (overrides: Partial<NotificationInfo> = {}): NotificationInfo =>
    received({
      notificationId: 61,
      isRead: true,
      type: NotificationType.TransactionReversed,
      actor: { userId: 9, firstName: "Bruno", lastName: "Silva" },
      invitation: null,
      transactionId: 61250,
      walletId: 12,
      walletName: "Mesada",
      ...overrides,
    });

  it("permissões mudadas: frase com os dois lados do resumo e toque abre a família", async () => {
    const { container, user } = setup({
      "GET /api/notifications": page([
        permissionsChanged(),
        permissionsChanged({ notificationId: 59, permissions: { canCreateTransactions: false, canReverse: false } }),
        permissionsChanged({ notificationId: 58, permissions: null }),
      ]),
    });

    const items = await listItems();
    const sentence = (item: HTMLElement | undefined) => (item as HTMLElement).querySelector("p") as HTMLElement;
    // Na tela " · "; para o leitor, vírgula (o ponto médio fica aria-hidden — REVIEW-008 M-1)
    const visible = (element: HTMLElement) => {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".sr-only").forEach((node) => node.remove());
      return clone.textContent;
    };
    expect(visible(sentence(items[0]))).toBe(
      "Ana Silva mudou suas permissões na família Silva: pode lançar · não pode estornar.",
    );
    const separator = within(sentence(items[0])).getByText("·", { exact: false });
    expect(separator).toHaveAttribute("aria-hidden", "true");
    expect(separator.nextElementSibling).toHaveClass("sr-only");
    expect(separator.nextElementSibling).toHaveTextContent(",");
    expect(items[1]).toHaveTextContent("Ana Silva mudou suas permissões na família Silva: somente leitura.");
    expect(items[2]).toHaveTextContent(/^Ana Silva mudou suas permissões na família Silva\./);
    expect(await axe(container)).toHaveNoViolations();

    const link = within(items[0] as HTMLElement).getByRole("link", { name: /mudou suas permissões/ });
    expect(link).toHaveAttribute("href", "/familias/3");
    await user.click(link);
    expect(await screen.findByText("Tela da família")).toBeInTheDocument();
  });

  it("estorno feito por outra pessoa: frase com a carteira e toque abre o extrato dela", async () => {
    const { user } = setup({
      "GET /api/notifications": page([
        transactionReversed(),
        transactionReversed({ notificationId: 57, walletId: null, walletName: null }),
      ]),
    });

    const items = await listItems();
    expect(items[0]).toHaveTextContent("Bruno Silva estornou um lançamento da sua carteira Mesada.");
    expect(items[1]).toHaveTextContent("Bruno Silva estornou um lançamento de uma carteira sua.");
    // Sem a carteira, o item fica estático
    expect(within(items[1] as HTMLElement).queryByRole("link")).not.toBeInTheDocument();

    const link = within(items[0] as HTMLElement).getByRole("link", { name: /estornou um lançamento/ });
    expect(link).toHaveAttribute("href", "/carteiras/12");
    await user.click(link);
    expect(await screen.findByText("Extrato da carteira")).toBeInTheDocument();
  });

  it("\"Carregar mais\" busca a próxima página e marca as novas como lidas", async () => {
    const { fetchMock, user } = setup({
      "GET /api/notifications": (request: MockRequest) =>
        request.search.includes("beforeId=40")
          ? page([received({ notificationId: 39, invitation: { invitationId: 11, status: GroupInvitationStatus.Canceled } })])
          : page([received({ notificationId: 41, isRead: true })], 40),
    });

    await user.click(await screen.findByRole("button", { name: "Carregar mais" }));

    await waitFor(async () => expect(await listItems()).toHaveLength(2));
    const listCalls = fetchMock.mock.calls
      .map(([input]) => new URL(String(input), "http://localhost"))
      .filter((url) => url.pathname === "/api/notifications");
    expect(listCalls.map((url) => url.search)).toEqual(["?limit=20", "?beforeId=40&limit=20"]);
    await waitFor(() =>
      expect(requestsTo(fetchMock, "POST /api/notifications/read")).toEqual([{ notificationIds: [39] }]),
    );
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("sem notificações mostra o estado vazio", async () => {
    setup({ "GET /api/notifications": page([]) });

    expect(await screen.findByText("Nenhuma notificação por enquanto")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Notificações" })).not.toBeInTheDocument();
  });

  it("erro ao carregar mostra \"Tentar novamente\"", async () => {
    let attempts = 0;
    const { user } = setup({
      "GET /api/notifications": () => {
        attempts += 1;
        return attempts === 1 ? apiError(500, "Falha ao carregar.") : page([received()]);
      },
    });

    await user.click(await screen.findByRole("button", { name: "Tentar novamente" }));

    expect(await listItems()).toHaveLength(1);
  });
});
