import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGroup } from "../../hooks/useGroup";
import { useTransaction } from "../../hooks/useTransaction";
import { useWallet } from "../../hooks/useWallet";
import { useAuth } from "../../hooks/useAuth";
import { OfflineActionKind, useOnlineAction } from "../../hooks/useOnlineAction";
import { Currency, isApiError, isUnconfirmedWriteError } from "../../types/api";
import { TransactionKind, TransactionType } from "../../types/transaction";
import type { TransactionInfo, TransferInfo, TransferPreviewResult } from "../../types/transaction";
import type { WalletInfo } from "../../types/wallet";
import { errorMessage, notifySuccess } from "../../utils/notify";
import { AMOUNT_ERRORS, CURRENCY_DECIMALS, formatMoney, parseAmountInput } from "../../utils/money";
import { groupWallets } from "../../utils/walletGrouping";
import { Button } from "../ui/Button";
import { Sheet, SheetHeaderButton } from "../ui/Sheet";
import { FormStep, WalletPickerStep } from "./FormStep";
import { PreviewStep } from "./PreviewStep";
import { TypeStep } from "./TypeStep";
import { DESCRIPTION_MAX, DestinationMode, EMPTY_DESTINATION, SheetStep } from "./sheetModel";
import type { DestinationState, ResolvedDestination } from "./sheetModel";

export interface TransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Carteira pré-selecionada (ex.: a do extrato aberto) */
  defaultWalletId?: number | null;
}

/**
 * Folha de lançamento (data-model §6):
 * chooseType → form → (preview) → submitting → closed + toast.
 * A prévia é obrigatória quando as moedas diferem ou o destino é de terceiro.
 */
export const TransactionSheet = ({ open, onOpenChange, defaultWalletId = null }: TransactionSheetProps) => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { wallets, loaded, loading: walletsLoading, loadWallets, getPublicWallet } = useWallet();
  const { groups } = useGroup();
  const { createIncome, createExpense, createTransfer, previewTransfer } = useTransaction();
  const pickerLabelId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const onlineAction = useOnlineAction(OfflineActionKind.Transaction);

  const [step, setStep] = useState<SheetStep>(SheetStep.ChooseType);
  const [kind, setKind] = useState<TransactionKind>(TransactionKind.Income);
  const [sourceWalletId, setSourceWalletId] = useState<number | null>(defaultWalletId);
  const [destination, setDestination] = useState<DestinationState>(EMPTY_DESTINATION);
  const [amountText, setAmountText] = useState("");
  const [description, setDescription] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<TransferPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewBlocked, setPreviewBlocked] = useState(false);

  // Carteiras ativas que a pessoa controla, na ordem da Home (famílias A→Z, depois avulsas)
  const controllable = useMemo<WalletInfo[]>(
    () =>
      groupWallets(
        wallets.filter((w) => w.isActive && w.canControl),
        groups,
      ).flatMap((section) => section.wallets),
    [wallets, groups],
  );

  // Garante a lista de carteiras (a folha pode abrir antes da Home carregar)
  useEffect(() => {
    if (open && !loaded && !walletsLoading) loadWallets().catch(() => undefined);
    // Só na abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Pré-seleciona a carteira padrão (ou a primeira) quando a lista chega
  useEffect(() => {
    if (sourceWalletId !== null && controllable.some((w) => w.walletId === sourceWalletId)) return;
    const preferred = controllable.find((w) => w.walletId === defaultWalletId) ?? controllable[0];
    if (preferred) setSourceWalletId(preferred.walletId);
  }, [controllable, defaultWalletId, sourceWalletId]);

  // Ao trocar de passo, o foco vai para o primeiro elemento marcado com data-autofocus
  useEffect(() => {
    const target = contentRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    target?.focus();
  }, [step]);

  const sourceWallet = controllable.find((w) => w.walletId === sourceWalletId) ?? null;

  const groupName = useCallback(
    (groupId: number | null) => groups.find((g) => g.groupId === groupId)?.name ?? null,
    [groups],
  );

  const describeWallet = useCallback(
    (wallet: WalletInfo) => {
      const parts = [
        formatMoney(wallet.balance, wallet.currency),
        wallet.groupId === null ? t("wallet.loose") : groupName(wallet.groupId),
        wallet.ownerUserId !== session?.user.userId ? t("wallet.ownerOf", { name: wallet.ownerName }) : null,
      ];
      return parts.filter(Boolean).join(" · ");
    },
    [groupName, session, t],
  );

  // ---------------------------------------------------------------------------
  // Destino resolvido
  // ---------------------------------------------------------------------------

  const destinationOwnWallet =
    destination.mode === DestinationMode.Own
      ? (controllable.find((w) => w.walletId === destination.walletId) ?? null)
      : null;

  const resolvedDestination = useMemo<ResolvedDestination | null>(() => {
    if (destinationOwnWallet) {
      return {
        walletId: destinationOwnWallet.walletId,
        name: destinationOwnWallet.name,
        currency: destinationOwnWallet.currency,
        ownerName: destinationOwnWallet.ownerName,
        isOwn: true,
        isActive: destinationOwnWallet.isActive,
      };
    }
    const pub = destination.mode === DestinationMode.Code ? destination.publicWallet : null;
    if (!pub) return null;
    return {
      walletId: pub.walletId,
      name: pub.name,
      currency: pub.currency,
      ownerName: pub.ownerName,
      isOwn: controllable.some((w) => w.walletId === pub.walletId),
      isActive: pub.isActive,
    };
  }, [destinationOwnWallet, destination, controllable]);

  // ---------------------------------------------------------------------------
  // Validação (data-model §6)
  // ---------------------------------------------------------------------------

  const isTransfer = kind === TransactionKind.Transfer;
  const parsedAmount = sourceWallet ? parseAmountInput(amountText, sourceWallet.currency) : null;
  const amountTyped = amountText.trim().length > 0;
  const translateAmountError = (error: string, currency: Currency): string => {
    if (error === AMOUNT_ERRORS.required) return t("transaction.amountErrors.required");
    if (error === AMOUNT_ERRORS.invalid) return t("transaction.amountErrors.invalid");
    if (error === AMOUNT_ERRORS.notPositive) return t("transaction.amountErrors.notPositive");
    if (error === AMOUNT_ERRORS.tooManyDecimals(CURRENCY_DECIMALS[currency])) {
      return t(`transaction.amountErrors.tooManyDecimals${currency}`);
    }
    return error;
  };
  const amountError =
    sourceWallet && parsedAmount?.error && (amountTyped || attempted)
      ? translateAmountError(parsedAmount.error, sourceWallet.currency)
      : null;
  const sourceError = !sourceWallet && attempted ? t("transaction.validation.walletRequired") : null;

  let destinationError: string | null = null;
  let destinationBlocking = false;
  if (isTransfer) {
    if (resolvedDestination && sourceWallet && resolvedDestination.walletId === sourceWallet.walletId) {
      destinationError = t("transaction.validation.sameWallet");
      destinationBlocking = true;
    } else if (resolvedDestination && !resolvedDestination.isActive) {
      destinationError = t("transaction.lookupInactive");
      destinationBlocking = true;
    } else if (resolvedDestination && !resolvedDestination.isOwn && !destination.confirmed) {
      destinationBlocking = true;
      if (attempted) destinationError = t("transaction.validation.confirmOwnerRequired");
    } else if (!resolvedDestination) {
      if (attempted) {
        destinationError =
          destination.mode === DestinationMode.Code
            ? t("transaction.validation.lookupRequired")
            : t("transaction.validation.destinationRequired");
      }
    }
  }

  const descriptionValid = description.length <= DESCRIPTION_MAX;
  const formValid =
    Boolean(sourceWallet) &&
    Boolean(parsedAmount?.value) &&
    descriptionValid &&
    (!isTransfer || (resolvedDestination !== null && !destinationBlocking));

  const needsPreview =
    isTransfer &&
    sourceWallet !== null &&
    resolvedDestination !== null &&
    (resolvedDestination.currency !== sourceWallet.currency || !resolvedDestination.isOwn);

  const hasBlockingError = Boolean(amountTyped && parsedAmount?.error) || destinationBlocking;

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------

  const transferBody = (): TransferInfo | null => {
    if (!sourceWallet || !resolvedDestination || !parsedAmount?.value) return null;
    return {
      sourceWalletId: sourceWallet.walletId,
      destinationWalletId: resolvedDestination.walletId,
      amount: parsedAmount.value,
      description: description.trim() || null,
    };
  };

  const successMessage = (result: TransactionInfo): string => {
    switch (result.type) {
      case TransactionType.ExternalIncome:
        return t("transaction.success.income", {
          amount: formatMoney(result.destinationAmount, result.destination.currency),
          wallet: result.destination.name,
        });
      case TransactionType.ExternalExpense:
        return t("transaction.success.expense", {
          amount: formatMoney(result.sourceAmount, result.source.currency),
          wallet: result.source.name,
        });
      case TransactionType.BtcPurchase:
        return t("transaction.success.purchase", {
          amount: formatMoney(result.destinationAmount, result.destination.currency),
          wallet: result.destination.name,
        });
      case TransactionType.BtcSale:
        return t("transaction.success.sale", {
          amount: formatMoney(result.destinationAmount, result.destination.currency),
          wallet: result.destination.name,
        });
      default:
        return t("transaction.success.transfer", {
          amount: formatMoney(result.sourceAmount, result.source.currency),
          wallet: result.destination.name,
        });
    }
  };

  const loadPreview = async (body: TransferInfo) => {
    setPreview(null);
    setPreviewBlocked(false);
    setPreviewLoading(true);
    try {
      setPreview(await previewTransfer(body));
    } catch (err) {
      if (isApiError(err) && err.status === 503) {
        setPreviewBlocked(true);
      } else {
        setServerError(errorMessage(err));
        setStep(SheetStep.Form);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const send = async () => {
    if (submittingRef.current || !sourceWallet || !parsedAmount?.value) return;
    submittingRef.current = true;
    setSubmitting(true);
    setServerError(null);
    try {
      let result: TransactionInfo;
      const descriptionValue = description.trim() || null;
      if (kind === TransactionKind.Income) {
        result = await createIncome({
          walletId: sourceWallet.walletId,
          amount: parsedAmount.value,
          description: descriptionValue,
        });
      } else if (kind === TransactionKind.Expense) {
        result = await createExpense({
          walletId: sourceWallet.walletId,
          amount: parsedAmount.value,
          description: descriptionValue,
        });
      } else {
        const body = transferBody();
        if (!body) return;
        result = await createTransfer(body);
      }
      notifySuccess(successMessage(result));
      onOpenChange(false);
    } catch (err) {
      if (isUnconfirmedWriteError(err)) {
        // A rede caiu com o envio em andamento: o lançamento pode ter sido gravado.
        // Nunca reenviar sozinho (FR-011); a pessoa confere o extrato (T041).
        setServerError(t("pwa.offline.writeUnconfirmed"));
        setStep(SheetStep.Form);
      } else if (step === SheetStep.Preview && isApiError(err) && err.status === 503) {
        setPreviewBlocked(true);
      } else {
        setServerError(errorMessage(err));
        setStep(SheetStep.Form);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const onPrimary = () => {
    if (submittingRef.current) return;
    // Sem internet: avisa e não envia (feature 005, R-05)
    if (onlineAction.blockIfOffline()) return;
    if (step === SheetStep.Preview) {
      void send();
      return;
    }
    setAttempted(true);
    if (!formValid) return;
    if (needsPreview) {
      const body = transferBody();
      if (!body) return;
      setServerError(null);
      setStep(SheetStep.Preview);
      void loadPreview(body);
      return;
    }
    void send();
  };

  const lookupCode = async () => {
    const id = Number(destination.code);
    if (!destination.code || !Number.isInteger(id) || id <= 0) {
      setDestination((d) => ({ ...d, lookupError: t("transaction.validation.codeInvalid") }));
      return;
    }
    setDestination((d) => ({ ...d, lookingUp: true, lookupError: null, publicWallet: null, confirmed: false }));
    try {
      const publicWallet = await getPublicWallet(id);
      setDestination((d) => ({ ...d, lookingUp: false, publicWallet }));
    } catch (err) {
      const message =
        isApiError(err) && err.status === 404 ? t("transaction.lookupNotFound") : errorMessage(err);
      setDestination((d) => ({ ...d, lookingUp: false, lookupError: message }));
    }
  };

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    setServerError(null);
    setAttempted(false);
  };

  // ---------------------------------------------------------------------------
  // Cabeçalho, título e rodapé por passo
  // ---------------------------------------------------------------------------

  const previewTitle = (() => {
    const type =
      preview?.type ??
      (sourceWallet?.currency === Currency.BRL && resolvedDestination?.currency === Currency.BTC
        ? TransactionType.BtcPurchase
        : sourceWallet?.currency === Currency.BTC && resolvedDestination?.currency === Currency.BRL
          ? TransactionType.BtcSale
          : TransactionType.Transfer);
    if (type === TransactionType.BtcPurchase) return t("transaction.preview.titlePurchase");
    if (type === TransactionType.BtcSale) return t("transaction.preview.titleSale");
    return t("transaction.preview.titleTransfer");
  })();

  let title = t("transaction.title");
  if (step === SheetStep.Form) title = t(`transaction.kind.${kind}`);
  if (step === SheetStep.PickSource) title = t("transaction.pickerTitleSource");
  if (step === SheetStep.PickDestination) title = t("transaction.pickerTitleDestination");
  if (step === SheetStep.Preview) title = previewTitle;

  const backButton = (label: string, target: SheetStep) => (
    <SheetHeaderButton onClick={() => setStep(target)} disabled={submitting}>
      <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={1.75} />
      {label}
    </SheetHeaderButton>
  );

  let leading: ReactNode = undefined;
  if (step === SheetStep.Form) leading = backButton(t("actions.back"), SheetStep.ChooseType);
  if (step === SheetStep.PickSource || step === SheetStep.PickDestination) {
    leading = backButton(t(`transaction.kind.${kind}`), SheetStep.Form);
  }
  if (step === SheetStep.Preview) leading = backButton(t("actions.back"), SheetStep.Form);

  const primaryLabel = (() => {
    if (step === SheetStep.Preview) return previewTitle;
    if (kind === TransactionKind.Income) return t("transaction.submit.income");
    if (kind === TransactionKind.Expense) return t("transaction.submit.expense");
    return needsPreview ? t("transaction.submit.continue") : t("transaction.submit.transfer");
  })();

  const primaryDisabled =
    step === SheetStep.Preview ? previewLoading || previewBlocked || !preview : hasBlockingError;

  const footer =
    step === SheetStep.Form || step === SheetStep.Preview ? (
      <Button
        block
        loading={submitting}
        loadingLabel={t("transaction.submit.sending")}
        disabled={primaryDisabled}
        {...onlineAction.offlineProps}
        onClick={onPrimary}
      >
        {primaryLabel}
      </Button>
    ) : undefined;

  return (
    <Sheet
      ref={contentRef}
      open={open}
      onOpenChange={(next) => {
        if (!next && submittingRef.current) return;
        onOpenChange(next);
      }}
      title={title}
      leading={leading}
      footer={footer}
      dismissible={!submitting}
      busy={submitting}
      tall={step !== SheetStep.ChooseType && step !== SheetStep.Preview}
    >
      {step === SheetStep.ChooseType ? (
        <TypeStep
          onSelect={(selected) => {
            changeKind(selected);
            setStep(SheetStep.Form);
          }}
        />
      ) : null}

      {step === SheetStep.Form ? (
        <FormStep
          kind={kind}
          onKindChange={changeKind}
          sourceWallet={sourceWallet}
          sourceError={sourceError}
          onPickSource={() => setStep(SheetStep.PickSource)}
          destination={destination}
          destinationOwnWallet={destinationOwnWallet}
          resolvedDestination={resolvedDestination}
          destinationError={destinationError}
          onPickDestination={() => setStep(SheetStep.PickDestination)}
          onCodeChange={(code) =>
            setDestination((d) => ({ ...d, code, publicWallet: null, confirmed: false, lookupError: null }))
          }
          onLookup={() => void lookupCode()}
          onConfirmChange={(confirmed) => setDestination((d) => ({ ...d, confirmed }))}
          amountText={amountText}
          onAmountChange={setAmountText}
          amountError={amountError}
          description={description}
          onDescriptionChange={setDescription}
          serverError={serverError}
          describeWallet={describeWallet}
          disabled={submitting}
        />
      ) : null}

      {step === SheetStep.PickSource || step === SheetStep.PickDestination ? (
        <>
          <span id={pickerLabelId} className="sr-only">
            {title}
          </span>
          {step === SheetStep.PickSource ? (
            <WalletPickerStep
              labelId={pickerLabelId}
              wallets={controllable}
              selectedWalletId={sourceWalletId}
              describeWallet={describeWallet}
              onSelect={(walletId) => {
                setSourceWalletId(walletId);
                setStep(SheetStep.Form);
              }}
            />
          ) : (
            <WalletPickerStep
              labelId={pickerLabelId}
              wallets={controllable}
              selectedWalletId={destination.mode === DestinationMode.Own ? destination.walletId : null}
              codeSelected={destination.mode === DestinationMode.Code}
              describeWallet={describeWallet}
              onSelect={(walletId) => {
                setDestination({ ...EMPTY_DESTINATION, mode: DestinationMode.Own, walletId });
                setStep(SheetStep.Form);
              }}
              onChooseCode={() => {
                setDestination((d) =>
                  d.mode === DestinationMode.Code ? d : { ...EMPTY_DESTINATION, mode: DestinationMode.Code },
                );
                setStep(SheetStep.Form);
              }}
            />
          )}
        </>
      ) : null}

      {step === SheetStep.Preview && sourceWallet && resolvedDestination && parsedAmount?.value ? (
        <PreviewStep
          sourceWallet={sourceWallet}
          destination={resolvedDestination}
          amount={parsedAmount.value}
          preview={preview}
          loading={previewLoading}
          blocked={previewBlocked}
        />
      ) : null}
    </Sheet>
  );
};

export default TransactionSheet;
