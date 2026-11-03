/** Tipos de dívida entre pessoas (feature 006, data-model "Dívida entre pessoas") */
import type { Currency } from "./api";

/** Sentido da dívida do ponto de vista da pessoa consultada (`userId`) */
export enum DebtDirection {
  /** A pessoa consultada deve à contraparte (a pagar) */
  Owes = "owes",
  /** A contraparte deve à pessoa consultada (a receber) */
  Owed = "owed",
}

/** Dívida líquida com uma contraparte, numa moeda */
export interface PersonDebt {
  counterpartUserId: number;
  counterpartName: string;
  counterpartFirstName: string;
  currency: Currency;
  /** Valor absoluto (> 0), na escala da moeda */
  amount: number;
  direction: DebtDirection;
}

/** Resposta de `GET /api/users/{userId}/debts` */
export interface PersonDebtsResult {
  userId: number;
  /** Ordenada por nome da contraparte (pt-BR), BRL antes de BTC; sem pares quites */
  debts: PersonDebt[];
}
