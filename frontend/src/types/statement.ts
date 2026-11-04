/** Extratos (data-model §8) */
import type { Currency } from "./api";
import type { DetailLevel } from "./balance";
import type { TransactionType, TransferKind } from "./transaction";
import type { PeriodPreset } from "../utils/dates";

export enum StatementScope {
  Wallet = "Wallet",
  User = "User",
  Group = "Group",
}

/** Totais por moeda: final = inicial + entradas − saídas */
export interface StatementTotalInfo {
  currency: Currency;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
}

/** Item do extrato (efeito do lançamento no escopo) */
export interface StatementEntryInfo {
  transactionId: number;
  occurredAt: string;
  type: TransactionType;
  sourceName: string;
  destinationName: string;
  currency: Currency;
  /** Com sinal: negativo = saída do escopo */
  amount: number;
  quotePriceBrl: number | null;
  description: string | null;
  /** Transferência na mesma moeda com origem e destino no escopo */
  internal: boolean;
  /** Tipo da transferência entre pessoas (feature 007); `null` fora dela. O estorno herda o do original. */
  transferKind?: TransferKind | null;
  /** Moeda do efeito na dívida; `null` sem efeito */
  debtCurrency?: Currency | null;
  /** Valor emprestado ou abatido da dívida, na moeda da dívida; `null` sem efeito */
  debtAmount?: number | null;
  /**
   * Primeiro nome do titular da origem/destino (enviado pelo backend da 007 além do `contracts/api.md`):
   * o rótulo "Empréstimo para Bruno" usa o nome da pessoa; sem ele, o nome da carteira.
   */
  sourceOwnerFirstName?: string | null;
  destinationOwnerFirstName?: string | null;
}

/** Resposta de `GET /api/statements/{scope}/{id}?start&end` */
export interface StatementResult {
  scope: StatementScope;
  scopeId: number;
  start: string;
  end: string;
  /** `Full` ou `Summary` (sem lançamentos) */
  detailLevel: DetailLevel;
  totals: StatementTotalInfo[];
  entries: StatementEntryInfo[];
}

/** Período escolhido no PeriodPicker (datas `yyyy-MM-dd`) */
export interface StatementPeriod {
  preset: PeriodPreset;
  start: string;
  end: string;
}
