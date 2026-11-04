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

/**
 * Tipo de uma transferência entre pessoas diferentes (feature 007). Ausente (`null`) entre carteiras
 * do mesmo titular.
 */
export enum TransferKind {
  /** Empréstimo: o titular do destino passa a dever ao da origem */
  Loan = "loan",
  /** Quitação: abate a dívida do titular da origem com o do destino */
  Settlement = "settlement",
  /** Pagamento: não gera dívida */
  Payment = "payment",
}

/** Ordem de exibição dos tipos (seletor "Tipo") */
export const TRANSFER_KINDS: TransferKind[] = [TransferKind.Loan, TransferKind.Settlement, TransferKind.Payment];

/** Efeito de um empréstimo ou de uma quitação na dívida entre as duas pessoas (prévia, feature 007) */
export interface TransferDebtEffect {
  /** Moeda da dívida */
  currency: Currency;
  /** Valor emprestado ou abatido, na moeda da dívida */
  amount: number;
  /** Dívida "devedor deve a credor" antes do lançamento */
  before: number;
  /** A mesma dívida depois do lançamento (0 em "quitar tudo") */
  after: number;
  debtorUserId: number;
  creditorUserId: number;
  /** Primeiro nome do devedor (enviado pelo backend além do contrato; o app prefere os titulares das carteiras) */
  debtorFirstName?: string;
  /** Primeiro nome do credor (idem) */
  creditorFirstName?: string;
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
  /** Tipo da transferência entre pessoas (feature 007); `null` fora dela (também no estorno, copiado do original) */
  transferKind?: TransferKind | null;
  /** Moeda do efeito na dívida; `null` sem efeito */
  debtCurrency?: Currency | null;
  /** Valor emprestado ou abatido da dívida, na moeda da dívida; `null` sem efeito */
  debtAmount?: number | null;
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
  /** Tipo (feature 007): só entre titulares diferentes; o app sempre envia */
  kind?: TransferKind;
  /** Moeda da dívida quitada, só com `kind = settlement` (padrão: moeda das carteiras) */
  debtCurrency?: Currency;
  /** Quita a dívida inteira, só com `kind = settlement`; com `true`, sem `amount`/`amountBrl` */
  settleAll?: boolean;
  description: string | null;
}

/** Resposta de `POST /api/transactions/transfer/preview` */
export interface TransferPreviewResult {
  type: TransactionType;
  sourceAmount: number;
  destinationAmount: number;
  quote: QuoteRef | null;
  /** Tipo resolvido pelo servidor (feature 007); `null` entre carteiras do mesmo titular */
  kind?: TransferKind | null;
  /** Efeito na dívida; `null` em pagamento e entre carteiras do mesmo titular */
  debt?: TransferDebtEffect | null;
}

/** Corpo de `POST /api/transactions/{id}/reverse` */
export interface ReverseInfo {
  description: string | null;
}
