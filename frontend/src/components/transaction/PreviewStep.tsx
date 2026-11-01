import { ArrowDown, Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TransferPreviewResult } from "../../types/transaction";
import type { WalletInfo } from "../../types/wallet";
import { cn } from "../../utils/cn";
import { formatTime } from "../../utils/dates";
import { EMPTY_VALUE, currencySymbol, formatBrl, formatMoney, formatSigned } from "../../utils/money";
import type { ResolvedDestination } from "./sheetModel";

export interface PreviewStepProps {
  sourceWallet: WalletInfo;
  destination: ResolvedDestination;
  /** Valor digitado, normalizado ("500.00") */
  amount: string;
  preview: TransferPreviewResult | null;
  loading: boolean;
  /** 503: cotação indisponível, confirmação bloqueada */
  blocked: boolean;
}

/** Passo 3 (só entre moedas ou para terceiro): valores, tipo, cotação e titular */
export const PreviewStep = ({
  sourceWallet,
  destination,
  amount,
  preview,
  loading,
  blocked,
}: PreviewStepProps) => {
  const { t } = useTranslation();
  const sourceAmount = preview ? preview.sourceAmount : amount;
  const destinationText = preview
    ? formatSigned(Math.abs(preview.destinationAmount), destination.currency)
    : `${currencySymbol(destination.currency)} ${EMPTY_VALUE}`;

  return (
    <div className="flex flex-col gap-3">
      {blocked ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-md bg-warning-soft p-3 text-footnote text-warning">
          <TriangleAlert aria-hidden="true" className="mt-px size-[18px] shrink-0" />
          <span>
            <b className="mb-0.5 block font-semibold text-text">{t("transaction.preview.blockedTitle")}</b>
            {t("transaction.preview.blockedBody")}
          </span>
        </div>
      ) : null}

      {loading ? (
        <p role="status" className="m-0 text-center text-subhead text-text-muted">
          {t("transaction.preview.loading")}
        </p>
      ) : null}

      {/* Valores convertidos anunciados quando a prévia chega (T093) */}
      <div
        aria-live="polite"
        aria-busy={loading || undefined}
        className="flex flex-col items-center gap-1 rounded-lg bg-surface px-4 py-5 text-center"
      >
        <span className="text-footnote text-text-muted">
          {t("transaction.preview.leavesFrom", { name: sourceWallet.name })}
        </span>
        <span className={cn("text-[1.75rem] font-bold tabular-nums", !blocked && "text-negative")}>
          <span className="sr-only">{t("transaction.preview.outgoing")} </span>
          {blocked
            ? formatMoney(sourceAmount, sourceWallet.currency)
            : formatSigned(-Math.abs(Number(sourceAmount)), sourceWallet.currency)}
        </span>
        <ArrowDown aria-hidden="true" className="size-5 text-text-subtle" />
        <span
          className={cn(
            "text-[1.75rem] font-bold tabular-nums",
            preview && !blocked ? "text-positive" : "text-text-subtle",
          )}
        >
          <span className="sr-only">{t("transaction.preview.incoming")} </span>
          {blocked ? `${currencySymbol(destination.currency)} ${EMPTY_VALUE}` : destinationText}
        </span>
        <span className="text-footnote text-text-muted">
          {t("transaction.preview.entersInto", { name: destination.name })}
        </span>
      </div>

      {preview && !blocked ? (
        <dl className="m-0 rounded-lg bg-surface px-4 py-2">
          <div className="flex justify-between gap-3 py-2 text-subhead">
            <dt className="text-text-muted">{t("transaction.preview.type")}</dt>
            <dd className="m-0 text-right font-semibold">{t(`transactionType.${preview.type}`)}</dd>
          </div>
          {preview.quote ? (
            <>
              <div className="flex justify-between gap-3 border-t-[0.5px] border-separator py-2 text-subhead">
                <dt className="text-text-muted">{t("transaction.preview.quote")}</dt>
                <dd className="m-0 text-right font-semibold tabular-nums">
                  {t("home.quote", { price: formatBrl(preview.quote.priceBrl) })}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t-[0.5px] border-separator py-2 text-subhead">
                <dt className="text-text-muted">{t("transaction.preview.quotedAt")}</dt>
                <dd className="m-0 text-right font-semibold tabular-nums">{formatTime(preview.quote.quotedAt)}</dd>
              </div>
            </>
          ) : null}
          {!destination.isOwn ? (
            <div className="flex justify-between gap-3 border-t-[0.5px] border-separator py-2 text-subhead">
              <dt className="text-text-muted">{t("transaction.preview.owner")}</dt>
              <dd className="m-0 text-right font-semibold">{destination.ownerName}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {preview?.quote && !blocked ? (
        <div className="flex items-start gap-2.5 rounded-md bg-info-soft p-3 text-footnote text-info">
          <Info aria-hidden="true" className="mt-px size-[18px] shrink-0" />
          <span>{t("transaction.preview.note")}</span>
        </div>
      ) : null}
    </div>
  );
};

export default PreviewStep;
