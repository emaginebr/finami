import { useId } from "react";
import { Check, ChevronsUpDown, CircleAlert, Hash, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Currency } from "../../types/api";
import { TransactionKind } from "../../types/transaction";
import type { WalletInfo } from "../../types/wallet";
import { cn } from "../../utils/cn";
import { formatMoney } from "../../utils/money";
import { Button } from "../ui/Button";
import { listRowClasses } from "../ui/listRow";
import { MoneyInput } from "../ui/MoneyInput";
import { TextField } from "../ui/TextField";
import { WalletIcon } from "../wallet/WalletIcon";
import { DESCRIPTION_MAX, DestinationMode, initials } from "./sheetModel";
import type { DestinationState, ResolvedDestination } from "./sheetModel";

// ---------------------------------------------------------------------------
// Faixa de erro do servidor (topo do passo)
// ---------------------------------------------------------------------------

export interface ServerErrorBannerProps {
  title: string;
  message: string;
}

export const ServerErrorBanner = ({ title, message }: ServerErrorBannerProps) => (
  <div
    role="alert"
    className="mb-4 flex items-start gap-2.5 rounded-md bg-negative-soft p-3 text-footnote text-negative"
  >
    <CircleAlert aria-hidden="true" className="mt-px size-[18px] shrink-0" />
    <span>
      <b className="mb-0.5 block font-semibold text-text">{title}</b>
      {message}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Linha que abre o seletor de carteira
// ---------------------------------------------------------------------------

interface SelectorRowProps {
  labelId: string;
  wallet: WalletInfo | null;
  subtitle: string | null;
  placeholder: string;
  onClick: () => void;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
  codeMode?: boolean;
  dataAutofocus?: boolean;
}

const SelectorRow = ({
  labelId,
  wallet,
  subtitle,
  placeholder,
  onClick,
  disabled,
  invalid,
  describedBy,
  codeMode = false,
  dataAutofocus = false,
}: SelectorRowProps) => {
  const contentId = useId();
  return (
    <div className={cn("overflow-hidden rounded-lg bg-surface", invalid && "ring-1 ring-negative")}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-labelledby={`${labelId} ${contentId}`}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        data-autofocus={dataAutofocus ? "" : undefined}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          listRowClasses({ twoLines: Boolean(wallet), withIcon: true, interactive: !disabled }),
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {wallet ? (
          <WalletIcon currency={wallet.currency} />
        ) : codeMode ? (
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-sm bg-info-soft text-info">
            <Hash className="size-[18px]" strokeWidth={1.75} />
          </span>
        ) : null}
        <span id={contentId} className="min-w-0 flex-1">
          <span className={cn("block truncate text-headline", !wallet && !codeMode && "font-normal text-text-subtle")}>
            {wallet ? wallet.name : placeholder}
          </span>
          {wallet && subtitle ? (
            <span className="mt-0.5 block truncate text-footnote text-text-muted">{subtitle}</span>
          ) : null}
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Passo do formulário
// ---------------------------------------------------------------------------

export interface FormStepProps {
  kind: TransactionKind;
  sourceWallet: WalletInfo | null;
  sourceError: string | null;
  onPickSource: () => void;
  destination: DestinationState;
  destinationOwnWallet: WalletInfo | null;
  resolvedDestination: ResolvedDestination | null;
  destinationError: string | null;
  onPickDestination: () => void;
  onCodeChange: (code: string) => void;
  onLookup: () => void;
  onConfirmChange: (confirmed: boolean) => void;
  amountText: string;
  onAmountChange: (text: string) => void;
  amountError: string | null;
  description: string;
  onDescriptionChange: (text: string) => void;
  serverError: string | null;
  /** Subtítulo de uma carteira no seletor ("Silva · Real") */
  describeWallet: (wallet: WalletInfo) => string;
  /** Enviando: campos desabilitados */
  disabled: boolean;
}

/** Formulário da página de lançamento: carteira(s), valor e descrição (data-model §6) */
export const FormStep = ({
  kind,
  sourceWallet,
  sourceError,
  onPickSource,
  destination,
  destinationOwnWallet,
  resolvedDestination,
  destinationError,
  onPickDestination,
  onCodeChange,
  onLookup,
  onConfirmChange,
  amountText,
  onAmountChange,
  amountError,
  description,
  onDescriptionChange,
  serverError,
  describeWallet,
  disabled,
}: FormStepProps) => {
  const { t } = useTranslation();
  const sourceLabelId = useId();
  const destinationLabelId = useId();
  const sourceErrorId = useId();
  const destinationErrorId = useId();
  const confirmId = useId();
  const isTransfer = kind === TransactionKind.Transfer;
  const codeMode = destination.mode === DestinationMode.Code;
  const publicWallet = destination.publicWallet;
  const needsOwnerConfirmation = Boolean(resolvedDestination && !resolvedDestination.isOwn);

  return (
    <div>
      {serverError ? (
        <ServerErrorBanner title={t("transaction.serverErrorTitle")} message={serverError} />
      ) : null}


      <div className="flex flex-col gap-1.5">
        <span id={sourceLabelId} className="text-footnote font-medium text-text-muted">
          {isTransfer ? t("transaction.from") : t("transaction.wallet")}
        </span>
        <SelectorRow
          labelId={sourceLabelId}
          wallet={sourceWallet}
          subtitle={sourceWallet ? describeWallet(sourceWallet) : null}
          placeholder={t("transaction.chooseWallet")}
          onClick={onPickSource}
          disabled={disabled}
          invalid={Boolean(sourceError)}
          describedBy={sourceError ? sourceErrorId : undefined}
          dataAutofocus={!sourceWallet}
        />
        {sourceError ? (
          <span id={sourceErrorId} role="alert" className="flex items-start gap-1.5 text-footnote text-negative">
            <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
            {sourceError}
          </span>
        ) : null}
      </div>

      {isTransfer ? (
        <div className="mt-4 flex flex-col gap-1.5">
          <span id={destinationLabelId} className="text-footnote font-medium text-text-muted">
            {t("transaction.to")}
          </span>
          <SelectorRow
            labelId={destinationLabelId}
            wallet={codeMode ? null : destinationOwnWallet}
            subtitle={destinationOwnWallet ? describeWallet(destinationOwnWallet) : null}
            placeholder={codeMode ? t("transaction.otherWallet") : t("transaction.chooseDestination")}
            onClick={onPickDestination}
            disabled={disabled}
            invalid={Boolean(destinationError) && !codeMode}
            describedBy={destinationError && !codeMode ? destinationErrorId : undefined}
            codeMode={codeMode}
          />

          {codeMode ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <TextField
                  label={t("transaction.walletCode")}
                  containerClassName="flex-1"
                  inputMode="numeric"
                  autoComplete="off"
                  data-autofocus=""
                  className="tabular-nums"
                  value={destination.code}
                  disabled={disabled}
                  error={destination.lookupError}
                  onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, ""))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onLookup();
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  className={destination.lookupError ? "mb-[1.875rem]" : undefined}
                  icon={<Search className="size-[18px]" strokeWidth={1.75} />}
                  loading={destination.lookingUp}
                  disabled={disabled || destination.code.length === 0}
                  onClick={onLookup}
                >
                  {t("actions.search")}
                </Button>
              </div>

              {/* O resultado da busca é anunciado a leitores de tela (T093) */}
              <div aria-live="polite">
              {publicWallet && resolvedDestination ? (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-pill bg-family-yellow text-subhead font-bold text-on-family"
                    >
                      {initials(publicWallet.ownerName)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-headline">{publicWallet.name}</div>
                      <div className="text-footnote text-text-muted">
                        {t("transaction.ownerLine", {
                          currency: t(`currency.${publicWallet.currency}`),
                          owner: publicWallet.ownerName,
                        })}
                      </div>
                    </div>
                  </div>
                  {needsOwnerConfirmation && publicWallet.isActive ? (
                    <label
                      htmlFor={confirmId}
                      className="mt-3 flex min-h-touch cursor-pointer items-center gap-3 text-subhead"
                    >
                      <input
                        id={confirmId}
                        type="checkbox"
                        checked={destination.confirmed}
                        disabled={disabled}
                        onChange={(event) => onConfirmChange(event.target.checked)}
                        className="size-[22px] shrink-0 accent-accent"
                      />
                      {t("transaction.confirmOwner", { owner: publicWallet.ownerName })}
                    </label>
                  ) : null}
                </div>
              ) : null}
              </div>
            </div>
          ) : null}

          {destinationError ? (
            <span
              id={destinationErrorId}
              role="alert"
              className="flex items-start gap-1.5 text-footnote text-negative"
            >
              <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
              {destinationError}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <MoneyInput
          label={t("transaction.amount")}
          currency={sourceWallet?.currency ?? Currency.BRL}
          value={amountText}
          onChange={onAmountChange}
          error={amountError}
          disabled={disabled}
          dataAutofocus={Boolean(sourceWallet) && !isTransfer}
          hint={
            sourceWallet
              ? t("transaction.available", {
                  value: formatMoney(sourceWallet.balance, sourceWallet.currency),
                })
              : undefined
          }
        />
      </div>

      <div className="mt-4">
        <TextField
          label={t("transaction.description")}
          labelSuffix={t("transaction.optional")}
          value={description}
          maxLength={DESCRIPTION_MAX}
          disabled={disabled}
          onChange={(event) => onDescriptionChange(event.target.value)}
          counter={t("transaction.counter", { count: description.length, max: DESCRIPTION_MAX })}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Seletor de carteira (sub-passo, role="listbox")
// ---------------------------------------------------------------------------

export interface WalletPickerStepProps {
  labelId: string;
  wallets: WalletInfo[];
  selectedWalletId: number | null;
  onSelect: (walletId: number) => void;
  describeWallet: (wallet: WalletInfo) => string;
  /** Mostra a opção "Outra carteira (código)" (destino da transferência) */
  onChooseCode?: () => void;
  codeSelected?: boolean;
}

export const WalletPickerStep = ({
  labelId,
  wallets,
  selectedWalletId,
  onSelect,
  describeWallet,
  onChooseCode,
  codeSelected = false,
}: WalletPickerStepProps) => {
  const { t } = useTranslation();

  if (wallets.length === 0 && !onChooseCode) {
    return <p className="py-8 text-center text-subhead text-text-muted">{t("transaction.noWallets")}</p>;
  }

  return (
    <div role="listbox" aria-labelledby={labelId} className="overflow-hidden rounded-lg bg-surface">
      {wallets.map((wallet, index) => {
        const selected = wallet.walletId === selectedWalletId && !codeSelected;
        return (
          <button
            key={wallet.walletId}
            type="button"
            role="option"
            aria-selected={selected}
            data-autofocus={selected || (selectedWalletId === null && index === 0) ? "" : undefined}
            onClick={() => onSelect(wallet.walletId)}
            className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
          >
            <WalletIcon currency={wallet.currency} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-headline">{wallet.name}</span>
              <span className="mt-0.5 block truncate text-footnote text-text-muted tabular-nums">
                {describeWallet(wallet)}
              </span>
            </span>
            {selected ? (
              <Check aria-hidden="true" className="size-5 shrink-0 text-positive" strokeWidth={2.5} />
            ) : null}
          </button>
        );
      })}
      {onChooseCode ? (
        <button
          type="button"
          role="option"
          aria-selected={codeSelected}
          onClick={onChooseCode}
          className={listRowClasses({ withIcon: true, interactive: true })}
        >
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-md bg-info-soft text-info">
            <Hash className="size-[18px]" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 text-headline">{t("transaction.otherWallet")}</span>
          {codeSelected ? (
            <Check aria-hidden="true" className="size-5 shrink-0 text-positive" strokeWidth={2.5} />
          ) : null}
        </button>
      ) : null}
    </div>
  );
};

export default FormStep;
