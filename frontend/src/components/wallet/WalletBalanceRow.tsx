import { ChevronRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Currency } from "../../types/api";
import type { WalletBalanceInfo } from "../../types/balance";
import { formatBrl, formatMoney } from "../../utils/money";
import { Badge } from "../ui/Badge";
import { listRowClasses } from "../ui/listRow";
import type { NavState } from "../layout/navigation";
import { WalletIcon } from "./WalletIcon";
import { Dot, WalletRowContent } from "./WalletRowContent";
import { balanceAria } from "./walletAria";

export interface WalletBalanceRowProps {
  wallet: WalletBalanceInfo;
  /** Titular (lista "Carteiras da família") */
  ownerName?: string;
  /** Há cotação utilizável para o "≈ R$" das BTC */
  quoteAvailable: boolean;
  /** Estado de navegação para o extrato (aba, voltar) */
  linkState?: NavState;
}

/**
 * Carteira vinda das rotas de saldo por membro. Abre o extrato só quando `canViewStatement`;
 * senão é uma linha estática com cadeado e "extrato restrito".
 */
export const WalletBalanceRow = ({ wallet, ownerName, quoteAvailable, linkState }: WalletBalanceRowProps) => {
  const { t } = useTranslation();
  const isBtc = wallet.currency === Currency.BTC;
  const estimated = quoteAvailable ? wallet.estimatedBrl : null;
  const balanceText = formatMoney(wallet.balance, wallet.currency);

  const content = (
    <>
      <WalletIcon currency={wallet.currency} />
      <WalletRowContent
        name={wallet.name}
        balanceText={balanceText}
        negative={wallet.balance < 0}
        secondary={
          isBtc ? (estimated !== null ? t("wallet.approx", { value: formatBrl(estimated) }) : t("wallet.noQuote")) : undefined
        }
        subtitle={
          <>
            {wallet.canViewStatement ? (
              <span className="shrink-0">{t(`currency.${wallet.currency}`)}</span>
            ) : (
              <span className="flex shrink-0 items-center gap-1">
                <Lock aria-hidden="true" className="size-3" />
                {t("balances.statementRestricted")}
              </span>
            )}
            {wallet.isVirtual ? (
              <>
                <Dot />
                <Badge variant="virtual" className="shrink-0">
                  {t("badges.virtual")}
                </Badge>
              </>
            ) : null}
            {ownerName ? (
              <>
                <Dot />
                <span className="min-w-0 truncate">{t("wallet.ownerOf", { name: ownerName })}</span>
              </>
            ) : null}
          </>
        }
      />
    </>
  );

  if (!wallet.canViewStatement) {
    return <div className={listRowClasses({ twoLines: true, withIcon: true })}>{content}</div>;
  }

  const ariaLabel = [
    wallet.name,
    t(`currency.${wallet.currency}`),
    wallet.isVirtual ? t("badges.virtual") : null,
    balanceAria(t, wallet.balance, wallet.currency),
    isBtc ? (estimated !== null ? t("wallet.ariaApprox", { value: formatBrl(estimated) }) : t("wallet.noQuote")) : null,
    ownerName ? t("wallet.ownerOf", { name: ownerName }) : null,
  ]
    .filter(Boolean)
    .join(", ");

  const state: NavState = {
    ...linkState,
    walletSummary: { name: wallet.name, currency: wallet.currency, balance: wallet.balance },
  };

  return (
    <Link
      to={`/carteiras/${wallet.walletId}`}
      state={state}
      aria-label={ariaLabel}
      className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
    >
      {content}
      <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
    </Link>
  );
};

export default WalletBalanceRow;
