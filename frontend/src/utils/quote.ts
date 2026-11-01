import { QuoteStatus } from "../types/quote";
import type { QuoteSnapshot } from "../types/quote";

/** Estado da cotação a partir de uma cotação devolvida pela API (`null` = indisponível) */
export const quoteStatusOf = (quote: QuoteSnapshot | null): QuoteStatus => {
  if (!quote) return QuoteStatus.Unavailable;
  return quote.isStale ? QuoteStatus.Stale : QuoteStatus.Available;
};

/** Há cotação utilizável para estimar BTC em reais */
export const isQuoteUsable = (status: QuoteStatus): boolean =>
  status === QuoteStatus.Available || status === QuoteStatus.Stale;
