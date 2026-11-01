import type { TFunction } from "i18next";
import { Currency } from "../../types/api";
import { formatAmountNumber, formatMoney } from "../../utils/money";

/**
 * Trecho "saldo …" do `aria-label` de uma carteira. Negativos são lidos como
 * "saldo negativo de R$ 342,10" (o "−" sozinho pode ser omitido por leitores de tela).
 */
export const balanceAria = (t: TFunction, balance: number, currency: Currency): string => {
  const absolute = Math.abs(balance);
  const value =
    currency === Currency.BTC
      ? t("wallet.ariaBtcAmount", { value: formatAmountNumber(absolute, Currency.BTC) })
      : formatMoney(absolute, currency);
  return balance < 0 ? t("wallet.ariaBalanceNegative", { value }) : t("wallet.ariaBalance", { value });
};
