/** Extratos (data-model §8) */
import type { Currency } from "./api";
import type { DetailLevel } from "./balance";
import type { TransactionType } from "./transaction";
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
