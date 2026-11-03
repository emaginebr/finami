import { useCallback, useEffect, useId, useRef, useState } from "react";
import { EyeOff, Pencil, UserPlus } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AddMemberSheet } from "../components/group/AddMemberSheet";
import { GroupForm } from "../components/group/GroupForm";
import { MemberManager } from "../components/group/MemberManager";
import { MemberRow } from "../components/group/MemberRow";
import { PendingInvitations } from "../components/group/PendingInvitations";
import { SectionHeaderAction } from "../components/ui/SectionHeaderAction";
import { VisibilityPicker } from "../components/group/VisibilityPicker";
import { LargeTitleHeader } from "../components/layout/LargeTitleHeader";
import { AppTab, FAMILIES_PATH, readNavState } from "../components/layout/navigation";
import type { NavState } from "../components/layout/navigation";
import { NotificationBell } from "../components/notification/NotificationBell";
import { OfflineContent } from "../components/pwa/OfflineContent";
import { NotificationBellVariant } from "../components/ui/variants";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { Sheet, SheetHeaderButton } from "../components/ui/Sheet";
import { BalanceHero, BalanceHeroSkeleton } from "../components/wallet/BalanceHero";
import { useAuth } from "../hooks/useAuth";
import { useBalance } from "../hooks/useBalance";
import { useGroup } from "../hooks/useGroup";
import { useInvitation } from "../hooks/useInvitation";
import { useTransaction } from "../hooks/useTransaction";
import { useOnReconnected } from "../hooks/useOnReconnected";
import { useOnlineAction } from "../hooks/useOnlineAction";
import { ApiError, isApiError, isOfflineError } from "../types/api";
import { DetailLevel } from "../types/balance";
import type { GroupBalancesResult } from "../types/balance";
import type { GroupInfo } from "../types/group";
import type { GroupInvitationInfo } from "../types/invitation";
import { StatementVisibility } from "../types/group";
import { toCents } from "../utils/money";
import { errorMessage, notifySuccess } from "../utils/notify";
import { quoteStatusOf } from "../utils/quote";

enum LoadPhase {
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}

export interface GroupPageProps {
  /**
   * Família mostrada direto na aba Família (`/familias`, quando a pessoa só tem uma):
   * sem botão voltar. Sem a prop, usa o `:groupId` da rota.
   */
  groupId?: number;
}

/** Família (rota `/familias/:groupId`): saldo por membro (US5) e gestão (US4) */
const GroupPage = ({ groupId: rootGroupId }: GroupPageProps = {}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navState = readNavState(location.state);
  const { groupId: groupIdParam } = useParams();
  const isRoot = rootGroupId !== undefined;
  const groupId = isRoot ? rootGroupId : Number(groupIdParam);
  const validId = Number.isInteger(groupId) && groupId > 0;

  const { session } = useAuth();
  const { groups, getGroup, updateGroup } = useGroup();
  const { getGroupBalances } = useBalance();
  const { listPending } = useInvitation();
  const { ledgerVersion } = useTransaction();
  const renameFormId = useId();
  const membersHeadingId = useId();
  const addMemberRef = useRef<HTMLButtonElement>(null);
  const onlineAction = useOnlineAction();

  const [balances, setBalances] = useState<GroupBalancesResult | null>(null);
  const [phase, setPhase] = useState<LoadPhase>(LoadPhase.Loading);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [visibility, setVisibility] = useState<StatementVisibility>(StatementVisibility.AllMembers);
  const [savingName, setSavingName] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  /** Remonta a folha a cada abertura (começa sempre pelo email) */
  const [addKey, setAddKey] = useState(0);
  const [pending, setPending] = useState<GroupInvitationInfo[]>([]);

  const group: GroupInfo | null = groups.find((g) => g.groupId === groupId) ?? null;

  // Convites pendentes (só responsável); falha aqui não derruba a tela
  const loadPending = useCallback(async () => {
    try {
      setPending(await listPending(groupId));
    } catch {
      setPending([]);
    }
  }, [listPending, groupId]);

  const load = useCallback(async () => {
    if (!validId) {
      setLoadError(new ApiError(404, t("errors.notFound")));
      setPhase(LoadPhase.Error);
      return;
    }
    setPhase((current) => (current === LoadPhase.Ready ? current : LoadPhase.Loading));
    const [groupResult, balancesResult] = await Promise.allSettled([
      getGroup(groupId),
      getGroupBalances(groupId),
    ]);
    if (balancesResult.status === "fulfilled") {
      setBalances(balancesResult.value);
      setLoadError(null);
      setPhase(LoadPhase.Ready);
    } else {
      setLoadError(balancesResult.reason);
      setPhase(LoadPhase.Error);
    }
    if (groupResult.status === "fulfilled") {
      setVisibility(groupResult.value.statementVisibility);
      if (groupResult.value.isResponsible) await loadPending();
    }
  }, [getGroup, getGroupBalances, groupId, validId, t, loadPending]);

  // Recarrega quando há lançamentos novos (ledgerVersion)
  useEffect(() => {
    void load();
  }, [load, ledgerVersion]);

  // Conexão voltou: recarrega saldos, família e pendentes (FR-012)
  useOnReconnected(() => {
    void load();
  });

  const userId = session?.user.userId ?? null;
  const name = balances?.name ?? group?.name ?? t("groups.familyFallback");
  const isResponsible = balances?.isResponsible ?? group?.isResponsible ?? false;
  const detailLevel = balances?.detailLevel ?? DetailLevel.Hidden;
  const quoteStatus = quoteStatusOf(balances?.quote ?? null);
  const responsible = balances?.members.find((m) => m.isResponsible) ?? null;
  const responsibleName = responsible ? `${responsible.firstName} ${responsible.lastName}` : "";
  const memberCount = balances?.members.length ?? group?.members.length ?? 0;

  // Voltar: para a aba de origem (Home, Carteiras ou a lista da aba Família); na raiz da aba, nenhum
  const originTab = navState.tab ?? AppTab.Family;
  const defaultBack =
    originTab === AppTab.Home
      ? { to: "/", label: t("nav.home") }
      : originTab === AppTab.Wallets
        ? { to: "/carteiras", label: t("nav.wallets") }
        : { to: FAMILIES_PATH, label: t("nav.family") };
  const backTo = isRoot ? undefined : (navState.backTo ?? defaultBack.to);
  const backLabel = isRoot ? undefined : (navState.backLabel ?? defaultBack.label);
  const childState: NavState = {
    tab: originTab,
    backTo: isRoot ? FAMILIES_PATH : `/familias/${groupId}`,
    backLabel: name,
  };

  const subtitle = [
    t("groups.memberCount", { count: memberCount }),
    isResponsible
      ? t(`groups.visibilitySummary.${balances?.statementVisibility ?? visibility}`)
      : responsibleName
        ? t("groups.responsibleIs", { name: responsibleName })
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // ---------------------------------------------------------------------------
  // Gestão (só responsável)
  // ---------------------------------------------------------------------------

  const rename = async (newName: string) => {
    setSavingName(true);
    setManageError(null);
    try {
      await updateGroup(groupId, { name: newName, statementVisibility: null });
      notifySuccess(t("groups.renamed", { name: newName }));
      void load();
    } catch (err) {
      setManageError(errorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const saveVisibility = async () => {
    setSavingVisibility(true);
    setManageError(null);
    try {
      await updateGroup(groupId, { name: null, statementVisibility: visibility });
      notifySuccess(t("groups.visibilitySaved"));
      void load();
    } catch (err) {
      setManageError(errorMessage(err));
    } finally {
      setSavingVisibility(false);
    }
  };

  const currentVisibility = group?.statementVisibility ?? balances?.statementVisibility ?? visibility;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // "Sem internet" fica na tela durante a nova tentativa (REVIEW-005 M-5)
  const offlineRetry = phase === LoadPhase.Loading && isOfflineError(loadError);
  if ((phase === LoadPhase.Error || offlineRetry) && isOfflineError(loadError)) {
    return (
      <>
        <LargeTitleHeader title={name} backTo={backTo} backLabel={backLabel} />
        <OfflineContent retrying={offlineRetry} onRetry={() => void load()} />
      </>
    );
  }

  if (phase === LoadPhase.Error) {
    const notFound = isApiError(loadError) && (loadError.status === 404 || loadError.status === 403);
    return (
      <>
        <LargeTitleHeader title={name} backTo={backTo} backLabel={backLabel} />
        <ErrorState
          error={loadError}
          onRetry={notFound ? undefined : () => void load()}
          action={
            notFound ? (
              <Link
                to={backTo ?? "/"}
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

  const actions = isResponsible ? (
    <button
      type="button"
      aria-label={t("groups.manage")}
      {...onlineAction.offlineProps}
      onClick={onlineAction.guard(() => {
        setManageError(null);
        setVisibility(currentVisibility);
        setManageOpen(true);
      })}
      className="grid size-11 place-items-center rounded-pill text-accent hover:bg-surface-2 aria-disabled:cursor-not-allowed aria-disabled:text-text-disabled aria-disabled:hover:bg-transparent"
    >
      <Pencil aria-hidden="true" className="size-5" strokeWidth={1.75} />
    </button>
  ) : undefined;

  return (
    <>
      <LargeTitleHeader
        title={name}
        subtitle={balances ? subtitle : undefined}
        titleAccessory={
          isRoot ? <NotificationBell variant={NotificationBellVariant.Header} className="md:hidden" /> : undefined
        }
        backTo={backTo}
        backLabel={backLabel}
        actions={actions}
      />

      {!balances ? (
        <div aria-busy="true">
          <span className="sr-only" role="status">
            {t("app.loading")}
          </span>
          <BalanceHeroSkeleton />
        </div>
      ) : (
        <>
          {balances.totalBrl !== null ? (
            <BalanceHero
              label={t("balances.familyTotal")}
              totalCents={toCents(balances.totalBrl)}
              btcExcluded={balances.btcExcluded}
              quote={balances.quote}
              quoteStatus={quoteStatus}
              btcExcludedBody={t("balances.btcExcludedBody")}
            />
          ) : null}

          {detailLevel === DetailLevel.Summary ? (
            <Banner tone="info" title={t("balances.summaryTitle")} className="mt-4">
              {t("balances.summaryBody")}
            </Banner>
          ) : null}

          {detailLevel === DetailLevel.Hidden ? (
            <div className="flex items-start gap-2.5 rounded-md bg-info-soft p-3 text-footnote text-info">
              <EyeOff aria-hidden="true" className="mt-px size-[18px] shrink-0" />
              <span>
                <b className="mb-0.5 block font-semibold text-text">{t("balances.hiddenTitle")}</b>
                {t("balances.hiddenBody", { name: responsibleName })}
              </span>
            </div>
          ) : null}

          <section aria-labelledby={membersHeadingId} className="mt-7">
            <div className="flex min-h-touch items-center gap-2 px-4">
              <h2
                id={membersHeadingId}
                className="m-0 text-footnote font-semibold tracking-wider text-text-muted uppercase"
              >
                {t("balances.members")}
              </h2>
              {isResponsible ? (
                <SectionHeaderAction
                  ref={addMemberRef}
                  aria-haspopup="dialog"
                  className="-mr-2 ml-auto"
                  icon={<UserPlus className="size-[18px]" strokeWidth={1.75} />}
                  {...onlineAction.offlineProps}
                  onClick={onlineAction.guard(() => {
                    setAddKey((key) => key + 1);
                    setAddOpen(true);
                  })}
                >
                  {t("groups.addMember.open")}
                </SectionHeaderAction>
              ) : null}
            </div>
            <div className="overflow-hidden rounded-lg bg-surface">
              {balances.members.map((member, index) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  index={index}
                  detailLevel={detailLevel}
                  currentUserId={userId}
                  linkState={childState}
                />
              ))}
            </div>
            {!isResponsible ? (
              <p className="m-0 px-4 pt-2 text-footnote text-text-muted">{t("groups.members.onlyResponsible")}</p>
            ) : null}
          </section>

          <PendingInvitations
            groupId={groupId}
            groupName={name}
            isResponsible={isResponsible}
            invitations={pending}
            emptyFocusRef={addMemberRef}
            onCanceled={(invitationId) => {
              setPending((prev) => prev.filter((item) => item.invitationId !== invitationId));
              void loadPending();
            }}
          />

        </>
      )}

      {isResponsible ? (
        <AddMemberSheet
          key={addKey}
          open={addOpen}
          onOpenChange={setAddOpen}
          groupId={groupId}
          groupName={name}
          pendingInvitations={pending}
          onChanged={() => void load()}
        />
      ) : null}

      {isResponsible && group ? (
        <Sheet
          open={manageOpen}
          onOpenChange={(open) => {
            setManageOpen(open);
            // Membros podem ter mudado: recarrega os saldos ao fechar
            if (!open) void load();
          }}
          title={t("groups.manage")}
          tall
          leading={<span />}
          trailing={
            <SheetHeaderButton
              onClick={() => {
                setManageOpen(false);
                void load();
              }}
            >
              <span className="px-2 font-semibold">{t("statement.ok")}</span>
            </SheetHeaderButton>
          }
        >
          <div className="flex flex-col gap-6">
            {manageError ? (
              <Banner tone="error" role="alert">
                {manageError}
              </Banner>
            ) : null}

            <section className="flex flex-col gap-3">
              <GroupForm
                key={group.name}
                formId={renameFormId}
                initialName={group.name}
                onSubmit={(newName) => void rename(newName)}
                disabled={savingName}
              />
              <Button
                type="submit"
                form={renameFormId}
                variant="secondary"
                size="sm"
                loading={savingName}
                loadingLabel={t("actions.saving")}
                className="self-start"
              >
                {t("groups.saveName")}
              </Button>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="m-0 px-4 text-footnote font-semibold tracking-wider text-text-muted uppercase">
                {t("groups.visibilityTitle")}
              </h3>
              <VisibilityPicker
                label={t("groups.visibilityTitle")}
                value={visibility}
                onChange={setVisibility}
                disabled={savingVisibility}
              />
              <p className="m-0 px-4 text-footnote text-text-muted">
                {t("groups.visibilityFooter", { family: group.name })}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                loading={savingVisibility}
                loadingLabel={t("actions.saving")}
                disabled={visibility === currentVisibility}
                onClick={() => void saveVisibility()}
              >
                {t("groups.saveVisibility")}
              </Button>
            </section>

            <MemberManager group={group} currentUserId={userId} />
          </div>
        </Sheet>
      ) : null}
    </>
  );
};

export default GroupPage;
