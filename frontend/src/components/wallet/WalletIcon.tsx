import { Bitcoin, Wallet } from "lucide-react";
import { Currency } from "../../types/api";
import { cn } from "../../utils/cn";

export interface WalletIconProps {
  currency: Currency;
  className?: string;
}

/** Ícone de 36 px da carteira: BRL `Wallet` verde, BTC `Bitcoin` amarelo (decorativo) */
export const WalletIcon = ({ currency, className }: WalletIconProps) => {
  const isBtc = currency === Currency.BTC;
  const Icon = isBtc ? Bitcoin : Wallet;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-md",
        isBtc ? "bg-warning-soft text-warning" : "bg-surface-2 text-accent",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} />
    </span>
  );
};

export default WalletIcon;
