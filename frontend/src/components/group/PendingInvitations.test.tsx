import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PendingInvitations } from "./PendingInvitations";
import { GroupInvitationStatus } from "../../types/invitation";
import type { GroupInvitationInfo } from "../../types/invitation";
import { USER_ID, storeSession } from "../../test/fixtures";
import { apiError, axe, mockFetch, renderWithProviders, requestsTo } from "../../test/utils";
import type { MockHandler, MockResponse } from "../../test/utils";
import { notifyError, notifySuccess } from "../../utils/notify";

vi.mock("../../utils/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/notify")>();
  return { ...actual, notifySuccess: vi.fn(), notifyError: vi.fn() };
});

const invitation = (invitationId: number, firstName: string, lastName: string, createdAt: string): GroupInvitationInfo => ({
  invitationId,
  groupId: 3,
  groupName: "Silva",
  invitedUser: { userId: 100 + invitationId, firstName, lastName },
  invitedBy: { userId: USER_ID, firstName: "Ana", lastName: "Silva" },
  status: GroupInvitationStatus.Pending,
  createdAt,
  respondedAt: null,
});

const INVITATIONS = [
  invitation(12, "Bruno", "Lima", "2026-10-30T15:00:00Z"),
  invitation(11, "Marina", "Costa", "2026-10-28T12:00:00Z"),
];

const setup = (
  props: { isResponsible?: boolean; invitations?: GroupInvitationInfo[] } = {},
  routes: Record<string, MockResponse | MockHandler> = {},
) => {
  storeSession();
  const fetchMock = mockFetch(routes);
  const onCanceled = vi.fn();
  const user = userEvent.setup();
  const view = renderWithProviders(
    <PendingInvitations
      groupId={3}
      groupName="Silva"
      isResponsible={props.isResponsible ?? true}
      invitations={props.invitations ?? INVITATIONS}
      onCanceled={onCanceled}
    />,
  );
  return { fetchMock, onCanceled, user, ...view };
};

describe("PendingInvitations", () => {
  beforeEach(() => {
    vi.mocked(notifySuccess).mockClear();
    vi.mocked(notifyError).mockClear();
  });

  it("lista os convidados com nome e data do convite", async () => {
    const { container } = setup();

    const section = await screen.findByRole("region", { name: "Convites pendentes" });
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Bruno Lima");
    expect(items[0]).toHaveTextContent(/Enviado em 30 de out/);
    expect(items[0]?.querySelector("time")).toHaveAttribute("datetime", "2026-10-30T15:00:00.000Z");
    expect(within(section).getByRole("button", { name: "Cancelar convite de Marina Costa" })).toBeInTheDocument();
    expect(
      within(section).getByText("Quem foi convidado só entra na família depois de aceitar o convite."),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("cancelar pede confirmação e chama a rota", async () => {
    const { fetchMock, onCanceled, user } = setup({}, {
      "DELETE /api/groups/3/invitations/12": {
        body: { ...INVITATIONS[0], status: GroupInvitationStatus.Canceled },
      },
    });

    await user.click(await screen.findByRole("button", { name: "Cancelar convite de Bruno Lima" }));
    const dialog = await screen.findByRole("alertdialog", { name: /Cancelar o convite de Bruno Lima\?/ });
    expect(dialog).toHaveTextContent("Bruno Lima não poderá mais aceitar o convite para a família Silva.");
    expect(within(dialog).getByRole("button", { name: "Manter convite" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar convite" }));

    await waitFor(() => expect(requestsTo(fetchMock, "DELETE /api/groups/3/invitations/12")).toHaveLength(1));
    await waitFor(() => expect(onCanceled).toHaveBeenCalledWith(12));
    expect(notifySuccess).toHaveBeenCalledWith("Convite cancelado.");
  });

  it("\"Manter convite\" fecha sem cancelar", async () => {
    const { fetchMock, onCanceled, user } = setup();

    await user.click(await screen.findByRole("button", { name: "Cancelar convite de Bruno Lima" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Manter convite" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(requestsTo(fetchMock, "DELETE /api/groups/3/invitations/12")).toHaveLength(0);
    expect(onCanceled).not.toHaveBeenCalled();
  });

  it("erro ao cancelar mantém o convite e avisa", async () => {
    const { onCanceled, user } = setup({}, {
      "DELETE /api/groups/3/invitations/12": apiError(409, "Este convite não está mais disponível."),
    });

    await user.click(await screen.findByRole("button", { name: "Cancelar convite de Bruno Lima" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar convite" }));

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(onCanceled).not.toHaveBeenCalled();
  });

  it("fica oculto para quem não é responsável", () => {
    setup({ isResponsible: false });

    expect(screen.queryByRole("region", { name: "Convites pendentes" })).not.toBeInTheDocument();
    expect(screen.queryByText("Bruno Lima")).not.toBeInTheDocument();
  });

  it("sem convites pendentes, a seção não aparece", () => {
    setup({ invitations: [] });

    expect(screen.queryByRole("region", { name: "Convites pendentes" })).not.toBeInTheDocument();
  });
});
