import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";
import { EMPTY_VALUE, formatMoney } from "../../utils/money";
import { listRowClasses } from "../ui/listRow";
import { WalletIcon } from "../wallet/WalletIcon";
import { walletOptionLabel } from "./sheetModel";
import type { WalletOptionData } from "./sheetModel";

export interface WalletOptionContentProps {
  wallet: WalletOptionData;
  /** Slot à direita do saldo (✓ da opção selecionada ou `ChevronsUpDown` do campo) */
  trailing: ReactNode;
}

/**
 * Conteúdo visual de uma carteira nos campos De/Para (components.md §10):
 * ícone do tipo · nome (até 2 linhas) + primeiro nome do titular · saldo (ou "—") · slot.
 * Decorativo para leitores de tela: quem usa dá o nome acessível (`walletOptionLabel`).
 */
export const WalletOptionContent = ({ wallet, trailing }: WalletOptionContentProps) => {
  const negative = wallet.balance !== null && wallet.balance < 0;
  return (
    <>
      <WalletIcon currency={wallet.currency} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-headline break-words">{wallet.name}</span>
        <span className="mt-0.5 block truncate text-footnote text-text-muted">{wallet.ownerFirstName}</span>
      </span>
      <span
        className={cn(
          "shrink-0 text-right text-headline font-semibold whitespace-nowrap tabular-nums",
          negative && "text-negative",
        )}
      >
        {wallet.balance === null ? (
          <span aria-hidden="true" className="text-text-subtle">
            {EMPTY_VALUE}
          </span>
        ) : (
          formatMoney(wallet.balance, wallet.currency)
        )}
      </span>
      {trailing}
    </>
  );
};

export interface WalletOptionProps {
  wallet: WalletOptionData;
  selected: boolean;
  onSelect: (walletId: number) => void;
  /** Recebe o foco ao abrir o seletor */
  autofocus?: boolean;
  /**
   * Parada de Tab do listbox (roving tabindex, `useRovingListbox`): só uma opção com `true`.
   * O `data-option-id` (`OPTION_ID_ATTR`) liga a opção ao id usado pelas setas.
   */
  tabStop?: boolean;
}

/**
 * Opção (`role="option"`) dos seletores De e Para, com nome acessível
 * "Nubank, de Ana, real, saldo R$ 1.234,56" e espaço do ✓ sempre reservado.
 *
 * O nome acessível segue o texto do contrato (contracts/ui.md) e começa pelo nome da carteira, o primeiro
 * texto visível: comando de voz ("clicar Nubank") funciona. A regra experimental do axe
 * `label-content-name-mismatch` não roda nos testes (REVIEW-006 M-3).
 */
export const WalletOption = ({ wallet, selected, onSelect, autofocus = false, tabStop = true }: WalletOptionProps) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={walletOptionLabel(t, wallet)}
      tabIndex={tabStop ? 0 : -1}
      data-option-id={wallet.walletId}
      data-autofocus={autofocus ? "" : undefined}
      onClick={() => onSelect(wallet.walletId)}
      className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
    >
      <WalletOptionContent
        wallet={wallet}
        trailing={
          <span aria-hidden="true" className="flex w-5 shrink-0 justify-center">
            {selected ? <Check className="size-5 text-positive" strokeWidth={2.5} /> : null}
          </span>
        }
      />
    </button>
  );
};

export default WalletOption;
