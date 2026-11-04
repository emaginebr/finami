import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OfflineActionKind, useOnlineAction } from "../../hooks/useOnlineAction";
import { useTransaction } from "../../hooks/useTransaction";
import { isApiError, isUnconfirmedWriteError } from "../../types/api";
import { TransactionType } from "../../types/transaction";
import type { TransactionInfo } from "../../types/transaction";
import type { StatementEntryInfo } from "../../types/statement";
import { cn } from "../../utils/cn";
import { formatDate, formatDateTime } from "../../utils/dates";
import { formatBrl, formatMoney, formatMoneyFull, formatSigned } from "../../utils/money";
import { errorMessage, notifyError, notifyErrorMessage, notifySuccess } from "../../utils/notify";
import { Badge } from "../ui/Badge";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { Sheet, SheetHeaderButton } from "../ui/Sheet";
import { Skeleton } from "../ui/Skeleton";
import { listRowClasses } from "../ui/listRow";
import { ReverseEffect } from "./ReverseEffect";
import { reversalKindLabel, transactionVisual, transferKindLabel } from "./transactionVisuals";

export interface TransactionDetailSheetProps {
  /** Lançamento aberto; `null` = folha fechada */
  entry: StatementEntryInfo | null;
  onClose: () => void;
}

/** Erros definitivos do estorno: tentar de novo não adianta (sem permissão, já estornado, é estorno) */
const FINAL_REVERSE_STATUSES = [403, 409, 422];

/**
 * Lançamento ligado (original ↔ estorno) visto a partir da linha do extrato: o estorno inverte origem
 * e destino, então o lado da carteira do extrato também se inverte (components.md §12, "Sinal do valor").
 */
const linkedEntryOf = (base: StatementEntryInfo, linked: TransactionInfo | null): StatementEntryInfo => ({
  ...base,
  transactionId: linked?.transactionId ?? base.transactionId,
  occurredAt: linked?.occurredAt ?? base.occurredAt,
  type: linked?.type ?? (base.type === TransactionType.Reversal ? base.type : TransactionType.Reversal),
  sourceName: linked?.source.name ?? base.destinationName,
  destinationName: linked?.destination.name ?? base.sourceName,
  amount: -base.amount,
  description: linked?.description ?? null,
  transferKind: linked?.transferKind ?? base.transferKind ?? null,
  sourceOwnerFirstName: base.destinationOwnerFirstName,
  destinationOwnerFirstName: base.sourceOwnerFirstName,
});

/**
 * Detalhe do lançamento (mockup wallet-statement.html; feature 008, components.md §12): busca
 * `GET /api/transactions/{id}` ao abrir e oferece "Estornar" quando o servidor diz que quem consulta
 * pode estornar (`canReverse`). A confirmação mostra o efeito do estorno, e as ligações "Estornado
 * por #id" / "Estorno de #id" abrem o lançamento ligado na mesma folha (pilha de 1 nível).
 */
export const TransactionDetailSheet = ({ entry, onClose }: TransactionDetailSheetProps) => {
  const { t } = useTranslation();
  const { getTransaction, reverse } = useTransaction();
  const [loadedTransaction, setTransaction] = useState<TransactionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reversing, setReversing] = useState(false);
  /** Lançamento ligado aberto pela ligação; `null` = o da linha do extrato */
  const [linkedId, setLinkedId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /** Para onde o foco vai depois da troca de lançamento */
  const [focusTarget, setFocusTarget] = useState<"summary" | "link" | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  /**
   * Erro definitivo no estorno: ao fechar a confirmação o foco vai para o resumo (que continua montado
   * durante o recarregamento), não para o "Estornar", que vai sumir (REVIEW-008 M-4)
   */
  const focusSummaryOnClose = useRef(false);
  const linkRef = useRef<HTMLButtonElement>(null);
  // Estornar é um lançamento: exige internet (feature 005)
  const onlineAction = useOnlineAction(OfflineActionKind.Transaction);
  const entryId = entry?.transactionId ?? null;
  const shownId = linkedId ?? entryId;
  // Só o lançamento que está sendo mostrado (na troca, o anterior não aparece nem por um instante)
  const transaction = loadedTransaction?.transactionId === shownId ? loadedTransaction : null;

  // Outra linha do extrato: volta para o lançamento dela
  useEffect(() => {
    setLinkedId(null);
  }, [entryId]);

  useEffect(() => {
    if (shownId === null) return undefined;
    let cancelled = false;
    setTransaction(null);
    setLoadError(null);
    getTransaction(shownId)
      .then((result) => {
        if (!cancelled) setTransaction(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [shownId, getTransaction, reloadKey]);

  // Foco: no resumo do lançamento depois de abrir o ligado; na ligação ao voltar (quando o
  // lançamento mostrado já carregou — antes disso a ligação ainda é a do anterior)
  useEffect(() => {
    if (focusTarget === null) return;
    if (focusTarget === "summary") {
      summaryRef.current?.focus();
      setFocusTarget(null);
    } else if (transaction !== null && linkRef.current) {
      linkRef.current.focus();
      setFocusTarget(null);
    }
  }, [focusTarget, transaction]);

  if (!entry) return null;

  const viewingLinked = linkedId !== null;
  const view = viewingLinked ? linkedEntryOf(entry, transaction) : entry;
  // Enquanto o ligado carrega, o tipo ainda não é conhecido (só o valor)
  const typeKnown = !viewingLinked || transaction !== null || entry.type !== TransactionType.Reversal;

  const visual = transactionVisual(view.type);
  const Icon = visual.icon;
  const reversed = transaction?.reversedByTransactionId != null;
  // O servidor decide (permissão, visibilidade, já estornado, é estorno — feature 008, R-07)
  const canReverse = transaction !== null && transaction.canReverse;
  const genericLabel = t(`transactionType.${view.type}`);
  // Cabeçalho com o rótulo do extrato ("Quitação de Bruno") quando há tipo (feature 007)
  const typeLabel = transferKindLabel(t, view) ?? genericLabel;
  const transferKind = transaction?.transferKind ?? view.transferKind ?? null;
  // O estorno herda tipo e efeito do original, mas faz o contrário: a linha "Tipo" mostra o estorno
  // ("Estorno de quitação") e o valor é "Devolvido à dívida" (REVIEW-007 I-4)
  const isReversal = (transaction?.type ?? view.type) === TransactionType.Reversal;
  const kindValue = transferKind
    ? isReversal
      ? reversalKindLabel(t, transferKind)
      : t(`transaction.kind.${transferKind}`)
    : null;
  const debtRowLabel = isReversal ? t("transaction.preview.debtRestored") : t("transaction.preview.debtAbated");
  // "Abatido da dívida": só quando a dívida é em outra moeda (quitação convertida)
  const debtCurrency = transaction?.debtCurrency ?? view.debtCurrency ?? null;
  const debtAmount = transaction?.debtAmount ?? view.debtAmount ?? null;
  const showDebtAbated =
    transaction !== null &&
    debtCurrency !== null &&
    debtAmount !== null &&
    debtCurrency !== transaction.source.currency;
  // ConfirmModal: só o nome do tipo, em minúsculas ("empréstimo"), nunca o rótulo com o nome da pessoa
  const reverseTypeName = (transferKind ? t(`transaction.kind.${transferKind}`) : genericLabel).toLowerCase();
  const accountName = (name: string, kind: string) => (kind === "Wallet" ? name : t("statement.outside"));

  // Ligação: original estornado → estorno; estorno → original
  const link =
    transaction?.reversedByTransactionId != null
      ? {
          id: transaction.reversedByTransactionId,
          title: t("statement.reversedByLink", { id: transaction.reversedByTransactionId }),
          subtitle: t("statement.openReversal"),
        }
      : transaction?.reversedTransactionId != null
        ? {
            id: transaction.reversedTransactionId,
            title: t("statement.reversalOf", { id: transaction.reversedTransactionId }),
            subtitle: t("statement.openOriginal"),
          }
        : null;

  const openLinked = (id: number) => {
    // Pilha de 1 nível: abrir a partir do ligado volta para a linha do extrato
    setLinkedId(id === entry.transactionId ? null : id);
    setFocusTarget(id === entry.transactionId ? "link" : "summary");
  };

  const goBack = () => {
    setLinkedId(null);
    setFocusTarget("link");
  };

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
      // Sem permissão / já estornado / é estorno: fecha a confirmação e recarrega o detalhe
      // ("Estornar" some com o `canReverse` atualizado)
      if (isApiError(err) && FINAL_REVERSE_STATUSES.includes(err.status)) {
        setReloadKey((key) => key + 1);
        // O "Estornar" vai sumir: o foco vai para o resumo, não para o contêiner da folha (REVIEW-008 M-4)
        focusSummaryOnClose.current = true;
        return;
      }
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
        leading={
          viewingLinked ? (
            <SheetHeaderButton onClick={goBack}>
              <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={1.75} />
              {t("actions.back")}
            </SheetHeaderButton>
          ) : (
            <span />
          )
        }
        trailing={
          <SheetHeaderButton onClick={onClose}>
            <span className="px-2 font-semibold">{t("statement.ok")}</span>
          </SheetHeaderButton>
        }
      >
        <div
          ref={summaryRef}
          tabIndex={-1}
          className="flex flex-col items-center gap-1 pt-1 pb-5 text-center outline-none"
        >
          <span aria-hidden="true" className={cn("grid size-12 place-items-center rounded-[14px]", visual.className)}>
            <Icon className="size-[26px]" strokeWidth={1.75} />
          </span>
          <span
            className={cn(
              "mt-2 text-[1.75rem] font-bold tabular-nums",
              view.amount < 0 ? "text-negative" : "text-positive",
              reversed && "line-through decoration-2",
            )}
          >
            <span className="sr-only">
              {view.amount < 0 ? t("transaction.preview.outgoing") : t("transaction.preview.incoming")}{" "}
            </span>
            {formatSigned(view.amount, view.currency)}
          </span>
          {typeKnown ? (
            <span className="text-footnote text-text-muted">
              {typeLabel}
              {reversed ? (
                <>
                  {" · "}
                  <Badge variant="reversed">{t("badges.reversed")}</Badge>
                </>
              ) : null}
            </span>
          ) : null}
        </div>

        {link ? (
          <div className="mb-3 overflow-hidden rounded-lg bg-surface">
            <button
              ref={linkRef}
              type="button"
              onClick={() => openLinked(link.id)}
              className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
            >
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-surface-3 text-text-muted"
              >
                <Undo2 className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-headline text-accent">{link.title}</span>
                <span className="mt-0.5 block truncate text-footnote text-text-muted">{link.subtitle}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
            </button>
          </div>
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
            {kindValue ? row(t("transaction.kind.label"), kindValue) : null}
            {showDebtAbated && debtCurrency !== null && debtAmount !== null
              ? row(debtRowLabel, formatMoneyFull(debtAmount, debtCurrency))
              : null}
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
        loadingLabel={t("statement.reversing")}
        title={t("statement.reverseTitle")}
        description={t("statement.reverseBody", {
          amount: formatMoney(Math.abs(view.amount), view.currency),
          type: reverseTypeName,
          date: formatDate(view.occurredAt),
        })}
        details={transaction ? <ReverseEffect transaction={transaction} /> : undefined}
        onCloseAutoFocus={(event) => {
          if (!focusSummaryOnClose.current) return;
          focusSummaryOnClose.current = false;
          event.preventDefault();
          summaryRef.current?.focus();
        }}
        confirmLabel={t("statement.reverseConfirm")}
        onConfirm={doReverse}
      />
    </>
  );
};

export default TransactionDetailSheet;
