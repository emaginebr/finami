import { useTranslation } from "react-i18next";
import type { StatementEntryInfo } from "../../types/statement";
import { cn } from "../../utils/cn";
import { formatTime } from "../../utils/dates";
import { formatBrl, formatSigned } from "../../utils/money";
import { Badge } from "../ui/Badge";
import { listRowClasses } from "../ui/listRow";
import { isBetweenWallets, transactionVisual, transferKindLabel } from "./transactionVisuals";

export interface StatementEntryRowProps {
  entry: StatementEntryInfo;
  onOpen: (entry: StatementEntryInfo) => void;
}

/** Linha do extrato (botão que abre o detalhe) — components.md §6 */
export const StatementEntryRow = ({ entry, onOpen }: StatementEntryRowProps) => {
  const { t } = useTranslation();
  const visual = transactionVisual(entry.type);
  const Icon = visual.icon;
  const negative = entry.amount < 0;
  // Transferência entre pessoas: "Empréstimo para Bruno" no lugar de "Transferência" (feature 007)
  const kindLabel = transferKindLabel(t, entry);
  const typeLabel = kindLabel ?? t(`transactionType.${entry.type}`);
  // Com rótulo de tipo o nome já está nele: sem "→ Mesada" repetido (components.md §11)
  const counterpart =
    isBetweenWallets(entry.type) && !kindLabel
      ? negative
        ? `→ ${entry.destinationName}`
        : `← ${entry.sourceName}`
      : null;

  const details = [
    formatTime(entry.occurredAt),
    // Sem descrição o título já é o tipo
    entry.description ? typeLabel : null,
    counterpart,
    entry.quotePriceBrl !== null ? t("home.quote", { price: formatBrl(entry.quotePriceBrl) }) : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
    >
      <span aria-hidden="true" className={cn("grid size-8 shrink-0 place-items-center rounded-sm", visual.className)}>
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        {/* Título em até 2 linhas; o detalhe é que trunca (REVIEW E-3) */}
        <span className="line-clamp-2 text-headline break-words hyphens-auto">{entry.description || typeLabel}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-footnote text-text-muted">
          {/* Com descrição, o rótulo do tipo (com o nome) vai aqui: quebra em 2 linhas em vez de cortar o nome (REVIEW-007 M-6) */}
          <span
            className={cn(
              "min-w-0 tabular-nums",
              kindLabel && entry.description ? "line-clamp-2 break-words" : "truncate",
            )}
          >
            {details.join(" · ")}
          </span>
          {entry.internal ? (
            <Badge variant="internal" className="shrink-0">
              {t("badges.internal")}
            </Badge>
          ) : null}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-headline whitespace-nowrap tabular-nums",
          negative ? "text-negative" : entry.amount > 0 ? "text-positive" : "text-text",
        )}
      >
        <span className="sr-only">{negative ? t("transaction.preview.outgoing") : t("transaction.preview.incoming")} </span>
        {formatSigned(entry.amount, entry.currency)}
      </span>
    </button>
  );
};

export default StatementEntryRow;
