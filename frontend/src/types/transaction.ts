/** Tipos de transação (data-model §6) */
import type { Currency } from "./api";

/** Tipo do lançamento como gravado pelo servidor */
export enum TransactionType {
  ExternalIncome = "ExternalIncome",
  ExternalExpense = "ExternalExpense",
  Transfer = "Transfer",
  BtcPurchase = "BtcPurchase",
  BtcSale = "BtcSale",
  Reversal = "Reversal",
}

/** Tipo escolhido na folha de lançamento */
export enum TransactionKind {
  Income = "income",
  Expense = "expense",
  Transfer = "transfer",
}

/** Conta de origem/destino de um lançamento */
export interface AccountRef {
  accountId: number;
  name: string;
  /** `Wallet` ou conta externa */
  kind: string;
  currency: Currency;
  ownerName: string | null;
}

/** Cotação usada numa conversão */
export interface QuoteRef {
  priceBrl: number;
  quotedAt: string;
  source: string;
}

/** Lançamento gravado */
export interface TransactionInfo {
  transactionId: number;
  type: TransactionType;
  source: AccountRef;
  destination: AccountRef;
  sourceAmount: number;
  destinationAmount: number;
  quote: QuoteRef | null;
  description: string | null;
  occurredAt: string;
  createdByUserId: number;
  reversedTransactionId: number | null;
  reversedByTransactionId: number | null;
}

/** Corpo de `POST /api/transactions/income` e `/expense` */
export interface IncomeExpenseInfo {
  walletId: number;
  /** Decimal com ponto, como string (research R-09) */
  amount: string;
  description: string | null;
}

/** Corpo de `POST /api/transactions/transfer` e `/transfer/preview` */
export interface TransferInfo {
  sourceWalletId: number;
  destinationWalletId: number;
  /** Valor na moeda da origem, decimal com ponto como string. Exatamente um entre `amount` e `amountBrl`. */
  amount?: string;
  /**
   * Valor em reais (2 casas), só em transferência bitcoin → bitcoin (feature 006).
   * O app usa só no preview; o registro envia `amount` em BTC vindo do preview (R-07).
   */
  amountBrl?: string;
  description: string | null;
}

/** Resposta de `POST /api/transactions/transfer/preview` */
export interface TransferPreviewResult {
  type: TransactionType;
  sourceAmount: number;
  destinationAmount: number;
  quote: QuoteRef | null;
}

/** Corpo de `POST /api/transactions/{id}/reverse` */
export interface ReverseInfo {
  description: string | null;
}
