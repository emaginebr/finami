import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LargeTitleHeader } from "../components/layout/LargeTitleHeader";
import { readNavState } from "../components/layout/navigation";
import { DestinationPickerStep, FormStep, WalletPickerStep } from "../components/transaction/FormStep";
import { PreviewStep } from "../components/transaction/PreviewStep";
import { AmountUnit, DESCRIPTION_MAX, FocusReturn, SheetStep } from "../components/transaction/sheetModel";
import type { ResolvedDestination } from "../components/transaction/sheetModel";
import { Button } from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { useGroup } from "../hooks/useGroup";
import { OfflineActionKind, useOnlineAction } from "../hooks/useOnlineAction";
import { useTransaction } from "../hooks/useTransaction";
import { useWallet } from "../hooks/useWallet";
import { Currency, isApiError, isUnconfirmedWriteError } from "../types/api";
import { TransactionKind, TransactionType } from "../types/transaction";
import type { TransactionInfo, TransferInfo, TransferPreviewResult } from "../types/transaction";
import type { TransferDestinationsResult, WalletInfo } from "../types/wallet";
import { AMOUNT_ERRORS, CURRENCY_DECIMALS, formatMoney, parseAmountInput, parseSatsInput } from "../utils/money";
import { errorMessage, notifySuccess } from "../utils/notify";
import { WALLET_PARAM } from "../utils/transactionRoutes";
import { groupWallets } from "../utils/walletGrouping";

export interface TransactionPageProps {
  kind: TransactionKind;
}

/** Lista do campo Para já carregada para uma origem */
interface LoadedDestinations {
  sourceWalletId: number;
  result: TransferDestinationsResult;
}

/** Valor da confirmação a ser registrado: o BTC calculado no preview, exatamente (SC-005) */
const toAmountString = (value: number): string => {
  const fixed = value.toFixed(CURRENCY_DECIMALS[Currency.BTC]);
  return fixed.replace(/\.?0+$/, "");
};

/**
 * Página de lançamento (`/depositar`, `/sacar`, `/transferir`) — data-model §6:
 * formulário → (seletor de carteira) → (prévia) → envio → toast.
 * A prévia é obrigatória quando as moedas diferem, o destino é de outra pessoa ou o valor de
 * bitcoin foi informado em reais (feature 006: preview com `amountBrl`, registro com o BTC dele).
 */
const TransactionPage = ({ kind }: TransactionPageProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = readNavState(location.state);
  const [searchParams] = useSearchParams();
  const paramWalletId = Number(searchParams.get(WALLET_PARAM));
  const defaultWalletId = Number.isInteger(paramWalletId) && paramWalletId > 0 ? paramWalletId : null;

  const { session } = useAuth();
  const { wallets, loaded, loading: walletsLoading, loadWallets, getTransferDestinations } = useWallet();
  const { groups, loadGroups } = useGroup();
  const { createIncome, createExpense, createTransfer, previewTransfer } = useTransaction();
  const pickerLabelId = useId();
  const noDestinationsId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const onlineAction = useOnlineAction(OfflineActionKind.Transaction);

  /** Depois de registrar: volta para a tela de origem; aberta direto, vai para a Home */
  const finish = () => {
    if (navState.backTo) navigate(-1);
    else navigate("/", { replace: true });
  };

  const [step, setStep] = useState<SheetStep>(SheetStep.Form);
  const [sourceWalletId, setSourceWalletId] = useState<number | null>(defaultWalletId);
  const [destination, setDestination] = useState<ResolvedDestination | null>(null);
  const [destinations, setDestinations] = useState<LoadedDestinations | null>(null);
  const [destinationsError, setDestinationsError] = useState<unknown>(null);
  const [destinationsRetrying, setDestinationsRetrying] = useState(false);
  const [amountUnit, setAmountUnit] = useState<AmountUnit>(AmountUnit.Btc);
  const [focusAmount, setFocusAmount] = useState(false);
  /** Para onde o foco volta quando o passo retorna ao formulário (REVIEW-006 I-1) */
  const [returnFocus, setReturnFocus] = useState<FocusReturn | null>(null);
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

  // Garante carteiras e famílias (a página pode abrir direto pela URL)
  useEffect(() => {
    if (!loaded && !walletsLoading) loadWallets().catch(() => undefined);
    if (groups.length === 0) loadGroups().catch(() => undefined);
    // Só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pré-seleciona a carteira do endereço; sem ela, a primeira da pessoa (ou a primeira da lista)
  const userId = session?.user.userId ?? null;
  useEffect(() => {
    if (sourceWalletId !== null && controllable.some((w) => w.walletId === sourceWalletId)) return;
    const preferred =
      controllable.find((w) => w.walletId === defaultWalletId) ??
      controllable.find((w) => w.ownerUserId === userId) ??
      controllable[0];
    if (preferred) setSourceWalletId(preferred.walletId);
  }, [controllable, defaultWalletId, sourceWalletId, userId]);

  // Ao trocar de passo (não na abertura), o foco vai para o elemento com data-autofocus
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const target = contentRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    target?.focus();
  }, [step]);

  const sourceWallet = controllable.find((w) => w.walletId === sourceWalletId) ?? null;
  const sourceId = sourceWallet?.walletId ?? null;
  const isTransfer = kind === TransactionKind.Transfer;

  // ---------------------------------------------------------------------------
  // Campo Para: destinos da origem escolhida (família e conversão)
  // ---------------------------------------------------------------------------

  /** Última origem pedida: respostas de origens anteriores são descartadas */
  const requestedSource = useRef<number | null>(null);

  const loadDestinations = useCallback(
    async (walletId: number) => {
      requestedSource.current = walletId;
      setDestinationsRetrying(true);
      try {
        const result = await getTransferDestinations(walletId);
        if (requestedSource.current !== walletId) return;
        setDestinations({ sourceWalletId: walletId, result });
        setDestinationsError(null);
      } catch (err) {
        if (requestedSource.current !== walletId) return;
        setDestinationsError(err);
      } finally {
        if (requestedSource.current === walletId) setDestinationsRetrying(false);
      }
    },
    [getTransferDestinations],
  );

  useEffect(() => {
    if (!isTransfer || sourceId === null) return;
    setDestinationsError(null);
    void loadDestinations(sourceId);
  }, [isTransfer, sourceId, loadDestinations]);

  const currentDestinations =
    destinations !== null && destinations.sourceWalletId === sourceId ? destinations.result : null;
  const noDestinations =
    currentDestinations !== null &&
    currentDestinations.sameCurrency.length === 0 &&
    currentDestinations.conversion.length === 0;

  // Trocou o De: o destino que deixou de valer é limpo (FR-019)
  useEffect(() => {
    if (!destination) return;
    if (sourceId !== null && destination.walletId === sourceId) {
      setDestination(null);
      return;
    }
    if (!currentDestinations) return;
    const stillValid = [...currentDestinations.sameCurrency, ...currentDestinations.conversion].find(
      (item) => item.walletId === destination.walletId,
    );
    if (!stillValid) setDestination(null);
    else if (stillValid !== destination && stillValid.balance !== destination.balance) {
      setDestination({ ...stillValid });
    }
  }, [currentDestinations, destination, sourceId]);

  // Valor em reais só com De e Para em bitcoin; fora disso volta para bitcoin com o valor limpo
  const bothBtc = sourceWallet?.currency === Currency.BTC && destination?.currency === Currency.BTC;
  const inReais = isTransfer && bothBtc && amountUnit === AmountUnit.Brl;
  const inSats = isTransfer && bothBtc && amountUnit === AmountUnit.Sat;
  useEffect(() => {
    if (bothBtc || amountUnit === AmountUnit.Btc) return;
    setAmountUnit(AmountUnit.Btc);
    setAmountText("");
  }, [bothBtc, amountUnit]);

  const changeAmountUnit = (unit: AmountUnit) => {
    // Evita que "200" em reais (ou 200 sats) vire ₿ 200 (components.md §10)
    setAmountUnit(unit);
    setAmountText("");
    setServerError(null);
  };

  // ---------------------------------------------------------------------------
  // Validação (data-model §6)
  // ---------------------------------------------------------------------------

  const amountCurrency = inReais ? Currency.BRL : (sourceWallet?.currency ?? Currency.BRL);
  // Em satoshis o texto vira BTC com 8 casas (`parsedAmount.value` é sempre na moeda da origem ou em reais)
  const parsedAmount = sourceWallet
    ? inSats
      ? parseSatsInput(amountText)
      : parseAmountInput(amountText, amountCurrency)
    : null;
  const amountTyped = amountText.trim().length > 0;
  const translateAmountError = (error: string, currency: Currency): string => {
    if (error === AMOUNT_ERRORS.required) return t("transaction.amountErrors.required");
    if (error === AMOUNT_ERRORS.invalid) return t("transaction.amountErrors.invalid");
    if (error === AMOUNT_ERRORS.notPositive) return t("transaction.amountErrors.notPositive");
    if (error === AMOUNT_ERRORS.satsInteger) return t("transaction.amountErrors.satsInteger");
    if (error === AMOUNT_ERRORS.tooManyDecimals(CURRENCY_DECIMALS[currency])) {
      return t(`transaction.amountErrors.tooManyDecimals${currency}`);
    }
    return error;
  };
  const amountError =
    sourceWallet && parsedAmount?.error && (amountTyped || attempted)
      ? translateAmountError(parsedAmount.error, amountCurrency)
      : null;
  const sourceError = !sourceWallet && attempted ? t("transaction.validation.walletRequired") : null;

  let destinationError: string | null = null;
  let destinationBlocking = false;
  if (isTransfer) {
    if (destination && sourceWallet && destination.walletId === sourceWallet.walletId) {
      destinationError = t("transaction.validation.sameWallet");
      destinationBlocking = true;
    } else if (noDestinations) {
      destinationBlocking = true;
    } else if (!destination && attempted) {
      destinationError = t("transaction.validation.destinationRequired");
    }
  }

  const descriptionValid = description.length <= DESCRIPTION_MAX;
  const formValid =
    Boolean(sourceWallet) &&
    Boolean(parsedAmount?.value) &&
    descriptionValid &&
    // O destino precisa estar na lista da origem atual (trocar o De recarrega o Para)
    (!isTransfer || (destination !== null && currentDestinations !== null && !destinationBlocking));

  const needsPreview =
    isTransfer &&
    sourceWallet !== null &&
    destination !== null &&
    (destination.currency !== sourceWallet.currency || !destination.isOwn || inReais);

  const hasBlockingError = Boolean(amountTyped && parsedAmount?.error) || destinationBlocking;

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------

  /** Corpo da prévia: em reais manda `amountBrl`; senão `amount` na moeda da origem */
  const previewBody = (): TransferInfo | null => {
    if (!sourceWallet || !destination || !parsedAmount?.value) return null;
    const base = {
      sourceWalletId: sourceWallet.walletId,
      destinationWalletId: destination.walletId,
      description: description.trim() || null,
    };
    return inReais ? { ...base, amountBrl: parsedAmount.value } : { ...base, amount: parsedAmount.value };
  };

  /** Corpo do registro: em reais, o `amount` é o BTC confirmado na prévia (R-07) */
  const transferBody = (): TransferInfo | null => {
    const body = previewBody();
    if (!body) return null;
    if (!inReais) return body;
    if (!preview) return null;
    return {
      sourceWalletId: body.sourceWalletId,
      destinationWalletId: body.destinationWalletId,
      amount: toAmountString(preview.sourceAmount),
      description: body.description,
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
      finish();
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
    // Sem destinos: o botão fica `aria-disabled` (focável, com a explicação) e não faz nada (M-1)
    if (step === SheetStep.Form && noDestinations) return;
    // Sem internet: avisa e não envia (feature 005, R-05)
    if (onlineAction.blockIfOffline()) return;
    if (step === SheetStep.Preview) {
      void send();
      return;
    }
    setAttempted(true);
    if (!formValid) return;
    if (needsPreview) {
      const body = previewBody();
      if (!body) return;
      setServerError(null);
      setFocusAmount(false);
      // Voltar da prévia (ou erro dela) devolve o foco ao "Continuar"
      setReturnFocus(FocusReturn.Primary);
      setStep(SheetStep.Preview);
      void loadPreview(body);
      return;
    }
    void send();
  };

  /** Cotação indisponível no modo "Reais": volta ao formulário em bitcoin, valor limpo, foco no Valor */
  const enterInBtc = () => {
    setAmountUnit(AmountUnit.Btc);
    setAmountText("");
    setPreview(null);
    setPreviewBlocked(false);
    setFocusAmount(true);
    setStep(SheetStep.Form);
  };

  const goBackToForm = () => {
    setFocusAmount(false);
    setStep(SheetStep.Form);
  };

  // ---------------------------------------------------------------------------
  // Título, voltar e botão principal por passo
  // ---------------------------------------------------------------------------

  const previewType =
    preview?.type ??
    (sourceWallet?.currency === Currency.BRL && destination?.currency === Currency.BTC
      ? TransactionType.BtcPurchase
      : sourceWallet?.currency === Currency.BTC && destination?.currency === Currency.BRL
        ? TransactionType.BtcSale
        : TransactionType.Transfer);
  const previewTitle = (() => {
    if (previewType === TransactionType.BtcPurchase) return t("transaction.preview.titlePurchase");
    if (previewType === TransactionType.BtcSale) return t("transaction.preview.titleSale");
    return t("transaction.preview.titleTransfer");
  })();

  let stepTitle: string | null = null;
  if (step === SheetStep.PickSource) stepTitle = t("transaction.pickerTitleSource");
  if (step === SheetStep.PickDestination) stepTitle = t("transaction.pickerTitleDestination");
  if (step === SheetStep.Preview) stepTitle = previewTitle;

  const primaryLabel = (() => {
    // Confirmação de transferência: "Registrar transferência"; compra/venda: "Confirmar compra/venda"
    if (step === SheetStep.Preview) {
      return previewType === TransactionType.Transfer ? t("transaction.submit.transfer") : previewTitle;
    }
    if (kind === TransactionKind.Income) return t("transaction.submit.income");
    if (kind === TransactionKind.Expense) return t("transaction.submit.expense");
    // Sem destinos o próximo passo seria escolher o Para: "Continuar" (components.md §10)
    return needsPreview || noDestinations ? t("transaction.submit.continue") : t("transaction.submit.transfer");
  })();

  // Sem destinos: `aria-disabled` em vez de `disabled` — o botão continua na ordem de Tab e a explicação
  // (`aria-describedby` → aviso) é lida ao chegar nele pelo teclado (REVIEW-006 M-1)
  const noDestinationsBlocked = step === SheetStep.Form && noDestinations;
  const primaryDisabled =
    step === SheetStep.Preview
      ? previewLoading || previewBlocked || !preview
      : hasBlockingError && !noDestinationsBlocked;
  const primaryDescribedBy = noDestinationsBlocked ? noDestinationsId : undefined;
  // Foco ao voltar para o formulário: "Continuar" vindo da prévia; sem destinos, o Para não existe e o
  // foco que iria para ele fica no botão (que explica o porquê). "Informar em bitcoin" tem prioridade.
  const primaryAutofocus =
    step === SheetStep.Form &&
    !focusAmount &&
    (returnFocus === FocusReturn.Primary || (returnFocus === FocusReturn.Destination && noDestinations));

  return (
    <>
      <LargeTitleHeader
        title={t(`transaction.page.${kind}`)}
        backTo={navState.backTo}
        backLabel={navState.backLabel}
      />

      <div ref={contentRef} aria-busy={submitting || undefined}>
        {stepTitle ? (
          <div className="-mx-2 mb-3 flex min-h-touch items-center gap-1">
            <button
              type="button"
              onClick={goBackToForm}
              disabled={submitting}
              className="inline-flex min-h-touch min-w-touch items-center gap-0.5 pr-2 text-body text-accent disabled:text-text-disabled"
            >
              <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={1.75} />
              {t("actions.back")}
            </button>
            {/* Na prévia o foco vai para o título do passo; o leitor segue dele para os valores (I-1) */}
            <h2
              id={pickerLabelId}
              tabIndex={step === SheetStep.Preview ? -1 : undefined}
              data-autofocus={step === SheetStep.Preview ? "" : undefined}
              className="m-0 text-headline outline-none"
            >
              {stepTitle}
            </h2>
          </div>
        ) : null}

        {step === SheetStep.Form ? (
          <FormStep
            kind={kind}
            sourceWallet={sourceWallet}
            sourceError={sourceError}
            onPickSource={() => {
              setFocusAmount(false);
              setReturnFocus(FocusReturn.Source);
              setStep(SheetStep.PickSource);
            }}
            destination={destination}
            destinationError={destinationError}
            onPickDestination={() => {
              setFocusAmount(false);
              setReturnFocus(FocusReturn.Destination);
              setStep(SheetStep.PickDestination);
            }}
            noDestinations={noDestinations}
            noDestinationsId={noDestinationsId}
            amountText={amountText}
            onAmountChange={setAmountText}
            amountError={amountError}
            showAmountUnit={isTransfer && bothBtc}
            amountUnit={amountUnit}
            onAmountUnitChange={changeAmountUnit}
            focusAmount={focusAmount}
            returnFocusTo={returnFocus}
            description={description}
            onDescriptionChange={setDescription}
            serverError={serverError}
            disabled={submitting}
          />
        ) : null}

        {step === SheetStep.PickSource ? (
          <WalletPickerStep
            labelId={pickerLabelId}
            wallets={controllable}
            selectedWalletId={sourceWalletId}
            onSelect={(walletId) => {
              setSourceWalletId(walletId);
              setStep(SheetStep.Form);
            }}
          />
        ) : null}

        {step === SheetStep.PickDestination ? (
          <DestinationPickerStep
            labelId={pickerLabelId}
            destinations={currentDestinations}
            error={destinationsError}
            retrying={destinationsRetrying}
            onRetry={() => {
              if (sourceId !== null) void loadDestinations(sourceId);
            }}
            selectedWalletId={destination?.walletId ?? null}
            onSelect={(walletId) => {
              const chosen = currentDestinations
                ? [...currentDestinations.sameCurrency, ...currentDestinations.conversion].find(
                    (item) => item.walletId === walletId,
                  )
                : undefined;
              if (chosen) setDestination({ ...chosen });
              setStep(SheetStep.Form);
            }}
          />
        ) : null}

        {step === SheetStep.Preview && sourceWallet && destination && parsedAmount?.value ? (
          <PreviewStep
            sourceWallet={sourceWallet}
            destination={destination}
            amount={inReais ? null : parsedAmount.value}
            amountBrl={inReais ? parsedAmount.value : null}
            preview={preview}
            loading={previewLoading}
            blocked={previewBlocked}
            onEnterInBtc={enterInBtc}
          />
        ) : null}

        {step === SheetStep.Form || step === SheetStep.Preview ? (
          <div className="mt-6">
            <Button
              block
              loading={submitting}
              loadingLabel={t("transaction.submit.sending")}
              disabled={primaryDisabled}
              aria-disabled={noDestinationsBlocked || undefined}
              aria-describedby={primaryDescribedBy}
              data-autofocus={primaryAutofocus ? "" : undefined}
              {...onlineAction.offlineProps}
              onClick={onPrimary}
            >
              {primaryLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
};

export default TransactionPage;
