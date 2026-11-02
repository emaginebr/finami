import { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OfflineActionKind, useOnlineAction } from "../../hooks/useOnlineAction";
import { useTransaction } from "../../hooks/useTransaction";
import { isUnconfirmedWriteError } from "../../types/api";
import { TransactionType } from "../../types/transaction";
import type { TransactionInfo } from "../../types/transaction";
import type { StatementEntryInfo } from "../../types/statement";
import { cn } from "../../utils/cn";
import { formatDate, formatDateTime } from "../../utils/dates";
import { formatBrl, formatMoney, formatSigned } from "../../utils/money";
import { errorMessage, notifyError, notifyErrorMessage, notifySuccess } from "../../utils/notify";
import { Badge } from "../ui/Badge";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { Sheet, SheetHeaderButton } from "../ui/Sheet";
import { Skeleton } from "../ui/Skeleton";
import { transactionVisual } from "./transactionVisuals";

export interface TransactionDetailSheetProps {
  /** Lançamento aberto; `null` = folha fechada */
  entry: StatementEntryInfo | null;
  onClose: () => void;
  /** A pessoa controla a carteira do extrato (pode estornar) */
  canControl: boolean;
}

/**
 * Detalhe do lançamento (mockup wallet-statement.html): busca `GET /api/transactions/{id}`
 * ao abrir e oferece "Estornar" quando a pessoa controla a carteira e o lançamento
 * não foi estornado nem é um estorno.
 */
export const TransactionDetailSheet = ({ entry, onClose, canControl }: TransactionDetailSheetProps) => {
  const { t } = useTranslation();
  const { getTransaction, reverse } = useTransaction();
  const [transaction, setTransaction] = useState<TransactionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reversing, setReversing] = useState(false);
  // Estornar é um lançamento: exige internet (feature 005)
  const onlineAction = useOnlineAction(OfflineActionKind.Transaction);
  const transactionId = entry?.transactionId ?? null;

  useEffect(() => {
    if (transactionId === null) return undefined;
    let cancelled = false;
    setTransaction(null);
    setLoadError(null);
    getTransaction(transactionId)
      .then((result) => {
        if (!cancelled) setTransaction(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId, getTransaction]);

  if (!entry) return null;

  const visual = transactionVisual(entry.type);
  const Icon = visual.icon;
  const reversed = transaction?.reversedByTransactionId != null;
  const canReverse =
    canControl && transaction !== null && !reversed && transaction.type !== TransactionType.Reversal;
  const typeLabel = t(`transactionType.${entry.type}`);
  const accountName = (name: string, kind: string) => (kind === "Wallet" ? name : t("statement.outside"));

  const doReverse = async () => {
    if (!transaction) return;
    setReversing(true);
    try {
      await reverse(transaction.transactionId, null);
      notifySuccess(t("statement.reverseSuccess"));
      onClose();
    } catch (err) {
      // Rede caiu durante o envio: o estorno pode ter sido gravado — não reenviar (T041)
      if (isUnconfirmedWriteError(err)) notifyErrorMessage(t("pwa.offline.writeUnconfirmed"));
      else notifyError(err);
      throw err;
    } finally {
      setReversing(false);
    }
  };

  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-3 border-t-[0.5px] border-separator py-2 text-subhead first:border-t-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="m-0 text-right font-semibold break-words">{value}</dd>
    </div>
  );

  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={t("statement.detailTitle")}
        leading={<span />}
        trailing={
          <SheetHeaderButton onClick={onClose}>
            <span className="px-2 font-semibold">{t("statement.ok")}</span>
          </SheetHeaderButton>
        }
      >
        <div className="flex flex-col items-center gap-1 pt-1 pb-5 text-center">
          <span aria-hidden="true" className={cn("grid size-12 place-items-center rounded-[14px]", visual.className)}>
            <Icon className="size-[26px]" strokeWidth={1.75} />
          </span>
          <span
            className={cn(
              "mt-2 text-[1.75rem] font-bold tabular-nums",
              entry.amount < 0 ? "text-negative" : "text-positive",
              reversed && "line-through decoration-2",
            )}
          >
            <span className="sr-only">
              {entry.amount < 0 ? t("transaction.preview.outgoing") : t("transaction.preview.incoming")}{" "}
            </span>
            {formatSigned(entry.amount, entry.currency)}
          </span>
          <span className="text-footnote text-text-muted">
            {typeLabel}
            {reversed ? (
              <>
                {" · "}
                <Badge variant="reversed">{t("badges.reversed")}</Badge>
              </>
            ) : null}
          </span>
        </div>

        {reversed && transaction?.reversedByTransactionId != null ? (
          <Banner tone="info" className="mb-3">
            {t("statement.reversedBy", { id: transaction.reversedByTransactionId })}
          </Banner>
        ) : null}

        {loadError ? (
          <Banner tone="error" role="alert" className="mb-3">
            {loadError}
          </Banner>
        ) : null}

        {transaction ? (
          <dl className="m-0 rounded-lg bg-surface px-4 py-2">
            {row(t("statement.date"), formatDateTime(transaction.occurredAt))}
            {row(t("transaction.from"), accountName(transaction.source.name, transaction.source.kind))}
            {row(t("transaction.to"), accountName(transaction.destination.name, transaction.destination.kind))}
            {transaction.source.currency !== transaction.destination.currency
              ? row(
                  t("statement.received"),
                  formatMoney(transaction.destinationAmount, transaction.destination.currency),
                )
              : null}
            {transaction.quote
              ? row(t("transaction.preview.quote"), t("home.quote", { price: formatBrl(transaction.quote.priceBrl) }))
              : null}
            {transaction.description ? row(t("transaction.description"), transaction.description) : null}
            {row(t("statement.code"), `#${transaction.transactionId}`)}
          </dl>
        ) : !loadError ? (
          <div aria-busy="true" className="rounded-lg bg-surface p-4">
            <span className="sr-only">{t("app.loading")}</span>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="mt-2.5 h-3.5 w-3/5" />
          </div>
        ) : null}

        {canReverse ? (
          <Button
            variant="destructiveGhost"
            block
            className="mt-4 bg-surface"
            icon={<Undo2 className="size-5" strokeWidth={1.75} />}
            {...onlineAction.offlineProps}
            onClick={onlineAction.guard(() => setConfirmOpen(true))}
          >
            {t("statement.reverse")}
          </Button>
        ) : null}
      </Sheet>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="destructive"
        loading={reversing}
        title={t("statement.reverseTitle")}
        description={t("statement.reverseBody", {
          amount: formatMoney(Math.abs(entry.amount), entry.currency),
          type: typeLabel.toLowerCase(),
          date: formatDate(entry.occurredAt),
        })}
        confirmLabel={t("statement.reverseConfirm")}
        onConfirm={doReverse}
      />
    </>
  );
};

export default TransactionDetailSheet;
