import { Fragment, useId, useState } from "react";
import { Info, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGroup } from "../../hooks/useGroup";
import { useOnlineAction } from "../../hooks/useOnlineAction";
import { StatementVisibility } from "../../types/group";
import type { GroupInfo, GroupMemberInfo } from "../../types/group";
import { notifyError, notifySuccess } from "../../utils/notify";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { listRowClasses } from "../ui/listRow";
import { MemberPermissions } from "./MemberPermissions";
import { permissionParts } from "./permissionSummary";

export interface MemberManagerProps {
  group: GroupInfo;
  currentUserId: number | null;
}

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`.trim();

/**
 * Membros da família (FR-028). Para o responsável: um cartão por membro com "Retirar" e os
 * interruptores "Pode lançar"/"Pode estornar" (feature 008, components.md §12); o próprio cartão
 * mostra "Todas as permissões". Para os demais: lista só de leitura com o resumo das permissões,
 * sem nenhum controle. A inclusão é feita pela folha "Adicionar membro" da tela da família.
 */
export const MemberManager = ({ group, currentUserId }: MemberManagerProps) => {
  const { t } = useTranslation();
  const { removeMember } = useGroup();
  const canManage = group.isResponsible;
  // Retirar membro e mudar permissões exigem internet (feature 005)
  const onlineAction = useOnlineAction();
  const headingId = `members-${group.groupId}`;
  const idPrefix = useId();
  const offlineNoteId = `${idPrefix}-offline`;
  const scopeNoteId = `${idPrefix}-scope`;
  // Visibilidade **salva** (não o rascunho do seletor da mesma folha)
  const showScopeNote = canManage && group.statementVisibility !== StatementVisibility.AllMembers;
  const showOfflineNote = canManage && onlineAction.offline;

  const [removing, setRemoving] = useState<GroupMemberInfo | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await removeMember(group.groupId, removing.userId);
      notifySuccess(t("groups.members.removed", { name: fullName(removing) }));
    } catch (err) {
      notifyError(err);
      throw err;
    } finally {
      setRemoveBusy(false);
    }
  };

  /** Subtítulo: [selo] · você/membro · permissões */
  const memberSubtitle = (member: GroupMemberInfo, isResponsible: boolean): string[] => {
    const parts: string[] = [];
    if (member.userId === currentUserId) parts.push(t("groups.members.you"));
    else if (!isResponsible && canManage) parts.push(t("groups.members.member"));
    if (isResponsible) parts.push(t("groups.permissions.all"));
    // O responsável vê os interruptores; os demais leem o resumo em texto
    else if (!canManage) parts.push(...permissionParts(t, member));
    return parts;
  };

  const memberHeader = (member: GroupMemberInfo, index: number, nameId?: string) => {
    const isResponsible = member.userId === group.responsibleUserId;
    const subtitle = memberSubtitle(member, isResponsible);
    const separator = t("groups.permissions.separator");
    return (
      <div className={listRowClasses({ twoLines: true, withIcon: true })}>
        <Avatar name={fullName(member)} colorIndex={index} />
        <span className="min-w-0 flex-1">
          <span id={nameId} className="block truncate text-headline">
            {fullName(member)}
          </span>
          {isResponsible || subtitle.length > 0 ? (
            // Quebra entre as partes em vez de cortar "Todas as permissões" (320 px / zoom 200 %, REVIEW-008 I-1)
            <span className="mt-0.5 block break-words text-footnote text-text-muted">
              {isResponsible ? <Badge variant="responsible">{t("badges.responsible")}</Badge> : null}
              {subtitle.map((part, partIndex) => (
                <Fragment key={part}>
                  {isResponsible || partIndex > 0 ? separator : null}
                  <span className="whitespace-nowrap">{part}</span>
                </Fragment>
              ))}
            </span>
          ) : null}
        </span>
        {canManage && !isResponsible ? (
          <Button
            variant="destructiveGhost"
            size="sm"
            aria-label={t("groups.members.removeAria", { name: fullName(member) })}
            {...onlineAction.offlineProps}
            onClick={onlineAction.guard(() => setRemoving(member))}
          >
            {t("groups.members.remove")}
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={headingId}>
        <h3
          id={headingId}
          className="m-0 mb-2 px-4 text-footnote font-semibold tracking-wider text-text-muted uppercase"
        >
          {t("groups.members.title", { count: group.members.length })}
        </h3>

        {showOfflineNote ? (
          <p id={offlineNoteId} className="m-0 flex items-start gap-1.5 px-4 pb-2 text-footnote text-text-muted">
            <WifiOff aria-hidden="true" className="mt-px size-4 shrink-0 text-warning" strokeWidth={1.75} />
            <span>{t("pwa.offline.writeBlocked")}</span>
          </p>
        ) : null}

        {canManage ? (
          <div className="flex flex-col gap-3">
            {group.members.map((member, index) => {
              const isResponsible = member.userId === group.responsibleUserId;
              const nameId = `${idPrefix}-member-${member.userId}`;
              return (
                <div
                  key={member.userId}
                  role="group"
                  aria-labelledby={nameId}
                  className="overflow-hidden rounded-lg bg-surface"
                >
                  {memberHeader(member, index, nameId)}
                  {!isResponsible ? (
                    <MemberPermissions
                      group={group}
                      member={member}
                      offlineNoteId={showOfflineNote ? offlineNoteId : undefined}
                      scopeNoteId={showScopeNote ? scopeNoteId : undefined}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-surface">
            {group.members.map((member, index) => (
              <Fragment key={member.userId}>{memberHeader(member, index)}</Fragment>
            ))}
          </div>
        )}

        {showScopeNote ? (
          <p id={scopeNoteId} className="m-0 flex items-start gap-1.5 px-4 pt-2 text-footnote text-text-muted">
            <Info aria-hidden="true" className="mt-px size-4 shrink-0 text-info" strokeWidth={1.75} />
            <span>{t("groups.permissions.reverseScopeNote")}</span>
          </p>
        ) : null}

        <p className="m-0 px-4 pt-2 text-footnote text-text-muted">
          {canManage ? t("groups.members.useAddMember") : t("groups.members.onlyResponsible")}
        </p>
      </section>

      <ConfirmModal
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        tone="destructive"
        loading={removeBusy}
        title={removing ? t("groups.members.removeTitle", { name: fullName(removing) }) : ""}
        description={
          removing
            ? t("groups.members.removeBody", { name: removing.firstName, family: group.name })
            : undefined
        }
        confirmLabel={t("groups.members.remove")}
        onConfirm={confirmRemove}
      />
    </div>
  );
};

export default MemberManager;
