import { Currency } from "../types/api";
import type { WalletInfo } from "../types/wallet";
import { toCents } from "./money";

/** Total da Home (data-model §5) */
export interface HomeTotal {
  /** Soma em centavos de real */
  totalCents: number;
  /** Alguma carteira BTC própria ficou fora do total por falta de cotação */
  btcExcluded: boolean;
}

/**
 * Soma, em centavos, as carteiras **ativas** de que a pessoa é **titular**:
 * `balance` das BRL e `estimatedBrl` das BTC (research R-09/R-10).
 * Sem cotação (ou `estimatedBrl` nulo), as BTC ficam fora e `btcExcluded` = true.
 */
export const computeHomeTotal = (
  wallets: WalletInfo[],
  userId: number,
  quoteAvailable: boolean,
): HomeTotal => {
  let totalCents = 0;
  let btcExcluded = false;

  for (const wallet of wallets) {
    if (!wallet.isActive || wallet.ownerUserId !== userId) continue;

    if (wallet.currency === Currency.BTC) {
      if (quoteAvailable && wallet.estimatedBrl !== null) {
        totalCents += toCents(wallet.estimatedBrl);
      } else {
        btcExcluded = true;
      }
    } else {
      totalCents += toCents(wallet.balance);
    }
  }

  return { totalCents, btcExcluded };
};
