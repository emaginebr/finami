import { TransactionKind } from "../types/transaction";

/** Rota da página de cada tipo de lançamento */
export const TRANSACTION_PATHS: Record<TransactionKind, string> = {
  [TransactionKind.Income]: "/depositar",
  [TransactionKind.Expense]: "/sacar",
  [TransactionKind.Transfer]: "/transferir",
};

/** Parâmetro com a carteira pré-selecionada (ex.: `/sacar?carteira=12`, vindo do extrato) */
export const WALLET_PARAM = "carteira";

/** Link para a página de um lançamento, pré-selecionando a carteira quando houver */
export const transactionPath = (kind: TransactionKind, walletId: number | null = null): string =>
  walletId ? `${TRANSACTION_PATHS[kind]}?${WALLET_PARAM}=${walletId}` : TRANSACTION_PATHS[kind];
