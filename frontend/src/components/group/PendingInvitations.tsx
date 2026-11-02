import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useInvitation } from "../../hooks/useInvitation";
import { useOnlineAction } from "../../hooks/useOnlineAction";
import type { GroupInvitationInfo } from "../../types/invitation";
import { formatShortDate, toIsoInstant } from "../../utils/dates";
import { notifyError, notifySuccess } from "../../utils/notify";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { listRowClasses } from "../ui/listRow";
import { AvatarVariant, ButtonSize, ButtonVariant, ConfirmTone } from "../ui/variants";

export interface PendingInvitationsProps {
  groupId: number;
  groupName: string;
  /** Só o responsável vê a seção (FR-015) */
  isResponsible: boolean;
  /** Convites pendentes, mais recentes primeiro */
  invitations: GroupInvitationInfo[];
  /** Chamado após cancelar (quem usa remove o convite da lista / recarrega) */
  onCanceled: (invitationId: number) => void;
  /** Recebe o foco quando o último convite é cancelado (botão "Adicionar membro") */
  emptyFocusRef?: RefObject<HTMLElement>;
}

const fullName = (invitation: GroupInvitationInfo) =>
  `${invitation.invitedUser.firstName} ${invitation.invitedUser.lastName}`.trim();

/**
 * Seção "Convites pendentes" da tela da família (components.md §7): nome, data e "Cancelar"
 * com `ConfirmModal`. Não renderiza nada para quem não é responsável ou sem pendentes.
 */
export const PendingInvitations = ({
  groupId,
  groupName,
  isResponsible,
  invitations,
  onCanceled,
  emptyFocusRef,
}: PendingInvitationsProps) => {
  const { t } = useTranslation();
  const { cancel } = useInvitation();
  const headingId = useId();
  const [target, setTarget] = useState<GroupInvitationInfo | null>(null);
  const [busy, setBusy] = useState(false);
  /** Posição do convite cancelado, para levar o foco ao próximo "Cancelar" */
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const buttonRefs = useRef(new Map<number, HTMLButtonElement>());
  // Cancelar convite exige internet (feature 005)
  const onlineAction = useOnlineAction();

  // Depois que o modal fecha e a lista muda, o foco vai para o próximo "Cancelar"
  // (ou para "Adicionar membro" sem pendentes). `setTimeout` roda depois de o modal devolver o foco.
  useEffect(() => {
    if (focusIndex === null || target !== null) return undefined;
    const timer = window.setTimeout(() => {
      const next = invitations[Math.min(focusIndex, invitations.length - 1)];
      const button = next ? buttonRefs.current.get(next.invitationId) : undefined;
      if (button) button.focus();
      else emptyFocusRef?.current?.focus();
      setFocusIndex(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusIndex, target, invitations, emptyFocusRef]);

  if (!isResponsible) return null;

  const confirmCancel = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await cancel(groupId, target.invitationId);
      notifySuccess(t("groups.invitations.canceled"));
      setFocusIndex(invitations.findIndex((item) => item.invitationId === target.invitationId));
      onCanceled(target.invitationId);
    } catch (err) {
      notifyError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const section =
    invitations.length > 0 ? (
    <section aria-labelledby={headingId} className="mt-7">
      <h2
        id={headingId}
        className="m-0 flex min-h-touch items-center px-4 text-footnote font-semibold tracking-wider text-text-muted uppercase"
      >
        {t("groups.invitations.title")}
      </h2>
      <ul className="m-0 list-none overflow-hidden rounded-lg bg-surface p-0">
        {invitations.map((invitation) => {
          const name = fullName(invitation);
          return (
            <li key={invitation.invitationId} className={listRowClasses({ twoLines: true, withIcon: true })}>
              <Avatar name={name} variant={AvatarVariant.Pending} />
              <span className="min-w-0 flex-1">
                {/* Em 320 px a data é a informação principal: nome em até 2 linhas e data quebra (REVIEW M-1) */}
                <span className="line-clamp-2 text-headline break-words hyphens-auto">{name}</span>
                <span className="mt-0.5 block text-footnote whitespace-normal text-text-muted">
                  <time dateTime={toIsoInstant(invitation.createdAt)}>
                    {t("groups.invitations.sentAt", { date: formatShortDate(invitation.createdAt) })}
                  </time>
                </span>
              </span>
              <Button
                ref={(node) => {
                  if (node) buttonRefs.current.set(invitation.invitationId, node);
                  else buttonRefs.current.delete(invitation.invitationId);
                }}
                variant={ButtonVariant.DestructiveGhost}
                size={ButtonSize.Sm}
                // `px-3` (≈ 70 px) mantém o alvo ≥ 44 × 44 e libera espaço para a data (REVIEW M-1)
                className="shrink-0 px-3!"
                aria-label={t("groups.invitations.cancelAria", { name })}
                {...onlineAction.offlineProps}
                onClick={onlineAction.guard(() => setTarget(invitation))}
              >
                {t("groups.invitations.cancel")}
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="m-0 px-4 pt-2 text-footnote text-text-muted">{t("groups.invitations.footer")}</p>
    </section>
    ) : null;

  return (
    <>
      {section}
      {/* Fora da seção: continua montado quando o último convite sai da lista */}
      <ConfirmModal
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        tone={ConfirmTone.Destructive}
        loading={busy}
        title={target ? t("groups.invitations.cancelTitle", { name: fullName(target) }) : ""}
        description={
          target
            ? t("groups.invitations.cancelBody", { name: fullName(target), family: groupName })
            : undefined
        }
        confirmLabel={t("groups.invitations.cancelConfirm")}
        cancelLabel={t("groups.invitations.keep")}
        onConfirm={confirmCancel}
      />
    </>
  );
};

export default PendingInvitations;
