import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StatementTotalInfo } from "../../types/statement";
import { cn } from "../../utils/cn";
import { formatMoney, formatSigned } from "../../utils/money";

export interface StatementTotalsProps {
  totals: StatementTotalInfo;
}

/** Saldo inicial, entradas, saídas e saldo final (2×2 no celular, 4 colunas no desktop) */
export const StatementTotals = ({ totals }: StatementTotalsProps) => {
  const { t } = useTranslation();
  const hasIn = totals.totalIn !== 0;
  const hasOut = totals.totalOut !== 0;
  const cell = "min-w-0 bg-surface px-4 py-3";
  const label = "flex items-center gap-1 text-footnote text-text-muted";
  // Valores nunca são cortados: em último caso descem de linha (REVIEW E-2)
  const value = "m-0 mt-1 text-headline tabular-nums [overflow-wrap:anywhere]";

  return (
    <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-separator md:grid-cols-4">
      <div className={cell}>
        <dt className={label}>{t("statement.opening")}</dt>
        <dd className={value}>{formatMoney(totals.openingBalance, totals.currency)}</dd>
      </div>
      <div className={cell}>
        <dt className={label}>
          <ArrowDownLeft aria-hidden="true" className="size-3.5 text-positive" />
          {t("statement.totalIn")}
        </dt>
        <dd className={cn(value, hasIn && "text-positive")}>
          {formatSigned(totals.totalIn, totals.currency)}
        </dd>
      </div>
      <div className={cell}>
        <dt className={label}>
          <ArrowUpRight aria-hidden="true" className="size-3.5 text-negative" />
          {t("statement.totalOut")}
        </dt>
        <dd className={cn(value, hasOut && "text-negative")}>
          {/* Saídas chegam positivas: o mesmo formatador aplica o "−" sem espaço */}
          {formatSigned(-Math.abs(totals.totalOut), totals.currency)}
        </dd>
      </div>
      <div className={cell}>
        <dt className={label}>{t("statement.closing")}</dt>
        <dd className={cn(value, "min-[360px]:text-title-2")}>
          {formatMoney(totals.closingBalance, totals.currency)}
        </dd>
      </div>
    </dl>
  );
};

export default StatementTotals;
