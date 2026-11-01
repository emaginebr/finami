import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TransactionKind } from "../../types/transaction";
import { cn } from "../../utils/cn";
import { listRowClasses } from "../ui/listRow";

const OPTIONS: Array<{ kind: TransactionKind; icon: LucideIcon; iconClass: string }> = [
  { kind: TransactionKind.Income, icon: ArrowDownLeft, iconClass: "bg-positive-soft text-positive" },
  { kind: TransactionKind.Expense, icon: ArrowUpRight, iconClass: "bg-negative-soft text-negative" },
  { kind: TransactionKind.Transfer, icon: ArrowLeftRight, iconClass: "bg-info-soft text-info" },
];

export interface TypeStepProps {
  onSelect: (kind: TransactionKind) => void;
}

/** Passo 1 da folha: Entrada · Saída · Transferência (linhas de 60 px) */
export const TypeStep = ({ onSelect }: TypeStepProps) => {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-lg bg-surface">
      {OPTIONS.map(({ kind, icon: Icon, iconClass }, index) => (
        <button
          key={kind}
          type="button"
          data-autofocus={index === 0 ? "" : undefined}
          onClick={() => onSelect(kind)}
          className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
        >
          <span
            aria-hidden="true"
            className={cn("grid size-10 shrink-0 place-items-center rounded-lg", iconClass)}
          >
            <Icon className="size-[22px]" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-headline">{t(`transaction.kind.${kind}`)}</span>
            <span className="mt-0.5 block text-footnote text-text-muted">
              {t(`transaction.kindDescription.${kind}`)}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
        </button>
      ))}
    </div>
  );
};

export default TypeStep;
