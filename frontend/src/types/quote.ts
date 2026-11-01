/** Tipos de cotação (data-model §7) */

/** Cotação exibida (também usada nas rotas de saldo por membro) */
export interface QuoteSnapshot {
  /** Preço de 1 BTC em reais */
  priceBrl: number;
  /** Momento da cotação (ISO-8601 UTC) */
  quotedAt: string;
  /** Última cotação conhecida, mas a fonte está fora do ar */
  isStale: boolean;
}

/** Resposta de `GET /api/quotes/btc` */
export interface BtcQuoteInfo extends QuoteSnapshot {
  source: string;
}

/** Estado da cotação na interface */
export enum QuoteStatus {
  Loading = "loading",
  Available = "available",
  Stale = "stale",
  /** 503 — nunca houve cotação */
  Unavailable = "unavailable",
}
