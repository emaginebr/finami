import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Currency } from "../../types/api";
import { cn } from "../../utils/cn";
import type { WalletInfo } from "../../types/wallet";
import { formatBrl, formatMoney } from "../../utils/money";
import { Badge } from "../ui/Badge";
import { listRowClasses } from "../ui/listRow";
import { Skeleton } from "../ui/Skeleton";
import type { AppTab, NavState } from "../layout/navigation";
import { WalletIcon } from "./WalletIcon";
import { Dot, WalletRowContent } from "./WalletRowContent";
import { balanceAria } from "./walletAria";

export interface WalletCardProps {
  wallet: WalletInfo;
  /** Pessoa logada: mostra "de {titular}" quando a carteira é de outra pessoa */
  currentUserId: number | null;
  /** Há cotação utilizável (Available/Stale); sem ela a BTC mostra "sem cotação" (padrão true) */
  quoteAvailable?: boolean;
  /** Aba de origem (mantém a aba destacada no extrato) */
  fromTab?: AppTab;
  /** Mostra o selo "inativa" e esmaece (aba Carteiras) */
  showInactive?: boolean;
  /** Não mostra "de {titular}" (a linha já está sob o nome do titular) */
  hideOwner?: boolean;
  className?: string;
}

/** Linha de 60 px que abre o extrato da carteira (components.md §6) */
export const WalletCard = ({
  wallet,
  currentUserId,
  quoteAvailable = true,
  fromTab,
  showInactive = false,
  hideOwner = false,
  className,
}: WalletCardProps) => {
  const { t } = useTranslation();
  const isBtc = wallet.currency === Currency.BTC;
  // Coerente com o total da Home: sem cotação (503) ou sem estimativa → "sem cotação"
  const estimatedBrl = quoteAvailable ? wallet.estimatedBrl : null;
  const isOther = !hideOwner && currentUserId !== null && wallet.ownerUserId !== currentUserId;
  const inactive = showInactive && !wallet.isActive;
  const negative = wallet.balance < 0;
  const balanceText = formatMoney(wallet.balance, wallet.currency);

  const ariaParts = [
    wallet.name,
    t(`currency.${wallet.currency}`),
    wallet.isVirtual ? t("badges.virtual") : null,
    inactive ? t("badges.inactive") : null,
    balanceAria(t, wallet.balance, wallet.currency),
    isBtc && estimatedBrl !== null
      ? t("wallet.ariaApprox", { value: formatBrl(estimatedBrl) })
      : isBtc
        ? t("wallet.noQuote")
        : null,
    isOther ? t("wallet.ownerOf", { name: wallet.ownerName }) : null,
  ];
  const state: NavState = fromTab ? { tab: fromTab } : {};

  return (
    <Link
      to={`/carteiras/${wallet.walletId}`}
      state={state}
      aria-label={ariaParts.filter(Boolean).join(", ")}
      className={cn(listRowClasses({ twoLines: true, withIcon: true, interactive: true }), className)}
    >
      <WalletIcon currency={wallet.currency} className={inactive ? "opacity-60" : undefined} />
      <WalletRowContent
        name={wallet.name}
        dim={inactive}
        balanceText={balanceText}
        negative={negative}
        secondary={
          isBtc
            ? estimatedBrl !== null
              ? t("wallet.approx", { value: formatBrl(estimatedBrl) })
              : t("wallet.noQuote")
            : undefined
        }
        subtitle={
          // Selos antes do titular: só o nome do titular trunca (REVIEW H-2)
          <>
            <span className="shrink-0">{t(`currency.${wallet.currency}`)}</span>
            {wallet.isVirtual ? (
              <>
                <Dot />
                <Badge variant="virtual" className="shrink-0">
                  {t("badges.virtual")}
                </Badge>
              </>
            ) : null}
            {inactive ? (
              <>
                <Dot />
                <Badge variant="inactive" className="shrink-0">
                  {t("badges.inactive")}
                </Badge>
              </>
            ) : null}
            {isOther ? (
              <>
                <Dot />
                <span className="min-w-0 truncate">{t("wallet.ownerOf", { name: wallet.ownerName })}</span>
              </>
            ) : null}
          </>
        }
      />
      <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
    </Link>
  );
};

/** Esqueleto de uma linha de carteira */
export const WalletCardSkeleton = () => (
  <div aria-hidden="true" className={listRowClasses({ twoLines: true, withIcon: true })}>
    <Skeleton className="size-9" rounded="rounded-md" />
    <span className="min-w-0 flex-1">
      <Skeleton className="h-3.5 w-[140px] max-w-full" />
      <Skeleton className="mt-2 h-3 w-20" />
    </span>
    <Skeleton className="h-4 w-[90px]" />
  </div>
);

export default WalletCard;
