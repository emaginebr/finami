import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronRight, Plus, Users, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GroupForm } from "../components/group/GroupForm";
import { LargeTitleHeader } from "../components/layout/LargeTitleHeader";
import { AppTab } from "../components/layout/navigation";
import { NotificationBell } from "../components/notification/NotificationBell";
import { OfflineContent } from "../components/pwa/OfflineContent";
import { NotificationBellVariant } from "../components/ui/variants";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Sheet } from "../components/ui/Sheet";
import { Skeleton } from "../components/ui/Skeleton";
import { listRowClasses } from "../components/ui/listRow";
import { WalletCard, WalletCardSkeleton } from "../components/wallet/WalletCard";
import { WalletForm } from "../components/wallet/WalletForm";
import type { WalletFormValues } from "../components/wallet/WalletForm";
import { WalletSection } from "../components/wallet/WalletSection";
import { useAuth } from "../hooks/useAuth";
import { useGroup } from "../hooks/useGroup";
import { useQuote } from "../hooks/useQuote";
import { useWallet } from "../hooks/useWallet";
import { useOnReconnected } from "../hooks/useOnReconnected";
import { useOnlineAction } from "../hooks/useOnlineAction";
import { isOfflineError } from "../types/api";
import type { GroupInfo } from "../types/group";
import { cn } from "../utils/cn";
import { familyColorClass } from "../utils/familyColors";
import { errorMessage, notifySuccess } from "../utils/notify";
import { isQuoteUsable } from "../utils/quote";
import { groupWallets } from "../utils/walletGrouping";

enum LoadPhase {
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}

const collator = new Intl.Collator("pt-BR");

/** Aba Carteiras (rota `/carteiras`) — US4, mockup wallets.html */
const WalletsPage = () => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { wallets, loaded: walletsLoaded, loadWallets, createWallet } = useWallet();
  const { groups, loadGroups, createGroup } = useGroup();
  const { status: quoteStatus, loadQuote } = useQuote();
  const walletFormId = useId();
  const groupFormId = useId();
  const inactiveListId = useId();
  const familiesHeadingId = useId();
  const onlineAction = useOnlineAction();

  const [phase, setPhase] = useState<LoadPhase>(LoadPhase.Loading);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase(LoadPhase.Loading);
    const [walletsResult, groupsResult] = await Promise.allSettled([
      loadWallets({ includeInactive: true }),
      loadGroups(),
      loadQuote(),
    ]);
    const failure = [walletsResult, groupsResult].find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failure) {
      setLoadError(failure.reason);
      setPhase(LoadPhase.Error);
    } else {
      setLoadError(null);
      setPhase(LoadPhase.Ready);
    }
  }, [loadWallets, loadGroups, loadQuote]);

  useEffect(() => {
    void load();
  }, [load]);

  // Conexão voltou: recarrega a lista (FR-012)
  useOnReconnected(() => {
    void load();
  });

  const userId = session?.user.userId ?? null;
  const quoteAvailable = isQuoteUsable(quoteStatus);
  const sortedGroups = useMemo(() => [...groups].sort((a, b) => collator.compare(a.name, b.name)), [groups]);
  const activeWallets = useMemo(() => wallets.filter((w) => w.isActive), [wallets]);
  const inactiveWallets = useMemo(
    () => wallets.filter((w) => !w.isActive).sort((a, b) => collator.compare(a.name, b.name)),
    [wallets],
  );
  const sections = useMemo(
    () => groupWallets(activeWallets, groups, t("home.looseSection")),
    [activeWallets, groups, t],
  );

  const responsibleName = (group: GroupInfo) => {
    const responsible = group.members.find((m) => m.userId === group.responsibleUserId);
    return responsible ? `${responsible.firstName} ${responsible.lastName}` : "";
  };

  // Criar carteira/família exige internet (feature 005): aria-disabled + aviso
  const openWalletSheet = onlineAction.guard(() => {
    setFormError(null);
    setWalletSheetOpen(true);
  });

  const openGroupSheet = onlineAction.guard(() => {
    setFormError(null);
    setGroupSheetOpen(true);
  });

  const submitWallet = async (values: WalletFormValues) => {
    setSaving(true);
    setFormError(null);
    try {
      const created = await createWallet({
        name: values.name,
        description: values.description,
        currency: values.currency,
        isVirtual: values.isVirtual,
        ownerUserId: values.ownerUserId,
        groupId: values.groupId,
      });
      setWalletSheetOpen(false);
      notifySuccess(t("wallets.created", { name: created.name }));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submitGroup = async (name: string) => {
    setSaving(true);
    setFormError(null);
    try {
      const created = await createGroup({ name });
      setGroupSheetOpen(false);
      notifySuccess(t("groups.created", { name: created.name }));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const familySectionIndex = (groupId: number | null) =>
    sections.filter((s) => s.groupId !== null).findIndex((s) => s.groupId === groupId);

  // "Sem internet" fica na tela durante a nova tentativa (REVIEW-005 M-5)
  const offlineRetry = phase === LoadPhase.Loading && isOfflineError(loadError);
  const showOffline = (phase === LoadPhase.Error || offlineRetry) && isOfflineError(loadError);
  const showSkeleton = phase === LoadPhase.Loading && !walletsLoaded && !offlineRetry;

  return (
    <>
      <LargeTitleHeader
        title={t("nav.wallets")}
        titleAccessory={<NotificationBell variant={NotificationBellVariant.Header} className="md:hidden" />}
      />

      <div className="mt-3 mb-1 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="size-5" strokeWidth={1.75} />}
          {...onlineAction.offlineProps}
          onClick={openWalletSheet}
        >
          {t("wallets.new")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Users className="size-5" strokeWidth={1.75} />}
          {...onlineAction.offlineProps}
          onClick={openGroupSheet}
        >
          {t("groups.new")}
        </Button>
      </div>

      {showSkeleton ? (
        <div aria-busy="true" className="mt-7">
          <span className="sr-only" role="status">
            {t("app.loading")}
          </span>
          <div aria-hidden="true">
            <Skeleton className="mx-4 my-4 h-3 w-20" />
            <div className="overflow-hidden rounded-lg bg-surface">
              <WalletCardSkeleton />
              <WalletCardSkeleton />
            </div>
          </div>
        </div>
      ) : showOffline ? (
        <OfflineContent className="pt-16" retrying={offlineRetry} onRetry={() => void load()} />
      ) : phase === LoadPhase.Error ? (
        <ErrorState className="pt-16" error={loadError} onRetry={() => void load()} />
      ) : (
        <>
          <section aria-labelledby={familiesHeadingId} className="mt-7">
            <h2
              id={familiesHeadingId}
              className="m-0 flex min-h-touch items-center px-4 text-footnote font-semibold tracking-wider text-text-muted uppercase"
            >
              {t("groups.families")}
            </h2>
            {sortedGroups.length === 0 ? (
              <div className="rounded-lg bg-surface">
                <EmptyState
                  icon={Users}
                  headingLevel={3}
                  className="py-7"
                  title={t("groups.emptyTitle")}
                  description={t("groups.emptyBody")}
                  action={
                    // Secundário: as ações principais já estão no topo da tela (REVIEW W-1)
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus className="size-5" strokeWidth={1.75} />}
                      {...onlineAction.offlineProps}
                      onClick={openGroupSheet}
                    >
                      {t("groups.new")}
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg bg-surface">
                {sortedGroups.map((group, index) => (
                  <Link
                    key={group.groupId}
                    to={`/familias/${group.groupId}`}
                    state={{ tab: AppTab.Wallets }}
                    className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-md text-on-family",
                        familyColorClass(index),
                      )}
                    >
                      <Users className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-headline break-words hyphens-auto">{group.name}</span>
                      <span className="mt-0.5 block truncate text-footnote text-text-muted">
                        {t("groups.memberCount", { count: group.members.length })}
                        {" · "}
                        {group.isResponsible ? (
                          <Badge variant="responsible">{t("badges.responsible")}</Badge>
                        ) : (
                          t("groups.responsibleIs", { name: responsibleName(group) })
                        )}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {sections.length === 0 && inactiveWallets.length === 0 ? (
            <EmptyState
              icon={WalletCards}
              className="py-8"
              title={t("home.emptyTitle")}
              description={t("home.emptyBody")}
            />
          ) : null}

          {sections.map((section) => (
            <WalletSection
              key={section.key}
              section={section}
              colorIndex={familySectionIndex(section.groupId)}
              currentUserId={userId}
              quoteAvailable={quoteAvailable}
              fromTab={AppTab.Wallets}
              linkHeader={false}
            />
          ))}

          {inactiveWallets.length > 0 ? (
            <section className="mt-7">
              <div className="overflow-hidden rounded-lg bg-surface">
                <button
                  type="button"
                  aria-expanded={showInactive}
                  aria-controls={inactiveListId}
                  onClick={() => setShowInactive((open) => !open)}
                  className={listRowClasses({ withIcon: true, interactive: true })}
                >
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-3 text-text-muted">
                    <Archive className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 text-body">
                    {t("wallets.inactive", { count: inactiveWallets.length })}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("size-[18px] shrink-0 text-text-subtle motion-safe:transition-transform", showInactive && "rotate-180")}
                  />
                </button>
              </div>
              <div id={inactiveListId} hidden={!showInactive} className="mt-2 overflow-hidden rounded-lg bg-surface">
                {showInactive
                  ? inactiveWallets.map((wallet) => (
                      <WalletCard
                        key={wallet.walletId}
                        wallet={wallet}
                        currentUserId={userId}
                        quoteAvailable={quoteAvailable}
                        fromTab={AppTab.Wallets}
                        showInactive
                      />
                    ))
                  : null}
              </div>
            </section>
          ) : null}
        </>
      )}

      <Sheet
        open={walletSheetOpen}
        onOpenChange={(open) => !saving && setWalletSheetOpen(open)}
        title={t("wallets.new")}
        dismissible={!saving}
        tall
        footer={
          <Button type="submit" form={walletFormId} block loading={saving} loadingLabel={t("actions.saving")}>
            {t("wallets.create")}
          </Button>
        }
      >
        <WalletForm
          formId={walletFormId}
          groups={sortedGroups}
          currentUserId={userId}
          onSubmit={(values) => void submitWallet(values)}
          disabled={saving}
          serverError={formError}
        />
      </Sheet>

      <Sheet
        open={groupSheetOpen}
        onOpenChange={(open) => !saving && setGroupSheetOpen(open)}
        title={t("groups.new")}
        dismissible={!saving}
        footer={
          <Button type="submit" form={groupFormId} block loading={saving} loadingLabel={t("actions.saving")}>
            {t("groups.create")}
          </Button>
        }
      >
        <GroupForm
          formId={groupFormId}
          showResponsibleHint
          onSubmit={(name) => void submitGroup(name)}
          disabled={saving}
          serverError={formError}
        />
      </Sheet>
    </>
  );
};

export default WalletsPage;
