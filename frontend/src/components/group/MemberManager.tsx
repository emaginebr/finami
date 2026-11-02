import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGroup } from "../../hooks/useGroup";
import { useOnlineAction } from "../../hooks/useOnlineAction";
import type { GroupInfo, GroupMemberInfo } from "../../types/group";
import { notifyError, notifySuccess } from "../../utils/notify";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { listRowClasses } from "../ui/listRow";

export interface MemberManagerProps {
  group: GroupInfo;
  currentUserId: number | null;
}

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`.trim();

/**
 * Membros da família (FR-028): lista para todos; "Retirar" **só** para o responsável — para os
 * demais essa ação não é renderizada. Desde a feature 003 a inclusão é feita pela folha
 * "Adicionar membro" da tela da família (components.md §6/§7).
 */
export const MemberManager = ({ group, currentUserId }: MemberManagerProps) => {
  const { t } = useTranslation();
  const { removeMember } = useGroup();
  const canManage = group.isResponsible;
  // Retirar membro exige internet (feature 005)
  const onlineAction = useOnlineAction();

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

  const memberSubtitle = (member: GroupMemberInfo) => {
    const parts: string[] = [];
    if (member.userId === currentUserId) parts.push(t("groups.members.you"));
    else if (member.userId !== group.responsibleUserId) parts.push(t("groups.members.member"));
    return parts.join(" · ");
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`members-${group.groupId}`}>
        <h3
          id={`members-${group.groupId}`}
          className="m-0 mb-2 px-4 text-footnote font-semibold tracking-wider text-text-muted uppercase"
        >
          {t("groups.members.title", { count: group.members.length })}
        </h3>
        <div className="overflow-hidden rounded-lg bg-surface">
          {group.members.map((member, index) => {
            const isResponsible = member.userId === group.responsibleUserId;
            const subtitle = memberSubtitle(member);
            return (
              <div key={member.userId} className={listRowClasses({ twoLines: true, withIcon: true })}>
                <Avatar name={fullName(member)} colorIndex={index} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-headline">{fullName(member)}</span>
                  {isResponsible || subtitle ? (
                    <span className="mt-0.5 block truncate text-footnote text-text-muted">
                      {isResponsible ? <Badge variant="responsible">{t("badges.responsible")}</Badge> : null}
                      {isResponsible && subtitle ? " · " : null}
                      {subtitle}
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
          })}
        </div>
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
