import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DetailLevel } from "../../types/balance";
import type { MemberBalanceInfo } from "../../types/balance";
import { EMPTY_VALUE, formatBrl, formatBtc } from "../../utils/money";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { listRowClasses } from "../ui/listRow";
import type { NavState } from "../layout/navigation";

export interface MemberRowProps {
  member: MemberBalanceInfo;
  /** Posição na lista (cor do avatar) */
  index: number;
  detailLevel: DetailLevel;
  currentUserId: number | null;
  /** Estado de navegação para a tela do membro (aba e voltar) */
  linkState?: NavState;
}

/**
 * Linha de membro (components.md §6): avatar de iniciais, nome, selo "Responsável" em linha
 * própria (REVIEW F-1) e total em BRL; o detalhe em reais aparece para todos fora do Hidden
 * (F-2). Em Hidden mostra "—" sem link (o servidor não manda valores).
 */
export const MemberRow = ({ member, index, detailLevel, currentUserId, linkState }: MemberRowProps) => {
  const { t } = useTranslation();
  const name = `${member.firstName} ${member.lastName}`.trim();
  const isMe = member.userId === currentUserId;
  const hidden = detailLevel === DetailLevel.Hidden || member.totalBrl === null;
  const hasBtc = !hidden && member.balanceBtc !== null && member.balanceBtc !== 0;
  const noWallets =
    detailLevel === DetailLevel.Full && member.wallets.length === 0 && (member.totalBrl ?? 0) === 0;

  const breakdown = hidden
    ? null
    : noWallets
      ? t("balances.noWallets")
      : hasBtc
        ? `${formatBrl(member.balanceBrl ?? 0)} · ${formatBtc(member.balanceBtc ?? 0)}`
        : formatBrl(member.balanceBrl ?? 0);
  const subtitle = [isMe ? t("groups.members.you") : null, breakdown].filter(Boolean).join(" · ");

  const content = (
    <>
      <Avatar name={name} colorIndex={index} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-headline">{name}</span>
        {member.isResponsible ? (
          <span className="mt-0.5 block">
            <Badge variant="responsible">{t("badges.responsible")}</Badge>
          </span>
        ) : null}
        {subtitle ? (
          <span className="mt-0.5 block truncate text-footnote text-text-muted tabular-nums">{subtitle}</span>
        ) : null}
      </span>
      {hidden ? (
        <span className="shrink-0 text-text-subtle">
          <span aria-hidden="true">{EMPTY_VALUE}</span>
          <span className="sr-only">{t("balances.hiddenValue")}</span>
        </span>
      ) : (
        <span
          className={
            "shrink-0 text-headline whitespace-nowrap tabular-nums" +
            ((member.totalBrl ?? 0) < 0 ? " text-negative" : "")
          }
        >
          {formatBrl(member.totalBrl ?? 0)}
        </span>
      )}
    </>
  );

  if (hidden) {
    return <div className={listRowClasses({ twoLines: true, withIcon: true })}>{content}</div>;
  }

  const ariaLabel = [
    name,
    member.isResponsible ? t("badges.responsible").toLowerCase() : null,
    isMe ? t("groups.members.you") : null,
    t("balances.ariaTotal", { value: formatBrl(member.totalBrl ?? 0) }),
    hasBtc
      ? t("balances.ariaBreakdown", {
          brl: formatBrl(member.balanceBrl ?? 0),
          btc: formatBtc(member.balanceBtc ?? 0),
        })
      : null,
    noWallets ? t("balances.noWallets") : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      to={`/pessoas/${member.userId}`}
      state={{ ...linkState, colorIndex: index }}
      aria-label={ariaLabel}
      className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
    >
      {content}
      <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
    </Link>
  );
};

export default MemberRow;
