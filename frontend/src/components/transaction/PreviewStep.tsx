import { ArrowDown, Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Currency } from "../../types/api";
import type { TransferPreviewResult } from "../../types/transaction";
import type { WalletInfo } from "../../types/wallet";
import { cn } from "../../utils/cn";
import { formatTime } from "../../utils/dates";
import { EMPTY_VALUE, currencySymbol, formatBrl, formatMoney, formatMoneyFull, formatSigned } from "../../utils/money";
import { Button } from "../ui/Button";
import type { ResolvedDestination } from "./sheetModel";

export interface PreviewStepProps {
  sourceWallet: WalletInfo;
  destination: ResolvedDestination;
  /** Valor digitado na moeda da origem, normalizado ("500.00"); `null` quando foi informado em reais */
  amount: string | null;
  /** Valor informado em reais (bitcoin → bitcoin, feature 006), normalizado ("200.00") */
  amountBrl: string | null;
  preview: TransferPreviewResult | null;
  loading: boolean;
  /** 503: cotação indisponível, confirmação bloqueada */
  blocked: boolean;
  /** Volta ao formulário informando o valor em bitcoin (só no modo "Reais") */
  onEnterInBtc?: () => void;
}

const ROW = "flex justify-between gap-3 border-t-[0.5px] border-separator py-2 text-subhead";

/**
 * Passo de confirmação (entre moedas, para terceiro ou bitcoin informado em reais):
 * valores, tipo, cotação e titular. No modo "Reais", o BTC aparece com 8 casas fixas:
 * é exatamente o valor que será registrado (SC-005).
 */
export const PreviewStep = ({
  sourceWallet,
  destination,
  amount,
  amountBrl,
  preview,
  loading,
  blocked,
  onEnterInBtc,
}: PreviewStepProps) => {
  const { t } = useTranslation();
  const inReais = amountBrl !== null;
  const sourceCurrency = sourceWallet.currency;
  const sourceAmount = preview ? preview.sourceAmount : amount;

  const sourceText = (() => {
    if (sourceAmount === null) return `${currencySymbol(sourceCurrency)} ${EMPTY_VALUE}`;
    if (blocked) return formatMoney(sourceAmount, sourceCurrency);
    return formatSigned(-Math.abs(Number(sourceAmount)), sourceCurrency, inReais);
  })();

  const destinationText =
    preview && !blocked
      ? formatSigned(Math.abs(preview.destinationAmount), destination.currency, inReais)
      : `${currencySymbol(destination.currency)} ${EMPTY_VALUE}`;

  return (
    <div className="flex flex-col gap-3">
      {blocked ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-md bg-warning-soft p-3 text-footnote text-warning">
          <TriangleAlert aria-hidden="true" className="mt-px size-[18px] shrink-0" />
          <span>
            <b className="mb-0.5 block font-semibold text-text">{t("transaction.preview.blockedTitle")}</b>
            {t("transaction.preview.blockedBody")}
            {inReais && onEnterInBtc ? (
              <span className="block">
                <Button variant="secondary" size="sm" className="mt-2" onClick={onEnterInBtc}>
                  {t("transaction.enterInBtc")}
                </Button>
              </span>
            ) : null}
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
        <span
          className={cn(
            "text-[1.75rem] font-bold tabular-nums",
            !blocked && sourceAmount !== null && "text-negative",
            sourceAmount === null && "text-text-subtle",
          )}
        >
          <span className="sr-only">{t("transaction.preview.outgoing")} </span>
          {sourceText}
        </span>
        {amountBrl !== null ? (
          <span className="text-subhead text-text-muted tabular-nums">
            {t("transaction.preview.enteredBrl", { value: formatBrl(amountBrl) })}
          </span>
        ) : null}
        <ArrowDown aria-hidden="true" className="size-5 text-text-subtle" />
        <span
          className={cn(
            "text-[1.75rem] font-bold tabular-nums",
            preview && !blocked ? "text-positive" : "text-text-subtle",
          )}
        >
          <span className="sr-only">{t("transaction.preview.incoming")} </span>
          {destinationText}
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
          {amountBrl !== null ? (
            <>
              <div className={ROW}>
                <dt className="text-text-muted">{t("transaction.preview.amountBrl")}</dt>
                <dd className="m-0 text-right font-semibold tabular-nums">{formatBrl(amountBrl)}</dd>
              </div>
              <div className={ROW}>
                <dt className="text-text-muted">{t("transaction.preview.amountBtc")}</dt>
                <dd className="m-0 text-right font-semibold tabular-nums">
                  {formatMoneyFull(preview.sourceAmount, Currency.BTC)}
                </dd>
              </div>
            </>
          ) : null}
          {preview.quote ? (
            <>
              <div className={ROW}>
                <dt className="text-text-muted">{t("transaction.preview.quote")}</dt>
                <dd className="m-0 text-right font-semibold tabular-nums">
                  {t("home.quote", { price: formatBrl(preview.quote.priceBrl) })}
                </dd>
              </div>
              <div className={ROW}>
                <dt className="text-text-muted">{t("transaction.preview.quotedAt")}</dt>
                <dd className="m-0 text-right font-semibold tabular-nums">{formatTime(preview.quote.quotedAt)}</dd>
              </div>
            </>
          ) : null}
          {!destination.isOwn ? (
            <div className={ROW}>
              <dt className="text-text-muted">{t("transaction.preview.owner")}</dt>
              <dd className="m-0 text-right font-semibold">{destination.ownerFirstName}</dd>
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
