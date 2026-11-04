import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LargeTitleHeader } from "../components/layout/LargeTitleHeader";
import { readNavState } from "../components/layout/navigation";
import { DestinationPickerStep, FormStep, WalletPickerStep } from "../components/transaction/FormStep";
import { PreviewStep } from "../components/transaction/PreviewStep";
import { SettlementPanel } from "../components/transaction/SettlementPanel";
import { TransferKindPicker } from "../components/transaction/TransferKindPicker";
import { AmountUnit, DESCRIPTION_MAX, FocusReturn, SheetStep } from "../components/transaction/sheetModel";
import type { ResolvedDestination } from "../components/transaction/sheetModel";
import { Button } from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { useBalance } from "../hooks/useBalance";
import { useGroup } from "../hooks/useGroup";
import { OfflineActionKind, useOnlineAction } from "../hooks/useOnlineAction";
import { useQuote } from "../hooks/useQuote";
import { useTransaction } from "../hooks/useTransaction";
import { useWallet } from "../hooks/useWallet";
import { Currency, isApiError, isUnconfirmedWriteError } from "../types/api";
import { DebtDirection } from "../types/debt";
import type { PersonDebtsResult } from "../types/debt";
import { TransactionKind, TransactionType, TransferKind } from "../types/transaction";
import type { TransactionInfo, TransferInfo, TransferPreviewResult } from "../types/transaction";
import type { TransferDestinationsResult, WalletInfo } from "../types/wallet";
import {
  AMOUNT_ERRORS,
  CURRENCY_DECIMALS,
  brlToBtc,
  formatBrl,
  formatMoney,
  formatMoneyFull,
  formatMoneyReadable,
  parseAmountInput,
  parseSatsInput,
} from "../utils/money";
import { QuoteStatus } from "../types/quote";
import { isQuoteUsable } from "../utils/quote";
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

/** Dívidas já carregadas para um titular (feature 007, painel de quitação) */
interface LoadedDebts {
  userId: number;
  result: PersonDebtsResult;
}

/** Valor da confirmação a ser registrado: o BTC calculado no preview, exatamente (SC-005) */
const toAmountString = (value: number): string => {
  const fixed = value.toFixed(CURRENCY_DECIMALS[Currency.BTC]);
  return fixed.replace(/\.?0+$/, "");
};

/** Total da dívida no formato do campo Valor ("100,00", "0,0001") — "Quitar tudo" na mesma moeda */
const toInputText = (value: number, currency: Currency): string => {
  const fixed = value.toFixed(CURRENCY_DECIMALS[currency]);
  const trimmed = currency === Currency.BTC ? fixed.replace(/\.?0+$/, "") : fixed;
  return trimmed.replace(".", ",");
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
  const { createIncome, createExpense, createTransfer, previewTransfer, ledgerVersion } = useTransaction();
  const { getUserDebts } = useBalance();
  const { quote, status: quoteStatus, loading: quoteLoading, loadQuote } = useQuote();
  const pickerLabelId = useId();
  const noDestinationsId = useId();
  const kindLabelId = useId();
  const noDebtId = useId();
  const debtsLoadingId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const kindGroupRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
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
  // Feature 007: tipo da transferência entre pessoas e quitação
  const [transferKind, setTransferKind] = useState<TransferKind | null>(null);
  const [kindErrorShown, setKindErrorShown] = useState(false);
  const [settleAll, setSettleAll] = useState(false);
  const [chosenDebtCurrency, setChosenDebtCurrency] = useState<Currency | null>(null);
  const [debts, setDebts] = useState<LoadedDebts | null>(null);
  const [debtsError, setDebtsError] = useState<unknown>(null);
  const [debtsRetrying, setDebtsRetrying] = useState(false);

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

  // Alternador Bitcoin | Satoshis | Reais: depósito/saque em carteira bitcoin, ou transferência com
  // De e Para em bitcoin; fora disso volta para bitcoin com o valor limpo
  const bothBtc = sourceWallet?.currency === Currency.BTC && destination?.currency === Currency.BTC;
  const showAmountUnit = isTransfer ? bothBtc : sourceWallet?.currency === Currency.BTC;
  const inReais = showAmountUnit && amountUnit === AmountUnit.Brl;
  const inSats = showAmountUnit && amountUnit === AmountUnit.Sat;
  useEffect(() => {
    if (showAmountUnit || amountUnit === AmountUnit.Btc) return;
    setAmountUnit(AmountUnit.Btc);
    setAmountText("");
  }, [showAmountUnit, amountUnit]);

  const changeAmountUnit = (unit: AmountUnit) => {
    // Evita que "200" em reais (ou 200 sats) vire ₿ 200 (components.md §10)
    setAmountUnit(unit);
    setAmountText("");
    setSettleAll(false);
    setServerError(null);
  };

  // ---------------------------------------------------------------------------
  // Tipo da transferência entre pessoas e quitação (feature 007)
  // ---------------------------------------------------------------------------

  /** Seletor "Tipo": só quando o Para é de outro titular (contracts/ui.md) */
  const showKind =
    isTransfer &&
    sourceWallet !== null &&
    destination !== null &&
    !destination.isOwn &&
    destination.walletId !== sourceWallet.walletId;
  const activeKind = showKind ? transferKind : null;
  const isSettlement = activeKind === TransferKind.Settlement;

  // Para do mesmo titular, ou de outro titular diferente do anterior (ou outro De): tipo e erro limpos
  const counterpartKey =
    showKind && sourceWallet && destination ? `${sourceWallet.ownerUserId}:${destination.ownerUserId}` : null;
  useEffect(() => {
    setTransferKind(null);
    setKindErrorShown(false);
    setSettleAll(false);
    setChosenDebtCurrency(null);
  }, [counterpartKey]);

  // Dívidas do titular da origem (R-07); recarregam a cada lançamento gravado
  const debtorUserId = sourceWallet?.ownerUserId ?? null;
  const requestedDebts = useRef<number | null>(null);
  const loadDebts = useCallback(
    async (ownerUserId: number) => {
      requestedDebts.current = ownerUserId;
      setDebtsRetrying(true);
      try {
        const result = await getUserDebts(ownerUserId);
        if (requestedDebts.current !== ownerUserId) return;
        setDebts({ userId: ownerUserId, result });
        setDebtsError(null);
      } catch (err) {
        if (requestedDebts.current !== ownerUserId) return;
        setDebtsError(err);
      } finally {
        if (requestedDebts.current === ownerUserId) setDebtsRetrying(false);
      }
    },
    [getUserDebts],
  );

  useEffect(() => {
    if (!isSettlement || debtorUserId === null) return;
    setDebtsError(null);
    void loadDebts(debtorUserId);
  }, [isSettlement, debtorUserId, loadDebts, ledgerVersion]);

  const currentDebts = isSettlement && debts !== null && debts.userId === debtorUserId ? debts.result : null;
  const debtsLoading = isSettlement && currentDebts === null && !debtsError;
  const walletCurrency = sourceWallet?.currency ?? Currency.BRL;
  const otherCurrency = walletCurrency === Currency.BRL ? Currency.BTC : Currency.BRL;
  // Dívida "titular do De deve ao do Para", por moeda
  const debtIn = (currency: Currency): number | null => {
    if (!currentDebts || !destination) return null;
    const found = currentDebts.debts.find(
      (debt) =>
        debt.counterpartUserId === destination.ownerUserId &&
        debt.direction === DebtDirection.Owes &&
        debt.currency === currency &&
        debt.amount > 0,
    );
    return found ? found.amount : null;
  };
  const debtByCurrency: Record<Currency, number | null> = {
    [Currency.BRL]: debtIn(Currency.BRL),
    [Currency.BTC]: debtIn(Currency.BTC),
  };
  // Sugestão inicial: a moeda das carteiras, se houver dívida nela; senão, a outra
  const suggestedDebtCurrency =
    debtByCurrency[walletCurrency] !== null
      ? walletCurrency
      : debtByCurrency[otherCurrency] !== null
        ? otherCurrency
        : null;
  const debtCurrency =
    chosenDebtCurrency !== null && debtByCurrency[chosenDebtCurrency] !== null
      ? chosenDebtCurrency
      : suggestedDebtCurrency;
  const noDebt = isSettlement && currentDebts !== null && suggestedDebtCurrency === null;
  const settleAllActive = isSettlement && settleAll && debtCurrency !== null;
  // Quitar tudo em outra moeda: o Valor vira "Valor calculado na confirmação"
  const settleCrossCurrency = settleAllActive && debtCurrency !== walletCurrency;

  const changeKind = (next: TransferKind) => {
    setTransferKind(next);
    setKindErrorShown(false);
    if (next !== TransferKind.Settlement) setSettleAll(false);
  };

  /** Digitar no Valor desliga o "quitar tudo" */
  const changeAmount = (text: string) => {
    setSettleAll(false);
    setAmountText(text);
  };

  /** Trocar a moeda da dívida desliga o "quitar tudo" e limpa o valor preenchido por ele */
  const changeDebtCurrency = (currency: Currency) => {
    setChosenDebtCurrency(currency);
    if (settleAll) {
      setSettleAll(false);
      setAmountText("");
    }
  };

  /** "Quitar tudo" é um botão de alternância (components.md §11, divergência 3) */
  const toggleSettleAll = () => {
    setServerError(null);
    if (settleAll) {
      setSettleAll(false);
      setAmountText("");
      // Em outra moeda o Valor era somente leitura: a edição volta para ele
      if (settleCrossCurrency) amountInputRef.current?.focus();
      return;
    }
    if (debtCurrency === null) return;
    const total = debtByCurrency[debtCurrency];
    setSettleAll(true);
    if (debtCurrency !== walletCurrency || total === null) {
      // Outra moeda: o Valor vira "Valor calculado na confirmação" (alternador desabilitado em Bitcoin)
      setAmountUnit(AmountUnit.Btc);
      setAmountText("");
      return;
    }
    // Em satoshis o total vai em sats inteiros e a unidade fica; só "Reais" volta para Bitcoin, porque o
    // total não é um valor em reais (REVIEW-007 M-4)
    if (amountUnit === AmountUnit.Sat && walletCurrency === Currency.BTC) {
      setAmountText(Math.round(total * 1e8).toString());
      return;
    }
    setAmountUnit(AmountUnit.Btc);
    setAmountText(toInputText(total, walletCurrency));
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
  // Depósito/saque em reais numa carteira bitcoin: converte aqui pela cotação atual (trunc. em 8 casas)
  // e registra em bitcoin. A transferência converte no servidor, pela prévia.
  const convertsLocally = inReais && !isTransfer;
  // Ao entrar em "Reais", busca a cotação atual (a página pode ter sido aberta direto pela URL)
  useEffect(() => {
    if (convertsLocally) void loadQuote();
  }, [convertsLocally, loadQuote]);
  const quoteUsable = quote !== null && isQuoteUsable(quoteStatus);
  const localBtc =
    convertsLocally && quote && quoteUsable && parsedAmount?.value ? brlToBtc(parsedAmount.value, quote.priceBrl) : null;
  let conversionError: string | null = null;
  if (convertsLocally && parsedAmount?.value) {
    if (!quoteUsable) {
      // Ainda buscando: sem erro, mas o envio espera a cotação
      if (!quoteLoading && quoteStatus !== QuoteStatus.Loading) conversionError = t("errors.quoteUnavailable");
    }
    else if (!localBtc) conversionError = t("transaction.amountTooSmall");
  }
  const amountConversion =
    localBtc && quote
      ? t("transaction.convertedHint", {
          btc: formatMoneyFull(localBtc, Currency.BTC),
          price: formatBrl(quote.priceBrl),
        })
      : null;
  // "Quitar tudo" dispensa o valor digitado (o servidor calcula; contracts/api.md)
  const amountError = settleAllActive
    ? null
    : sourceWallet && parsedAmount?.error && (amountTyped || attempted)
      ? translateAmountError(parsedAmount.error, amountCurrency)
      : conversionError;
  const kindMissing = showKind && transferKind === null;
  const kindError = kindErrorShown && kindMissing ? t("transaction.validation.kindRequired") : null;
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
    (settleAllActive || Boolean(parsedAmount?.value)) &&
    (!convertsLocally || localBtc !== null) &&
    descriptionValid &&
    // O destino precisa estar na lista da origem atual (trocar o De recarrega o Para)
    (!isTransfer || (destination !== null && currentDestinations !== null && !destinationBlocking)) &&
    // Entre pessoas o tipo é obrigatório; quitação sem dívida não segue (feature 007)
    !kindMissing &&
    !noDebt;

  const needsPreview =
    isTransfer &&
    sourceWallet !== null &&
    destination !== null &&
    (destination.currency !== sourceWallet.currency || !destination.isOwn || inReais);

  const hasBlockingError =
    Boolean(!settleAllActive && amountTyped && parsedAmount?.error) ||
    Boolean(conversionError) ||
    destinationBlocking;

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------

  /**
   * Corpo da prévia: em reais manda `amountBrl`; senão `amount` na moeda da origem. Entre pessoas vai o
   * `kind`; na quitação, `debtCurrency` e, com "quitar tudo", `settleAll` sem valor (feature 007).
   */
  const previewBody = (): TransferInfo | null => {
    if (!sourceWallet || !destination) return null;
    const base: TransferInfo = {
      sourceWalletId: sourceWallet.walletId,
      destinationWalletId: destination.walletId,
      description: description.trim() || null,
    };
    if (activeKind) {
      base.kind = activeKind;
      if (activeKind === TransferKind.Settlement) base.debtCurrency = debtCurrency ?? sourceWallet.currency;
    }
    if (settleAllActive) return { ...base, settleAll: true };
    if (!parsedAmount?.value) return null;
    return inReais ? { ...base, amountBrl: parsedAmount.value } : { ...base, amount: parsedAmount.value };
  };

  /**
   * Corpo do registro: em reais, o `amount` é o BTC confirmado na prévia (R-07); "quitar tudo" reenvia
   * o mesmo corpo da prévia (o servidor recalcula a dívida dentro do lock).
   */
  const transferBody = (): TransferInfo | null => {
    const body = previewBody();
    if (!body) return null;
    if (!inReais || body.settleAll) return body;
    if (!preview) return null;
    const registered: TransferInfo = { ...body, amount: toAmountString(preview.sourceAmount) };
    delete registered.amountBrl;
    return registered;
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
      default: {
        // Entre pessoas: "Empréstimo de R$ 100,00 para Bruno registrado." (feature 007)
        const sentKind = result.transferKind ?? activeKind;
        if (result.type === TransactionType.Transfer && sentKind && destination) {
          return t(`transaction.success.${sentKind}`, {
            // BTC pequeno: 8 casas quando 5 zerariam ("₿ 0,00000500", REVIEW-007 M-5)
            amount: formatMoneyReadable(result.sourceAmount, result.source.currency),
            name: destination.ownerFirstName,
          });
        }
        return t("transaction.success.transfer", {
          amount: formatMoney(result.sourceAmount, result.source.currency),
          wallet: result.destination.name,
        });
      }
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
    if (submittingRef.current || !sourceWallet) return;
    // "Quitar tudo" não tem valor digitado (feature 007)
    if (!settleAllActive && !parsedAmount?.value) return;
    submittingRef.current = true;
    setSubmitting(true);
    setServerError(null);
    try {
      let result: TransactionInfo;
      const descriptionValue = description.trim() || null;
      // Em reais (depósito/saque em bitcoin) vai o BTC convertido e exibido junto ao campo
      const amountValue = convertsLocally ? localBtc : (parsedAmount?.value ?? null);
      if (kind === TransactionKind.Income) {
        if (!amountValue) return;
        result = await createIncome({
          walletId: sourceWallet.walletId,
          amount: amountValue,
          description: descriptionValue,
        });
      } else if (kind === TransactionKind.Expense) {
        if (!amountValue) return;
        result = await createExpense({
          walletId: sourceWallet.walletId,
          amount: amountValue,
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
    // Quitação sem dívida (ou com as dívidas ainda carregando): idem, com o aviso / "Carregando…" (feature 007)
    if (step === SheetStep.Form && (noDestinations || noDebt || debtsLoading)) return;
    // Sem internet: avisa e não envia (feature 005, R-05)
    if (onlineAction.blockIfOffline()) return;
    if (step === SheetStep.Preview) {
      void send();
      return;
    }
    setAttempted(true);
    if (kindMissing) {
      // Erro junto ao grupo e foco na parada de Tab dele (o Tipo vem antes do Valor na tela)
      setKindErrorShown(true);
      kindGroupRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus();
    }
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
      if (previewType !== TransactionType.Transfer) return previewTitle;
      // Entre pessoas: "Registrar empréstimo/quitação/pagamento" (feature 007)
      const shownKind = preview?.kind ?? activeKind;
      return shownKind ? t(`transaction.submit.${shownKind}`) : t("transaction.submit.transfer");
    }
    if (kind === TransactionKind.Income) return t("transaction.submit.income");
    if (kind === TransactionKind.Expense) return t("transaction.submit.expense");
    // Sem destinos o próximo passo seria escolher o Para: "Continuar" (components.md §10)
    return needsPreview || noDestinations ? t("transaction.submit.continue") : t("transaction.submit.transfer");
  })();

  // Sem destinos: `aria-disabled` em vez de `disabled` — o botão continua na ordem de Tab e a explicação
  // (`aria-describedby` → aviso) é lida ao chegar nele pelo teclado (REVIEW-006 M-1)
  const noDestinationsBlocked = step === SheetStep.Form && noDestinations;
  // Quitação sem dívida: mesmo padrão, com o aviso do painel (components.md §11)
  const noDebtBlocked = step === SheetStep.Form && noDebt;
  // Dívidas carregando: não segue como Quitação antes de o painel resolver a moeda (REVIEW-007 M-3)
  const debtsLoadingBlocked = step === SheetStep.Form && debtsLoading;
  const formAriaBlocked = noDestinationsBlocked || noDebtBlocked || debtsLoadingBlocked;
  const primaryDisabled =
    step === SheetStep.Preview
      ? previewLoading || previewBlocked || !preview
      : hasBlockingError && !formAriaBlocked;
  const primaryDescribedBy = noDestinationsBlocked
    ? noDestinationsId
    : noDebtBlocked
      ? noDebtId
      : debtsLoadingBlocked
        ? debtsLoadingId
        : undefined;
  // Foco ao voltar para o formulário: "Continuar" vindo da prévia; sem destinos, o Para não existe e o
  // foco que iria para ele fica no botão (que explica o porquê). "Informar em bitcoin" tem prioridade.
  const primaryAutofocus =
    step === SheetStep.Form &&
    !focusAmount &&
    (returnFocus === FocusReturn.Primary || (returnFocus === FocusReturn.Destination && noDestinations));

  // Bloco "Tipo" entre Para e Valor, com o painel de quitação dentro dele (components.md §11)
  const kindSlot =
    showKind && sourceWallet && destination ? (
      <TransferKindPicker
        labelId={kindLabelId}
        value={transferKind}
        onChange={changeKind}
        sourceOwnerName={sourceWallet.ownerFirstName}
        destinationOwnerName={destination.ownerFirstName}
        error={kindError}
        disabled={submitting}
        groupRef={kindGroupRef}
      >
        {isSettlement ? (
          <SettlementPanel
            loading={debtsLoading}
            loadingId={debtsLoadingId}
            error={currentDebts === null ? debtsError : null}
            retrying={debtsRetrying}
            onRetry={() => {
              if (debtorUserId !== null) void loadDebts(debtorUserId);
            }}
            debtorName={sourceWallet.ownerFirstName}
            debtorIsMe={sourceWallet.ownerUserId === userId}
            creditorName={destination.ownerFirstName}
            walletCurrency={walletCurrency}
            debtByCurrency={debtByCurrency}
            debtCurrency={debtCurrency}
            onDebtCurrencyChange={changeDebtCurrency}
            settleAll={settleAllActive}
            onToggleSettleAll={toggleSettleAll}
            noDebtId={noDebtId}
            disabled={submitting}
          />
        ) : null}
      </TransferKindPicker>
    ) : null;

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
            onAmountChange={changeAmount}
            amountError={amountError}
            showAmountUnit={showAmountUnit}
            amountConversion={amountConversion}
            amountUnit={amountUnit}
            onAmountUnitChange={changeAmountUnit}
            focusAmount={focusAmount}
            returnFocusTo={returnFocus}
            description={description}
            onDescriptionChange={setDescription}
            serverError={serverError}
            disabled={submitting}
            kindSlot={kindSlot}
            amountReadOnlyText={settleCrossCurrency ? t("transaction.settlement.computedOnPreview") : undefined}
            amountUnitDisabled={settleCrossCurrency}
            amountInputRef={amountInputRef}
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

        {step === SheetStep.Preview && sourceWallet && destination && (settleAllActive || parsedAmount?.value) ? (
          <PreviewStep
            sourceWallet={sourceWallet}
            destination={destination}
            // "Quitar tudo": o valor vem da prévia (calculado no servidor)
            amount={settleAllActive || inReais ? null : (parsedAmount?.value ?? null)}
            amountBrl={!settleAllActive && inReais ? (parsedAmount?.value ?? null) : null}
            preview={preview}
            loading={previewLoading}
            blocked={previewBlocked}
            onEnterInBtc={enterInBtc}
            kind={activeKind}
          />
        ) : null}

        {step === SheetStep.Form || step === SheetStep.Preview ? (
          <div className="mt-6">
            <Button
              block
              loading={submitting}
              loadingLabel={t("transaction.submit.sending")}
              disabled={primaryDisabled}
              aria-disabled={formAriaBlocked || undefined}
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
