import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bitcoin, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TFunction } from "i18next";
import type { StatementEntryInfo } from "../../types/statement";
import { TransactionType, TransferKind } from "../../types/transaction";

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

/** Chaves do estorno por tipo de transferência ("Estorno de empréstimo"…) */
const REVERSAL_KIND_KEYS: Record<TransferKind, string> = {
  [TransferKind.Loan]: "statement.kind.reversalLoan",
  [TransferKind.Settlement]: "statement.kind.reversalSettlement",
  [TransferKind.Payment]: "statement.kind.reversalPayment",
};

/** "Estorno de empréstimo" / "Estorno de quitação" / "Estorno de pagamento" */
export const reversalKindLabel = (t: TFunction, kind: TransferKind): string => t(REVERSAL_KIND_KEYS[kind]);

/** Primeiro nome do titular da outra ponta; sem ele (fora do contrato), o nome da carteira */
const counterpartName = (entry: StatementEntryInfo, outgoing: boolean): string =>
  outgoing
    ? entry.destinationOwnerFirstName || entry.destinationName
    : entry.sourceOwnerFirstName || entry.sourceName;

/**
 * Rótulo de uma transferência com tipo (feature 007, components.md §11) conforme o lado da carteira
 * do extrato: "Empréstimo para Bruno" (saída) / "Empréstimo de Ana" (entrada); no estorno,
 * "Estorno de empréstimo". `null` quando o lançamento não tem tipo (segue o rótulo genérico).
 */
export const transferKindLabel = (t: TFunction, entry: StatementEntryInfo): string | null => {
  const kind = entry.transferKind;
  if (!kind) return null;
  if (entry.type === TransactionType.Reversal) return reversalKindLabel(t, kind);
  if (entry.type !== TransactionType.Transfer) return null;
  const outgoing = entry.amount < 0;
  return t(`statement.kind.${kind}${outgoing ? "To" : "From"}`, { name: counterpartName(entry, outgoing) });
};
