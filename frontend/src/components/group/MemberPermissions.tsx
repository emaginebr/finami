import { useId, useState } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGroup } from "../../hooks/useGroup";
import { useOnlineAction } from "../../hooks/useOnlineAction";
import { isApiError, isUnconfirmedWriteError } from "../../types/api";
import type { GroupInfo, GroupMemberInfo, MemberPermissions as MemberPermissionsValue } from "../../types/group";
import { errorMessage, notifyError, notifySuccess } from "../../utils/notify";
import { SwitchRow } from "../ui/Switch";

/** Qual dos dois interruptores foi tocado */
enum PermissionField {
  Create = "canCreateTransactions",
  Reverse = "canReverse",
}

interface PendingChange {
  field: PermissionField;
  /** Estado enviado no PUT (exibido de forma otimista enquanto envia) */
  value: MemberPermissionsValue;
}

export interface MemberPermissionsProps {
  group: GroupInfo;
  member: GroupMemberInfo;
  /** Id da nota "sem internet" da seção (só existe offline) */
  offlineNoteId?: string;
  /** Id da nota de alcance do estorno (só existe quando a visibilidade não é "Todos os membros") */
  scopeNoteId?: string;
}

/** Status HTTP em que a família pode ter mudado no servidor (ex.: deixou de ser responsável) */
const RELOAD_STATUSES = [403, 404, 422];

/**
 * Interruptores "Pode lançar" e "Pode estornar" de um membro — só para o responsável
 * (components.md §12). O PUT leva os dois valores, então só um envio por membro por vez: o outro
 * interruptor fica `aria-disabled` enquanto um envia. Erro: volta ao estado anterior e mostra a
 * mensagem no cartão (sem toast).
 */
export const MemberPermissions = ({ group, member, offlineNoteId, scopeNoteId }: MemberPermissionsProps) => {
  const { t } = useTranslation();
  const { setMemberPermissions, getGroup } = useGroup();
  const onlineAction = useOnlineAction();
  const errorId = useId();

  const [pending, setPending] = useState<PendingChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Muda a cada falha: remonta o alerta para o leitor anunciar de novo a mesma mensagem (REVIEW-008 M-2) */
  const [errorTick, setErrorTick] = useState(0);

  const saved: MemberPermissionsValue = {
    canCreateTransactions: member.canCreateTransactions,
    canReverse: member.canReverse,
  };
  const shown = pending?.value ?? saved;

  const reloadGroup = () => {
    getGroup(group.groupId).catch(() => undefined);
  };

  const change = async (field: PermissionField, next: boolean) => {
    if (pending) return;
    const value: MemberPermissionsValue = { ...saved, [field]: next };
    setPending({ field, value });
    try {
      await setMemberPermissions(group.groupId, member.userId, value);
      setError(null);
      notifySuccess(t("groups.permissions.updated", { name: member.firstName }));
    } catch (err) {
      setErrorTick((tick) => tick + 1);
      if (isUnconfirmedWriteError(err)) {
        // A rede caiu com o envio em andamento: pode ter sido gravado — recarrega em vez de reverter às cegas
        setError(t("groups.permissions.unconfirmed", { name: member.firstName }));
        reloadGroup();
      } else {
        setError(errorMessage(err));
        if (isApiError(err) && RELOAD_STATUSES.includes(err.status)) {
          // Ex.: deixou de ser responsável — a recarga pode fechar a folha e levar o erro do cartão junto;
          // o toast sobrevive a ela (REVIEW-008 M-3)
          notifyError(err);
          reloadGroup();
        }
      }
    } finally {
      setPending(null);
    }
  };

  const describedBy = (extra: Array<string | undefined>) =>
    [onlineAction.offline ? offlineNoteId : undefined, ...extra, error ? errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  const blockedFor = (field: PermissionField) =>
    onlineAction.offline || (pending !== null && pending.field !== field);

  const onBlockedClick = onlineAction.offline ? () => void onlineAction.blockIfOffline() : undefined;

  // Linhas irmãs `.list-row`: o separador recuado de 16 px vem do CSS (index.css)
  return (
    <>
      <SwitchRow
        label={t("groups.permissions.create")}
        description={t("groups.permissions.createHelp")}
        checked={shown.canCreateTransactions}
        onChange={(next) => void change(PermissionField.Create, next)}
        busy={pending?.field === PermissionField.Create}
        ariaDisabled={blockedFor(PermissionField.Create)}
        onBlockedClick={onBlockedClick}
        describedBy={describedBy([])}
      />
      <SwitchRow
        label={t("groups.permissions.reverse")}
        description={t("groups.permissions.reverseHelp")}
        checked={shown.canReverse}
        onChange={(next) => void change(PermissionField.Reverse, next)}
        busy={pending?.field === PermissionField.Reverse}
        ariaDisabled={blockedFor(PermissionField.Reverse)}
        onBlockedClick={onBlockedClick}
        describedBy={describedBy([scopeNoteId])}
      />
      {error ? (
        <p
          key={errorTick}
          id={errorId}
          role="alert"
          className="list-row m-0 flex items-start gap-1.5 px-4 py-3 text-footnote text-negative"
        >
          <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </p>
      ) : null}
      <span className="sr-only" role="status">
        {pending ? t("actions.saving") : ""}
      </span>
    </>
  );
};

export default MemberPermissions;
