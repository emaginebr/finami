import { useId } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Currency } from "../../types/api";
import { QuoteStatus } from "../../types/quote";
import type { QuoteSnapshot } from "../../types/quote";
import { formatDayMonth, formatTime, toIsoInstant } from "../../utils/dates";
import { EMPTY_VALUE, currencySymbol, formatBrl, formatMoneyParts, fromCents } from "../../utils/money";
import { Badge } from "../ui/Badge";
import { Skeleton } from "../ui/Skeleton";

export interface BalanceHeroProps {
  /** Total em centavos de real */
  totalCents: number;
  /** Carteiras BTC ficaram fora do total (FR-012) */
  btcExcluded: boolean;
  quote: QuoteSnapshot | null;
  quoteStatus: QuoteStatus;
  /** Rótulo (padrão "Saldo total") */
  label?: string;
  /** Texto do aviso de BTC fora do total (padrão: o da Home) */
  btcExcludedBody?: string;
  /** A cotação veio do cache local (sem internet): mostra dia e hora dela (feature 005, T042) */
  quoteFromCache?: boolean;
}

const heroClasses =
  "relative overflow-hidden rounded-card bg-brand p-5 shadow-card " +
  "bg-[radial-gradient(120%_90%_at_100%_0%,rgb(106_224_5/0.10),transparent_55%)]";

/** Cartão do saldo total (components.md §6) — sem `aria-live` */
export const BalanceHero = ({
  totalCents,
  btcExcluded,
  quote,
  quoteStatus,
  label,
  btcExcludedBody,
  quoteFromCache = false,
}: BalanceHeroProps) => {
  const { t } = useTranslation();
  const labelId = useId();
  const showQuote = quote !== null && quoteStatus !== QuoteStatus.Unavailable;
  const stale = quoteStatus === QuoteStatus.Stale || quote?.isStale === true;
  const parts = formatMoneyParts(fromCents(totalCents), Currency.BRL);

  return (
    <section aria-labelledby={labelId} className={heroClasses}>
      <p id={labelId} className="m-0 text-subhead text-text-muted">
        {label ?? t("home.total")}
      </p>
      <p className="m-0 mt-1 mb-3 text-hero whitespace-nowrap tabular-nums">
        {/* Formato único de negativo: −R$ 342,10 (sinal antes do símbolo) */}
        {parts?.negative ? (
          <>
            <span className="sr-only">{t("balances.negative")} </span>
            <span aria-hidden="true" className="text-negative">
              {parts.sign}
            </span>
          </>
        ) : null}
        <span className="mr-[0.2em] align-baseline text-[0.6em] font-medium tracking-normal text-text-muted">
          {parts?.symbol ?? currencySymbol(Currency.BRL)}
        </span>
        <span className={parts?.negative ? "text-negative" : undefined}>{parts?.digits ?? EMPTY_VALUE}</span>
      </p>

      {showQuote && quote ? (
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-caption text-text-muted">
          <span className="tabular-nums">{t("home.quote", { price: formatBrl(quote.priceBrl) })}</span>
          <span aria-hidden="true">·</span>
          <span>
            {quoteFromCache ? (
              <time dateTime={toIsoInstant(quote.quotedAt)}>
                {t("pwa.offline.quoteFrom", {
                  date: formatDayMonth(quote.quotedAt),
                  time: formatTime(quote.quotedAt),
                })}
              </time>
            ) : stale ? (
              formatTime(quote.quotedAt)
            ) : (
              t("home.updatedAt", { time: formatTime(quote.quotedAt) })
            )}
          </span>
          {stale ? <Badge variant="stale">{t("badges.stale")}</Badge> : null}
        </p>
      ) : null}

      {btcExcluded ? (
        <div
          role="status"
          className="mt-3 flex items-start gap-2.5 rounded-md bg-warning-soft p-3 text-footnote text-warning"
        >
          <TriangleAlert aria-hidden="true" className="mt-px size-[18px] shrink-0" />
          <span>
            <b className="mb-0.5 block font-semibold text-text">{t("home.noQuoteTitle")}</b>
            {btcExcludedBody ?? t("home.noQuoteBody")}
          </span>
        </div>
      ) : null}
    </section>
  );
};

/** Esqueleto do BalanceHero */
export const BalanceHeroSkeleton = () => (
  <div aria-hidden="true" className={heroClasses}>
    <Skeleton onBrand className="h-3.5 w-24" />
    <Skeleton onBrand className="my-3.5 h-10 w-[220px] max-w-full" />
    <Skeleton onBrand className="h-3 w-[180px]" />
  </div>
);

export default BalanceHero;
