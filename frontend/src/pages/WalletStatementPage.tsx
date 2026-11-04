import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Copy, Inbox, Pencil, Power, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LargeTitleHeader } from "../components/layout/LargeTitleHeader";
import { AppTab, readNavState } from "../components/layout/navigation";
import { PeriodPicker } from "../components/statement/PeriodPicker";
import { StatementEntryRow } from "../components/statement/StatementEntryRow";
import { StatementTotals } from "../components/statement/StatementTotals";
import { TransactionDetailSheet } from "../components/statement/TransactionDetailSheet";
import { OfflineContent } from "../components/pwa/OfflineContent";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Sheet } from "../components/ui/Sheet";
import { Skeleton } from "../components/ui/Skeleton";
import { listRowClasses } from "../components/ui/listRow";
import { WalletForm } from "../components/wallet/WalletForm";
import type { WalletFormValues } from "../components/wallet/WalletForm";
import { useAuth } from "../hooks/useAuth";
import { useGroup } from "../hooks/useGroup";
import { useStatement } from "../hooks/useStatement";
import { useTransaction } from "../hooks/useTransaction";
import { useWallet } from "../hooks/useWallet";
import { useOnReconnected } from "../hooks/useOnReconnected";
import { useOnlineAction } from "../hooks/useOnlineAction";
import { ApiError, isApiError, isOfflineError } from "../types/api";
import { DetailLevel } from "../types/balance";
import type { StatementEntryInfo, StatementPeriod, StatementResult } from "../types/statement";
import type { WalletInfo } from "../types/wallet";
import { PeriodPreset, dayKeyOf, formatDayHeading, presetPeriod } from "../utils/dates";
import { familyColorClass } from "../utils/familyColors";
import { formatMoney } from "../utils/money";
import { errorMessage, notifyError, notifySuccess } from "../utils/notify";

enum LoadPhase {
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}

interface DayGroup {
  key: string;
  entries: StatementEntryInfo[];
}

/** Lançamentos do mais recente ao mais antigo, agrupados por dia (fuso de São Paulo) */
const groupByDay = (entries: StatementEntryInfo[]): DayGroup[] => {
  const sorted = [...entries].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const groups: DayGroup[] = [];
  for (const entry of sorted) {
    const key = dayKeyOf(entry.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, entries: [entry] });
  }
  return groups;
};

/** Extrato da carteira (rota `/carteiras/:walletId`) — US3 + ações da US4 */
const WalletStatementPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = readNavState(location.state);
  const { walletId: walletIdParam } = useParams();
  const walletId = Number(walletIdParam);
  const validId = Number.isInteger(walletId) && walletId > 0;

  const { session } = useAuth();
  const { getWallet, updateWallet, setWalletGroup, deactivateWallet, deleteWallet } = useWallet();
  const { groups, loadGroups } = useGroup();
  const { getWalletStatement } = useStatement();
  const { ledgerVersion } = useTransaction();
  const editFormId = useId();
  const onlineAction = useOnlineAction();

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [period, setPeriod] = useState<StatementPeriod>(() => ({
    preset: PeriodPreset.ThisMonth,
    ...presetPeriod(PeriodPreset.ThisMonth),
  }));
  const [statement, setStatement] = useState<StatementResult | null>(null);
  const [phase, setPhase] = useState<LoadPhase>(LoadPhase.Loading);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openEntry, setOpenEntry] = useState<StatementEntryInfo | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  // Dados da carteira (cabeçalho, saldo e permissões); recarrega após lançamentos
  const refreshWallet = useCallback(async () => {
    if (!validId) return;
    try {
      setWallet(await getWallet(walletId));
    } catch {
      // Sem controle da carteira (ex.: extrato de outro membro): usa o resumo da navegação
      setWallet(null);
    }
  }, [getWallet, validId, walletId]);

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet, ledgerVersion]);

  // Conexão voltou: recarrega carteira e extrato (FR-012)
  useOnReconnected(() => {
    void refreshWallet();
    setReloadKey((key) => key + 1);
  });

  useEffect(() => {
    if (groups.length === 0) loadGroups().catch(() => undefined);
    // Só uma vez ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Extrato do período; recarrega quando o período ou o razão (ledgerVersion) mudam
  useEffect(() => {
    if (!validId) {
      setLoadError(new ApiError(404, t("errors.notFound")));
      setPhase(LoadPhase.Error);
      return undefined;
    }
    let cancelled = false;
    setPhase((current) => (current === LoadPhase.Ready ? current : LoadPhase.Loading));
    getWalletStatement(walletId, period.start, period.end)
      .then((result) => {
        if (cancelled) return;
        setStatement(result);
        setLoadError(null);
        setPhase(LoadPhase.Ready);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err);
        setPhase(LoadPhase.Error);
      });
    return () => {
      cancelled = true;
    };
  }, [getWalletStatement, walletId, validId, period.start, period.end, ledgerVersion, reloadKey, t]);

  const summary = wallet ?? navState.walletSummary ?? null;
  const currency = summary?.currency ?? statement?.totals[0]?.currency ?? null;
  const canControl = wallet?.canControl ?? false;
  const familyName = wallet?.groupId != null ? groups.find((g) => g.groupId === wallet.groupId)?.name : null;
  // Mesma cor da seção na Home: posição da família em ordem alfabética (REVIEW E-5)
  const familyIndex =
    wallet?.groupId != null
      ? [...groups].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).findIndex((g) => g.groupId === wallet.groupId)
      : -1;
  const totals = statement
    ? (statement.totals.find((item) => item.currency === currency) ?? statement.totals[0] ?? null)
    : null;
  const days = useMemo(() => (statement ? groupByDay(statement.entries) : []), [statement]);

  const fromHome = navState.tab === AppTab.Home;
  const backTo = navState.backTo ?? (fromHome ? "/" : "/carteiras");
  const backLabel = navState.backLabel ?? (fromHome ? t("nav.home") : t("nav.wallets"));

  // ---------------------------------------------------------------------------
  // Ações da carteira (US4, só com canControl)
  // ---------------------------------------------------------------------------

  const saveWallet = async (values: WalletFormValues) => {
    if (!wallet) return;
    setSaving(true);
    setEditError(null);
    try {
      let updated = await updateWallet(wallet.walletId, {
        name: values.name,
        description: values.description,
        isVirtual: values.isVirtual,
      });
      if (values.groupId !== wallet.groupId) {
        updated = await setWalletGroup(wallet.walletId, values.groupId);
      }
      setWallet(updated);
      setEditOpen(false);
      notifySuccess(t("wallets.updated"));
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const doDeactivate = async () => {
    if (!wallet) return;
    setBusy(true);
    try {
      await deactivateWallet(wallet.walletId);
      await refreshWallet();
      notifySuccess(t("wallets.deactivated", { name: wallet.name }));
    } catch (err) {
      notifyError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!wallet) return;
    setBusy(true);
    try {
      await deleteWallet(wallet.walletId);
      notifySuccess(t("wallets.deleted", { name: wallet.name }));
      navigate("/carteiras", { replace: true });
    } catch (err) {
      if (isApiError(err) && err.status === 422) {
        setDeleteBlocked(true);
        return;
      }
      notifyError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    const code = String(walletId);
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard) return;
    clipboard
      .writeText(code)
      .then(() => notifySuccess(t("wallets.codeCopied", { code })))
      .catch(() => undefined);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const title = summary?.name ?? t("statement.title");
  const actions = canControl ? (
    <button
      type="button"
      aria-label={t("wallets.edit")}
      {...onlineAction.offlineProps}
      onClick={onlineAction.guard(() => {
        setEditError(null);
        setEditOpen(true);
      })}
      className="grid size-11 place-items-center rounded-pill text-accent hover:bg-surface-2 aria-disabled:cursor-not-allowed aria-disabled:text-text-disabled aria-disabled:hover:bg-transparent"
    >
      <Pencil aria-hidden="true" className="size-5" strokeWidth={1.75} />
    </button>
  ) : undefined;

  const subtitle = currency ? (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      {familyName && familyIndex >= 0 ? (
        <span aria-hidden="true" className={"mr-0.5 inline-block size-2 rounded-pill " + familyColorClass(familyIndex)} />
      ) : null}
      {[familyName ?? (wallet ? t("wallet.loose") : null), t(`currency.${currency}`)]
        .filter(Boolean)
        .join(" · ")}
      {" · "}
      {t("wallets.code")} <span className="tabular-nums">{walletId}</span>
      <button
        type="button"
        onClick={copyCode}
        aria-label={t("wallets.copyCode", { code: walletId })}
        className="-my-3 grid size-11 place-items-center rounded-pill text-accent"
      >
        <Copy aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </button>
    </span>
  ) : undefined;

  // "Sem internet" fica na tela durante a nova tentativa (REVIEW-005 M-5)
  const offlineRetry = phase === LoadPhase.Loading && isOfflineError(loadError);
  if ((phase === LoadPhase.Error || offlineRetry) && isOfflineError(loadError)) {
    return (
      <>
        <LargeTitleHeader title={title} backTo={backTo} backLabel={backLabel} />
        <OfflineContent retrying={offlineRetry} onRetry={() => setReloadKey((key) => key + 1)} />
      </>
    );
  }

  if (phase === LoadPhase.Error) {
    return (
      <>
        <LargeTitleHeader title={title} backTo={backTo} backLabel={backLabel} />
        <ErrorState
          error={loadError}
          onRetry={
            isApiError(loadError) && (loadError.status === 403 || loadError.status === 404)
              ? undefined
              : () => setReloadKey((key) => key + 1)
          }
          action={
            isApiError(loadError) && (loadError.status === 403 || loadError.status === 404) ? (
              <Link
                to={backTo}
                className="inline-flex min-h-touch items-center rounded-md border border-border bg-surface-2 px-4 text-subhead font-semibold text-text no-underline"
              >
                {t("actions.back")}
              </Link>
            ) : undefined
          }
        />
      </>
    );
  }

  return (
    <>
      <LargeTitleHeader
        title={title}
        subtitle={subtitle}
        backTo={backTo}
        backLabel={backLabel}
        actions={actions}
      />

      {summary ? (
        <div className="mb-5">
          <p className="m-0 text-footnote text-text-muted">{t("statement.currentBalance")}</p>
          <p
            className={
              "m-0 mt-0.5 text-[2.125rem] leading-tight font-bold tracking-tight whitespace-nowrap tabular-nums" +
              (summary.balance < 0 ? " text-negative" : "")
            }
          >
            {formatMoney(summary.balance, summary.currency)}
          </p>
        </div>
      ) : null}

      <PeriodPicker period={period} onChange={setPeriod} />

      {phase === LoadPhase.Loading && !statement ? (
        <div aria-busy="true">
          <span className="sr-only" role="status">
            {t("app.loading")}
          </span>
          <div aria-hidden="true" className="rounded-lg bg-surface p-4">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="mt-2.5 h-3.5 w-3/5" />
          </div>
        </div>
      ) : statement ? (
        <>
          {totals ? <StatementTotals totals={totals} /> : null}

          {statement.detailLevel === DetailLevel.Summary ? (
            <Banner tone="info" title={t("statement.summaryOnlyTitle")} className="mt-4">
              {t("statement.summaryOnlyBody")}
            </Banner>
          ) : days.length === 0 ? (
            <EmptyState icon={Inbox} title={t("statement.emptyTitle")} description={t("statement.emptyBody")} />
          ) : (
            days.map((day) => (
              <section key={day.key} aria-labelledby={`day-${day.key}`}>
                <h2
                  id={`day-${day.key}`}
                  className="m-0 px-4 pt-5 pb-2 text-footnote font-semibold tracking-wider text-text-muted uppercase"
                >
                  {formatDayHeading(day.key, { today: t("statement.today"), yesterday: t("statement.yesterday") })}
                </h2>
                <div className="overflow-hidden rounded-lg bg-surface">
                  {day.entries.map((entry) => (
                    <StatementEntryRow
                      key={`${entry.transactionId}-${entry.currency}`}
                      entry={entry}
                      onOpen={setOpenEntry}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      ) : null}

      <TransactionDetailSheet entry={openEntry} onClose={() => setOpenEntry(null)} />

      {wallet && canControl ? (
        <>
          <Sheet
            open={editOpen}
            onOpenChange={(open) => !saving && setEditOpen(open)}
            title={t("wallets.editTitle")}
            dismissible={!saving}
            tall
            footer={
              <Button type="submit" form={editFormId} block loading={saving} loadingLabel={t("actions.saving")}>
                {t("actions.save")}
              </Button>
            }
          >
            <WalletForm
              formId={editFormId}
              wallet={wallet}
              groups={groups}
              currentUserId={session?.user.userId ?? null}
              onSubmit={(values) => void saveWallet(values)}
              disabled={saving}
              serverError={editError}
            />
            <h3 className="m-0 mt-6 mb-2 px-4 text-footnote font-semibold tracking-wider text-text-muted uppercase">
              {t("wallets.dangerZone")}
            </h3>
            <div className="overflow-hidden rounded-lg bg-surface">
              {wallet.isActive ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setEditOpen(false);
                    setConfirmDeactivate(true);
                  }}
                  className={listRowClasses({ twoLines: true, withIcon: true, interactive: true }) + " text-negative"}
                >
                  <Power aria-hidden="true" className="size-6 shrink-0 text-negative" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body text-negative">{t("wallets.deactivate")}</span>
                    <span className="mt-0.5 block text-footnote text-text-muted">{t("wallets.deactivateHint")}</span>
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditOpen(false);
                  setConfirmDelete(true);
                }}
                className={listRowClasses({ twoLines: true, withIcon: true, interactive: true }) + " text-negative"}
              >
                <Trash2 aria-hidden="true" className="size-6 shrink-0 text-negative" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className="block text-body text-negative">{t("wallets.delete")}</span>
                  <span className="mt-0.5 block text-footnote text-text-muted">{t("wallets.deleteHint")}</span>
                </span>
              </button>
            </div>
          </Sheet>

          <ConfirmModal
            open={confirmDeactivate}
            onOpenChange={setConfirmDeactivate}
            tone="destructive"
            loading={busy}
            title={t("wallets.deactivateTitle", { name: wallet.name })}
            description={t("wallets.deactivateBody")}
            confirmLabel={t("wallets.deactivate")}
            onConfirm={doDeactivate}
          />
          <ConfirmModal
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            tone="destructive"
            loading={busy}
            title={t("wallets.deleteTitle", { name: wallet.name })}
            description={t("wallets.deleteBody")}
            confirmLabel={t("wallets.delete")}
            onConfirm={doDelete}
          />
          <ConfirmModal
            open={deleteBlocked}
            onOpenChange={setDeleteBlocked}
            tone="destructive"
            loading={busy}
            title={t("wallets.deleteBlockedTitle")}
            description={t("wallets.deleteBlockedBody", { name: wallet.name })}
            confirmLabel={t("wallets.deactivate")}
            onConfirm={doDeactivate}
          />
        </>
      ) : null}
    </>
  );
};

export default WalletStatementPage;
