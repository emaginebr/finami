import type { BtcQuoteInfo } from "../types/quote";
import type { FreshnessInfo } from "../types/connectivity";
import { apiFetch } from "./apiHelpers";

/**
 * Quote Service — cotação do bitcoin.
 * 503 (nunca houve cotação) chega como `ApiError` com status 503.
 */
class QuoteService {
  /** Cotação atual (ou última conhecida, com `isStale`) — `GET /api/quotes/btc` */
  async getBtc(onFreshness?: (info: FreshnessInfo) => void): Promise<BtcQuoteInfo> {
    // Guardada para uso offline; `onFreshness` diz se veio do cache (T042)
    return apiFetch<BtcQuoteInfo>("/api/quotes/btc", { cache: "network-first", onFreshness });
  }
}

export const quoteService = new QuoteService();
export default QuoteService;
