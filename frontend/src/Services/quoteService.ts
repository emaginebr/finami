import type { BtcQuoteInfo } from "../types/quote";
import { apiFetch } from "./apiHelpers";

/**
 * Quote Service — cotação do bitcoin.
 * 503 (nunca houve cotação) chega como `ApiError` com status 503.
 */
class QuoteService {
  /** Cotação atual (ou última conhecida, com `isStale`) — `GET /api/quotes/btc` */
  async getBtc(): Promise<BtcQuoteInfo> {
    return apiFetch<BtcQuoteInfo>("/api/quotes/btc");
  }
}

export const quoteService = new QuoteService();
export default QuoteService;
