import type { Currency } from "../../types/api";
import type { WalletPublicInfo } from "../../types/wallet";

/** Passos da página de lançamento (data-model §6) */
export enum SheetStep {
  Form = "form",
  PickSource = "pickSource",
  PickDestination = "pickDestination",
  Preview = "preview",
}

/** Como o destino da transferência foi escolhido */
export enum DestinationMode {
  None = "none",
  /** Uma das carteiras que a pessoa controla */
  Own = "own",
  /** "Outra carteira (código)" — `GET /api/wallets/{id}/public` */
  Code = "code",
}

export interface DestinationState {
  mode: DestinationMode;
  /** Carteira própria escolhida (modo `Own`) */
  walletId: number | null;
  /** Código digitado (modo `Code`) */
  code: string;
  /** Resultado da busca por código */
  publicWallet: WalletPublicInfo | null;
  lookupError: string | null;
  lookingUp: boolean;
  /** A pessoa confirmou o titular do destino de terceiro */
  confirmed: boolean;
}

/** Destino já resolvido para validação, prévia e envio */
export interface ResolvedDestination {
  walletId: number;
  name: string;
  currency: Currency;
  ownerName: string;
  /** Carteira que a pessoa controla (sem confirmação de titular) */
  isOwn: boolean;
  isActive: boolean;
}

export const EMPTY_DESTINATION: DestinationState = {
  mode: DestinationMode.None,
  walletId: null,
  code: "",
  publicWallet: null,
  lookupError: null,
  lookingUp: false,
  confirmed: false,
};

/** Limite da descrição (data-model §6) */
export const DESCRIPTION_MAX = 500;

/** Iniciais para o avatar ("Luísa Ramos" → "LR") */
export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase();
};
