import type { TFunction } from "i18next";
import type { Currency } from "../../types/api";
import { formatMoney } from "../../utils/money";

/** Passos da página de lançamento (data-model §6) */
export enum SheetStep {
  Form = "form",
  PickSource = "pickSource",
  PickDestination = "pickDestination",
  Preview = "preview",
}

/**
 * Onde o foco cai ao voltar para o formulário (REVIEW-006 I-1): o campo que abriu o seletor
 * (De/Para) ou o botão principal ao voltar da prévia.
 */
export enum FocusReturn {
  Source = "source",
  Destination = "destination",
  Primary = "primary",
}

/** Unidade em que o valor de uma transferência bitcoin → bitcoin é informado (feature 006, FR-020) */
export enum AmountUnit {
  Btc = "btc",
  Brl = "brl",
}

/**
 * Dados de uma carteira exibidos numa opção dos campos De e Para (`WalletOption`).
 * `WalletInfo` (De) e `TransferDestination` (Para) têm esse formato.
 */
export interface WalletOptionData {
  walletId: number;
  name: string;
  currency: Currency;
  ownerFirstName: string;
  /** `null` = saldo oculto para quem consulta (FR-018) */
  balance: number | null;
}

/** Destino escolhido no campo Para, para validação, prévia e envio */
export interface ResolvedDestination extends WalletOptionData {
  ownerUserId: number;
  /** Carteira do próprio titular da origem (sem dívida e sem confirmação de titular) */
  isOwn: boolean;
}

/**
 * Nome acessível de uma opção de carteira (contracts/ui.md): "Nubank, de Ana, real, saldo R$ 1.234,56"
 * ou "…, saldo oculto" quando o saldo é restrito.
 */
export const walletOptionLabel = (t: TFunction, wallet: WalletOptionData): string => {
  const params = {
    wallet: wallet.name,
    owner: wallet.ownerFirstName,
    currency: t(`transaction.walletCurrency.${wallet.currency}`),
  };
  return wallet.balance === null
    ? t("transaction.walletOptionHidden", params)
    : t("transaction.walletOption", { ...params, balance: formatMoney(wallet.balance, wallet.currency) });
};

/** Limite da descrição (data-model §6) */
export const DESCRIPTION_MAX = 500;
