import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bitcoin, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TransactionType } from "../../types/transaction";

export interface TransactionVisual {
  icon: LucideIcon;
  /** Fundo e cor do ícone (components.md §6, StatementEntryRow) */
  className: string;
}

const VISUALS: Record<TransactionType, TransactionVisual> = {
  [TransactionType.ExternalIncome]: { icon: ArrowDownLeft, className: "bg-positive-soft text-positive" },
  [TransactionType.ExternalExpense]: { icon: ArrowUpRight, className: "bg-negative-soft text-negative" },
  [TransactionType.Transfer]: { icon: ArrowLeftRight, className: "bg-info-soft text-info" },
  [TransactionType.BtcPurchase]: { icon: Bitcoin, className: "bg-warning-soft text-warning" },
  [TransactionType.BtcSale]: { icon: Bitcoin, className: "bg-warning-soft text-warning" },
  [TransactionType.Reversal]: { icon: Undo2, className: "bg-surface-3 text-text-muted" },
};

/** Ícone e cores de um tipo de lançamento */
export const transactionVisual = (type: TransactionType): TransactionVisual =>
  VISUALS[type] ?? VISUALS[TransactionType.Transfer];

/** Tipos que movimentam entre carteiras (mostram a contraparte) */
export const isBetweenWallets = (type: TransactionType): boolean =>
  type === TransactionType.Transfer ||
  type === TransactionType.BtcPurchase ||
  type === TransactionType.BtcSale;
