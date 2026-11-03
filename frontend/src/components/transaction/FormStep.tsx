import { useEffect, useId, useMemo, useRef } from "react";
import { ChevronsUpDown, CircleAlert, Users, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Currency, isOfflineError } from "../../types/api";
import { TransactionKind } from "../../types/transaction";
import type { TransferDestination, TransferDestinationsResult, WalletInfo } from "../../types/wallet";
import { cn } from "../../utils/cn";
import { formatMoney } from "../../utils/money";
import { errorMessage } from "../../utils/notify";
import { Banner } from "../ui/Banner";
import { listRowClasses } from "../ui/listRow";
import { MoneyInput } from "../ui/MoneyInput";
import { RetryBanner } from "../ui/RetryBanner";
import { Skeleton } from "../ui/Skeleton";
import { TextField } from "../ui/TextField";
import { AmountUnitToggle } from "./AmountUnitToggle";
import { WalletOption, WalletOptionContent } from "./WalletOption";
import { AmountUnit, DESCRIPTION_MAX, FocusReturn, walletOptionLabel } from "./sheetModel";
import { useRovingListbox } from "./useRovingListbox";
import type { ResolvedDestination, WalletOptionData } from "./sheetModel";

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
  wallet: WalletOptionData | null;
  placeholder: string;
  onClick: () => void;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
  dataAutofocus?: boolean;
}

/**
 * Campo De/Para preenchido: o nome acessível vem de `aria-labelledby` (rótulo + texto em `sr-only`);
 * o conteúdo visível fica `aria-hidden` (components.md §10 — sem `aria-label` em `<span>`).
 */
const SelectorRow = ({
  labelId,
  wallet,
  placeholder,
  onClick,
  disabled,
  invalid,
  describedBy,
  dataAutofocus = false,
}: SelectorRowProps) => {
  const { t } = useTranslation();
  const contentId = useId();
  const chevron = <ChevronsUpDown aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />;
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
          listRowClasses({ withIcon: Boolean(wallet), interactive: !disabled }),
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {wallet ? (
          <>
            <span id={contentId} className="sr-only">
              {walletOptionLabel(t, wallet)}
            </span>
            <span aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-3">
              <WalletOptionContent wallet={wallet} trailing={chevron} />
            </span>
          </>
        ) : (
          <>
            <span id={contentId} className="min-w-0 flex-1 truncate text-headline font-normal text-text-subtle">
              {placeholder}
            </span>
            {chevron}
          </>
        )}
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
  /** Destino escolhido no campo Para */
  destination: ResolvedDestination | null;
  destinationError: string | null;
  onPickDestination: () => void;
  /** Lista do Para carregada e vazia nos dois grupos: o campo vira aviso */
  noDestinations: boolean;
  /** `id` do aviso "sem destinos" (o Continuar aponta para ele com `aria-describedby`) */
  noDestinationsId: string;
  amountText: string;
  onAmountChange: (text: string) => void;
  amountError: string | null;
  /** Valor em reais já convertido em bitcoin (depósito/saque em carteira BTC), exibido junto ao campo */
  amountConversion?: string | null;
  /** Mostra o alternador "Bitcoin | Satoshis | Reais" (carteira em bitcoin; na transferência, De e Para) */
  showAmountUnit: boolean;
  amountUnit: AmountUnit;
  onAmountUnitChange: (unit: AmountUnit) => void;
  /** Foco inicial no campo Valor ao voltar para o formulário (ex.: "Informar em bitcoin"); tem prioridade */
  focusAmount: boolean;
  /** Campo que abriu o seletor, que recebe o foco de volta (`Primary` fica com a página) */
  returnFocusTo?: FocusReturn | null;
  description: string;
  onDescriptionChange: (text: string) => void;
  serverError: string | null;
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
  destinationError,
  onPickDestination,
  noDestinations,
  noDestinationsId,
  amountText,
  onAmountChange,
  amountError,
  showAmountUnit,
  amountUnit,
  onAmountUnitChange,
  amountConversion = null,
  focusAmount,
  returnFocusTo = null,
  description,
  onDescriptionChange,
  serverError,
  disabled,
}: FormStepProps) => {
  const { t } = useTranslation();
  // Um único alvo de `data-autofocus` por vez (o efeito da página foca o primeiro que achar)
  const autofocusSource =
    !focusAmount && (returnFocusTo === FocusReturn.Source || (returnFocusTo === null && !sourceWallet));
  const autofocusDestination = !focusAmount && returnFocusTo === FocusReturn.Destination;
  const sourceLabelId = useId();
  const destinationLabelId = useId();
  const sourceErrorId = useId();
  const destinationErrorId = useId();
  const isTransfer = kind === TransactionKind.Transfer;
  const inReais = showAmountUnit && amountUnit === AmountUnit.Brl;
  const inSats = showAmountUnit && amountUnit === AmountUnit.Sat;
  const amountCurrency = inReais ? Currency.BRL : (sourceWallet?.currency ?? Currency.BRL);

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
          placeholder={t("transaction.chooseWallet")}
          onClick={onPickSource}
          disabled={disabled}
          invalid={Boolean(sourceError)}
          describedBy={sourceError ? sourceErrorId : undefined}
          dataAutofocus={autofocusSource}
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
          {noDestinations ? (
            // Regra, não falha: tom informativo; não adianta abrir um seletor vazio
            <div id={noDestinationsId}>
              <Banner tone="info" role="status" icon={Users}>
                <span className="text-text">{t("transaction.noDestinations")}</span>
              </Banner>
            </div>
          ) : (
            <SelectorRow
              labelId={destinationLabelId}
              wallet={destination}
              placeholder={t("transaction.chooseDestination")}
              onClick={onPickDestination}
              disabled={disabled || !sourceWallet}
              invalid={Boolean(destinationError)}
              describedBy={destinationError ? destinationErrorId : undefined}
              dataAutofocus={autofocusDestination}
            />
          )}

          {destinationError && !noDestinations ? (
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
          currency={amountCurrency}
          sats={inSats}
          value={amountText}
          onChange={onAmountChange}
          error={amountError}
          disabled={disabled}
          dataAutofocus={
            Boolean(sourceWallet) && (focusAmount || (!isTransfer && returnFocusTo === null))
          }
          labelAccessory={
            showAmountUnit ? (
              <AmountUnitToggle value={amountUnit} onChange={onAmountUnitChange} disabled={disabled} />
            ) : undefined
          }
          hint={
            sourceWallet ? (
              <>
                {amountConversion ? <span className="block font-semibold text-text">{amountConversion}</span> : null}
                <span className="block">
                  {t("transaction.available", {
                    value: formatMoney(sourceWallet.balance, sourceWallet.currency),
                  })}
                </span>
              </>
            ) : undefined
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
// Seletor da carteira de origem (sub-passo, role="listbox")
// ---------------------------------------------------------------------------

export interface WalletPickerStepProps {
  labelId: string;
  wallets: WalletInfo[];
  selectedWalletId: number | null;
  onSelect: (walletId: number) => void;
}

export const WalletPickerStep = ({ labelId, wallets, selectedWalletId, onSelect }: WalletPickerStepProps) => {
  const { t } = useTranslation();
  const ids = useMemo(() => wallets.map((wallet) => wallet.walletId), [wallets]);
  // Uma parada de Tab + setas (REVIEW-006 I-2); começa na selecionada (ou na primeira)
  const roving = useRovingListbox(ids, selectedWalletId);

  if (wallets.length === 0) {
    return <p className="py-8 text-center text-subhead text-text-muted">{t("transaction.noWallets")}</p>;
  }

  return (
    <div
      role="listbox"
      aria-labelledby={labelId}
      onKeyDown={roving.onKeyDown}
      onFocus={roving.onFocus}
      className="overflow-hidden rounded-lg bg-surface"
    >
      {wallets.map((wallet) => {
        const tabStop = wallet.walletId === roving.tabStopId;
        return (
          <WalletOption
            key={wallet.walletId}
            wallet={wallet}
            selected={wallet.walletId === selectedWalletId}
            onSelect={onSelect}
            tabStop={tabStop}
            autofocus={tabStop}
          />
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Seletor do destino: grupos "Família" e "Converter" (APG "Listbox with grouped options")
// ---------------------------------------------------------------------------

export interface DestinationPickerStepProps {
  labelId: string;
  /** `null` enquanto carrega (ou com erro) */
  destinations: TransferDestinationsResult | null;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  selectedWalletId: number | null;
  onSelect: (walletId: number) => void;
}

interface DestinationGroup {
  key: string;
  title: string;
  wallets: TransferDestination[];
}

const DestinationSkeleton = () => (
  <div className="overflow-hidden rounded-lg bg-surface">
    {[0, 1, 2].map((index) => (
      <div key={index} aria-hidden="true" className={listRowClasses({ twoLines: true, withIcon: true })}>
        <Skeleton className="size-9 shrink-0" rounded="rounded-md" />
        <span className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-16" />
        </span>
        <Skeleton className="ml-auto h-4 w-20" />
      </div>
    ))}
  </div>
);

export const DestinationPickerStep = ({
  labelId,
  destinations,
  error,
  retrying,
  onRetry,
  selectedWalletId,
  onSelect,
}: DestinationPickerStepProps) => {
  const { t } = useTranslation();
  const groupIdBase = useId();
  const listboxRef = useRef<HTMLDivElement>(null);

  // Opções na ordem da tela: "Família" e depois "Converter" (as setas atravessam os grupos)
  const ids = useMemo(
    () => (destinations ? [...destinations.sameCurrency, ...destinations.conversion].map((w) => w.walletId) : []),
    [destinations],
  );
  const roving = useRovingListbox(ids, selectedWalletId);

  // A lista chegou depois de o seletor abrir (esqueleto) ou depois de um "Tentar de novo" bem-sucedido
  // (a faixa com o foco dentro some): o foco vai para a opção inicial, como na abertura do seletor
  // (REVIEW-006 M-2 e I-1). Só se o foco tiver caído no <body> — nunca tira o foco de onde a pessoa
  // foi (ex.: "‹ Voltar"). Se a nova tentativa falhar, o RetryBanner devolve o foco ao botão.
  const focusOnArrival = useRef(destinations === null);
  const hasDestinations = destinations !== null;
  useEffect(() => {
    if (!hasDestinations || !focusOnArrival.current) return;
    focusOnArrival.current = false;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    listboxRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [hasDestinations]);

  if (!destinations && error) {
    if (isOfflineError(error)) {
      return (
        <Banner tone="warning" role="alert" icon={WifiOff}>
          {t("pwa.offline.contentUnavailable")}
        </Banner>
      );
    }
    return (
      <RetryBanner
        retryLabel={t("pwa.offline.retry")}
        retrying={retrying}
        onRetry={() => {
          focusOnArrival.current = true;
          onRetry();
        }}
      >
        {errorMessage(error)}
      </RetryBanner>
    );
  }

  if (!destinations) {
    return (
      <div aria-busy="true">
        <span className="sr-only" role="status">
          {t("app.loading")}
        </span>
        <DestinationSkeleton />
      </div>
    );
  }

  const groups: DestinationGroup[] = [
    { key: "family", title: t("transaction.destinationGroups.family"), wallets: destinations.sameCurrency },
    { key: "conversion", title: t("transaction.destinationGroups.conversion"), wallets: destinations.conversion },
  ].filter((group) => group.wallets.length > 0);

  if (groups.length === 0) {
    return (
      <Banner tone="info" role="status" icon={Users}>
        <span className="text-text">{t("transaction.noDestinations")}</span>
      </Banner>
    );
  }

  return (
    <div
      ref={listboxRef}
      role="listbox"
      aria-labelledby={labelId}
      onKeyDown={roving.onKeyDown}
      onFocus={roving.onFocus}
    >
      {groups.map((group, groupIndex) => {
        const headerId = `${groupIdBase}-${group.key}`;
        return (
          <div key={group.key} role="group" aria-labelledby={headerId} className={groupIndex > 0 ? "mt-6" : undefined}>
            <div
              role="presentation"
              id={headerId}
              className="mb-2 px-4 text-footnote font-semibold tracking-wide text-text-muted uppercase"
            >
              {group.title}
            </div>
            <div className="overflow-hidden rounded-lg bg-surface">
              {group.wallets.map((wallet) => {
                const tabStop = wallet.walletId === roving.tabStopId;
                return (
                  <WalletOption
                    key={wallet.walletId}
                    wallet={wallet}
                    selected={wallet.walletId === selectedWalletId}
                    onSelect={onSelect}
                    tabStop={tabStop}
                    autofocus={tabStop}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FormStep;
