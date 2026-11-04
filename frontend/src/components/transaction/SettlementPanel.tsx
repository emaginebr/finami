import { useId } from "react";
import { Check, Info, WifiOff } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Currency, isOfflineError } from "../../types/api";
import { formatMoneyReadable } from "../../utils/money";
import { errorMessage } from "../../utils/notify";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { RetryBanner } from "../ui/RetryBanner";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Skeleton } from "../ui/Skeleton";

/** Ordem fixa do grupo "Quitar dívida em" (BRL antes de BTC, components.md §10) */
const DEBT_CURRENCIES: Currency[] = [Currency.BRL, Currency.BTC];

export interface SettlementPanelProps {
  /** Dívidas ainda carregando */
  loading: boolean;
  /** `id` do "Carregando…" do esqueleto (o Continuar aponta para ele enquanto carrega, REVIEW-007 M-3) */
  loadingId: string;
  /** Erro ao carregar as dívidas (`null` sem erro) */
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  /** Primeiro nome do titular do De e se é a pessoa logada ("Você deve…") */
  debtorName: string;
  debtorIsMe: boolean;
  /** Primeiro nome do titular do Para (credor) */
  creditorName: string;
  /** Moeda das carteiras De/Para */
  walletCurrency: Currency;
  /** Dívida do titular do De com o do Para, por moeda (`null` = sem dívida nessa moeda) */
  debtByCurrency: Record<Currency, number | null>;
  /** Moeda da dívida escolhida (já resolvida pela sugestão inicial) */
  debtCurrency: Currency | null;
  onDebtCurrencyChange: (currency: Currency) => void;
  settleAll: boolean;
  onToggleSettleAll: () => void;
  /** `id` do aviso "sem dívida" (o Continuar aponta para ele com `aria-describedby`) */
  noDebtId: string;
  disabled?: boolean;
}

/**
 * Painel de quitação (components.md §11): dívida atual do titular do De com o do Para, escolha da
 * moeda da dívida (quando há dívida na outra moeda), nota de conversão e "Quitar tudo".
 */
export const SettlementPanel = ({
  loading,
  loadingId,
  error,
  retrying,
  onRetry,
  debtorName,
  debtorIsMe,
  creditorName,
  walletCurrency,
  debtByCurrency,
  debtCurrency,
  onDebtCurrencyChange,
  settleAll,
  onToggleSettleAll,
  noDebtId,
  disabled = false,
}: SettlementPanelProps) => {
  const { t } = useTranslation();
  const currencyLabelId = useId();
  const noteId = useId();
  const debtTextId = useId();

  if (error && !loading) {
    if (isOfflineError(error)) {
      return (
        <Banner tone="warning" role="alert" icon={WifiOff} className="mt-1.5">
          {t("pwa.offline.contentUnavailable")}
        </Banner>
      );
    }
    return (
      <RetryBanner retryLabel={t("pwa.offline.retry")} retrying={retrying} onRetry={onRetry} className="mt-1.5">
        {errorMessage(error)}
      </RetryBanner>
    );
  }

  if (loading) {
    return (
      // `<div>`, não `<section>` com nome: não vira um landmark "Tipo" (REVIEW-007 M-1)
      <div aria-busy="true" className="mt-1.5 overflow-hidden rounded-lg bg-surface">
        <span id={loadingId} className="sr-only" role="status">
          {t("app.loading")}
        </span>
        <div aria-hidden="true" className="flex min-h-15 items-center justify-between gap-3 px-4 py-2">
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-11 w-28" rounded="rounded-md" />
        </div>
      </div>
    );
  }

  const otherCurrency = walletCurrency === Currency.BRL ? Currency.BTC : Currency.BRL;
  const hasOther = debtByCurrency[otherCurrency] !== null;
  const currentAmount = debtCurrency !== null ? debtByCurrency[debtCurrency] : null;

  if (debtCurrency === null || currentAmount === null) {
    return (
      <div id={noDebtId} className="mt-1.5">
        <Banner tone="info" role="status">
          <span className="text-text">
            {debtorIsMe
              ? t("transaction.settlement.noDebt", { name: creditorName })
              : t("transaction.settlement.noDebtOther", { debtor: debtorName, name: creditorName })}
          </span>
        </Banner>
      </div>
    );
  }

  const converted = debtCurrency !== walletCurrency;
  const amountText = formatMoneyReadable(currentAmount, debtCurrency);

  return (
    <div className="mt-1.5 overflow-hidden rounded-lg bg-surface">
      {hasOther ? (
        <div className="flex flex-col gap-2 border-b-[0.5px] border-separator px-4 pt-3 pb-3">
          <span
            id={currencyLabelId}
            className="text-footnote font-semibold tracking-wide text-text-muted uppercase"
          >
            {t("transaction.settlement.debtCurrency")}
          </span>
          <SegmentedControl
            ariaLabelledBy={currencyLabelId}
            ariaDescribedBy={converted ? noteId : undefined}
            disabled={disabled}
            value={debtCurrency}
            onChange={onDebtCurrencyChange}
            options={DEBT_CURRENCIES.map((currency) => {
              // Sem dívida nessa moeda: visível, mas inativa (components.md §11, divergência 5), com o motivo
              // no nome acessível — "Bitcoin, sem dívida" começa pelo texto visível (REVIEW-007 M-2, 2.5.3)
              const noDebtIn = debtByCurrency[currency] === null;
              return {
                value: currency,
                label: t(`currency.${currency}`),
                ariaLabel: noDebtIn
                  ? t("transaction.settlement.noDebtIn", { currency: t(`currency.${currency}`) })
                  : undefined,
                disabled: noDebtIn,
              };
            })}
          />
          {converted ? (
            <p id={noteId} className="m-0 flex items-start gap-1.5 text-footnote text-text-muted">
              <Info aria-hidden="true" className="mt-px size-4 shrink-0 text-info" />
              {t("transaction.settlement.convertedNote")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
        <p id={debtTextId} aria-live="polite" className="m-0 min-w-[10rem] flex-1 text-body break-words text-text">
          <Trans
            i18nKey={debtorIsMe ? "transaction.settlement.youOwe" : "transaction.settlement.owes"}
            values={{ amount: amountText, name: creditorName, debtor: debtorName }}
            components={{ b: <span className="font-semibold whitespace-nowrap tabular-nums" /> }}
          />
        </p>
        <Button
          variant="secondary"
          size="sm"
          pressed={settleAll}
          aria-describedby={debtTextId}
          disabled={disabled}
          onClick={onToggleSettleAll}
          icon={settleAll ? <Check className="size-4" strokeWidth={2.5} /> : undefined}
          className="ml-auto shrink-0"
        >
          {t("transaction.settlement.settleAll")}
        </Button>
      </div>
    </div>
  );
};

export default SettlementPanel;
