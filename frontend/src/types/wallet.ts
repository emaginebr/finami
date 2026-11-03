/** Tipos de carteira (data-model §5) */
import type { Currency } from "./api";

/** Carteira como devolvida por `GET /api/wallets` */
export interface WalletInfo {
  walletId: number;
  name: string;
  description: string | null;
  currency: Currency;
  /** Carteira virtual (não corresponde a uma conta real) */
  isVirtual: boolean;
  isActive: boolean;
  /** Titular da carteira */
  ownerUserId: number;
  ownerName: string;
  /** Primeiro nome do titular (feature 006, campos De/Para) */
  ownerFirstName: string;
  /** Família à qual a carteira está ligada; `null` = avulsa */
  groupId: number | null;
  /** Saldo na moeda da carteira */
  balance: number;
  /** Só BTC: saldo × cotação atual, truncado em 2 casas; `null` sem cotação */
  estimatedBrl: number | null;
  /** A pessoa logada pode movimentar a carteira */
  canControl: boolean;
  createdAt: string;
}

/** Corpo de `POST /api/wallets` */
export interface WalletInsertInfo {
  name: string;
  description: string | null;
  currency: Currency;
  isVirtual: boolean;
  /** Titular; `null` = a própria pessoa */
  ownerUserId: number | null;
  groupId: number | null;
}

/** Corpo de `PUT /api/wallets/{id}` (moeda é imutável) */
export interface WalletUpdateInfo {
  name: string;
  description: string | null;
  isVirtual: boolean;
}

/** Corpo de `PUT /api/wallets/{id}/group` */
export interface WalletGroupInfo {
  groupId: number | null;
}

/** Opção do campo Para (`GET /api/wallets/{id}/transfer-destinations`, feature 006) */
export interface TransferDestination {
  walletId: number;
  name: string;
  currency: Currency;
  ownerUserId: number;
  ownerFirstName: string;
  /** Carteira do próprio titular da origem */
  isOwn: boolean;
  /** `null` = saldo oculto para quem consulta (FR-018) */
  balance: number | null;
}

/** Resposta de `GET /api/wallets/{id}/transfer-destinations` */
export interface TransferDestinationsResult {
  sourceWalletId: number;
  /** Mesma moeda: carteiras do titular e das pessoas da família, sem a origem */
  sameCurrency: TransferDestination[];
  /** Outra moeda: só carteiras do próprio titular (conversão) */
  conversion: TransferDestination[];
}

/** Filtros de `GET /api/wallets` */
export interface WalletListFilters {
  groupId?: number;
  ownerUserId?: number;
  includeInactive?: boolean;
}
