/** Saldos por membro (data-model §9, contracts/api-additions.md §2–3) */
import type { Currency } from "./api";
import type { StatementVisibility } from "./group";
import type { QuoteSnapshot } from "./quote";

/** Quanto a pessoa pode ver (definido pelo servidor) */
export enum DetailLevel {
  /** Valores e carteiras */
  Full = "Full",
  /** Só os totais por membro */
  Summary = "Summary",
  /** Só a lista de pessoas, valores `null` */
  Hidden = "Hidden",
}

/** Carteira dentro de um saldo por membro */
export interface WalletBalanceInfo {
  walletId: number;
  name: string;
  currency: Currency;
  isVirtual: boolean;
  balance: number;
  /** Só BTC; `null` sem cotação */
  estimatedBrl: number | null;
  /** Pode abrir `GET /api/statements/wallets/{id}` */
  canViewStatement: boolean;
}

/** Saldo de um membro na família */
export interface MemberBalanceInfo {
  userId: number;
  firstName: string;
  lastName: string;
  isResponsible: boolean;
  /** `null` em Hidden */
  balanceBrl: number | null;
  balanceBtc: number | null;
  estimatedBrl: number | null;
  totalBrl: number | null;
  /** Só em Full */
  wallets: WalletBalanceInfo[];
}

/** Resposta de `GET /api/groups/{groupId}/balances` */
export interface GroupBalancesResult {
  groupId: number;
  name: string;
  statementVisibility: StatementVisibility;
  isResponsible: boolean;
  detailLevel: DetailLevel;
  /** `null` se nunca houve cotação */
  quote: QuoteSnapshot | null;
  /** Há saldo BTC sem cotação: o BTC ficou fora de `totalBrl` */
  btcExcluded: boolean;
  /** `null` em Hidden */
  totalBrl: number | null;
  members: MemberBalanceInfo[];
}

/** Saldo de uma pessoa em uma família */
export interface UserGroupBalanceInfo {
  groupId: number;
  name: string;
  detailLevel: DetailLevel;
  balanceBrl: number;
  balanceBtc: number;
  estimatedBrl: number | null;
  totalBrl: number;
  /** Só em Full */
  wallets: WalletBalanceInfo[];
}

/** Resposta de `GET /api/users/{userId}/group-balances` */
export interface UserGroupBalancesResult {
  userId: number;
  firstName: string;
  lastName: string;
  btcExcluded: boolean;
  totalBrl: number;
  groups: UserGroupBalanceInfo[];
}
