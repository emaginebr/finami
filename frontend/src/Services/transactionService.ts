import type {
  IncomeExpenseInfo,
  ReverseInfo,
  TransactionInfo,
  TransferInfo,
  TransferPreviewResult,
} from "../types/transaction";
import { apiFetch } from "./apiHelpers";

const API_BASE = "/api/transactions";

/** Envia só o campo de valor preenchido (`amount` ou `amountBrl`, nunca os dois — contracts/api.md) */
const toTransferBody = (data: TransferInfo): TransferInfo => {
  const body: TransferInfo = {
    sourceWalletId: data.sourceWalletId,
    destinationWalletId: data.destinationWalletId,
    description: data.description,
  };
  if (data.amountBrl !== undefined) body.amountBrl = data.amountBrl;
  else if (data.amount !== undefined) body.amount = data.amount;
  return body;
};

/**
 * Transaction Service — lançamentos. `amount` vai como string decimal (research R-09).
 * Devolve o DTO direto e lança `ApiError` em não-2xx (research R-02).
 */
class TransactionService {
  /** Entrada externa (`POST /api/transactions/income`) */
  async income(data: IncomeExpenseInfo): Promise<TransactionInfo> {
    return apiFetch<TransactionInfo>(`${API_BASE}/income`, { method: "POST", body: data });
  }

  /** Saída externa; 422 se o saldo não bastar (`POST /api/transactions/expense`) */
  async expense(data: IncomeExpenseInfo): Promise<TransactionInfo> {
    return apiFetch<TransactionInfo>(`${API_BASE}/expense`, { method: "POST", body: data });
  }

  /** Transferência; o servidor decide Transfer/BtcPurchase/BtcSale (`POST /api/transactions/transfer`) */
  async transfer(data: TransferInfo): Promise<TransactionInfo> {
    return apiFetch<TransactionInfo>(`${API_BASE}/transfer`, { method: "POST", body: toTransferBody(data) });
  }

  /**
   * Prévia sem gravar; 503 sem cotação (`POST /api/transactions/transfer/preview`).
   * Com `amountBrl` (BTC → BTC), `sourceAmount` volta em BTC e `quote` preenchido.
   */
  async previewTransfer(data: TransferInfo): Promise<TransferPreviewResult> {
    return apiFetch<TransferPreviewResult>(`${API_BASE}/transfer/preview`, {
      method: "POST",
      body: toTransferBody(data),
    });
  }

  /** Estorna um lançamento (`POST /api/transactions/{id}/reverse`) */
  async reverse(transactionId: number, data: ReverseInfo): Promise<TransactionInfo> {
    return apiFetch<TransactionInfo>(`${API_BASE}/${transactionId}/reverse`, {
      method: "POST",
      body: data,
    });
  }

  /** Um lançamento (`GET /api/transactions/{id}`) */
  async get(transactionId: number): Promise<TransactionInfo> {
    return apiFetch<TransactionInfo>(`${API_BASE}/${transactionId}`, { cache: "network-first" });
  }
}

export const transactionService = new TransactionService();
export default TransactionService;
