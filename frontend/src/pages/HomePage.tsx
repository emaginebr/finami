import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LargeTitleHeader } from "../components/layout/LargeTitleHeader";
import { AppTab } from "../components/layout/navigation";
import { NotificationBell } from "../components/notification/NotificationBell";
import { NotificationBellVariant } from "../components/ui/variants";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Skeleton } from "../components/ui/Skeleton";
import { BalanceHero, BalanceHeroSkeleton } from "../components/wallet/BalanceHero";
import { WalletCardSkeleton } from "../components/wallet/WalletCard";
import { WalletSection } from "../components/wallet/WalletSection";
import { useAuth } from "../hooks/useAuth";
import { useGroup } from "../hooks/useGroup";
import { useQuote } from "../hooks/useQuote";
import { useWallet } from "../hooks/useWallet";
import { QuoteStatus } from "../types/quote";
import { formatLongDate } from "../utils/dates";
import { computeHomeTotal } from "../utils/totals";
import { groupWallets } from "../utils/walletGrouping";

enum LoadPhase {
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}

/** Home (rota `/`): saldo total + carteiras por família e avulsas (US1) */
const HomePage = () => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { wallets, loaded: walletsLoaded, loadWallets } = useWallet();
  const { groups, loadGroups } = useGroup();
  const { quote, status: quoteStatus, loadQuote } = useQuote();
  const [phase, setPhase] = useState<LoadPhase>(LoadPhase.Loading);
  const [loadError, setLoadError] = useState<unknown>(null);

  // Carteiras, famílias e cotação em paralelo (SC-001); a cotação nunca derruba a tela
  const load = useCallback(async () => {
    setPhase(LoadPhase.Loading);
    setLoadError(null);
    const [walletsResult, groupsResult] = await Promise.allSettled([
      loadWallets(),
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
      setPhase(LoadPhase.Ready);
    }
  }, [loadWallets, loadGroups, loadQuote]);

  useEffect(() => {
    void load();
  }, [load]);

  const userId = session?.user.userId ?? null;
  const activeWallets = useMemo(() => wallets.filter((w) => w.isActive), [wallets]);
  const quoteAvailable = quoteStatus === QuoteStatus.Available || quoteStatus === QuoteStatus.Stale;
  const total = useMemo(
    () => computeHomeTotal(activeWallets, userId ?? -1, quoteAvailable),
    [activeWallets, userId, quoteAvailable],
  );
  const sections = useMemo(
    () => groupWallets(activeWallets, groups, t("home.looseSection")),
    [activeWallets, groups, t],
  );

  const showSkeleton = phase === LoadPhase.Loading && !walletsLoaded;
  const familySectionIndex = (key: string) =>
    sections.filter((s) => s.groupId !== null).findIndex((s) => s.key === key);

  return (
    <>
      <LargeTitleHeader
        eyebrow={formatLongDate()}
        title={session ? t("home.greeting", { name: session.user.firstName }) : t("nav.home")}
        titleAccessory={<NotificationBell variant={NotificationBellVariant.Header} className="md:hidden" />}
      />

      {showSkeleton ? (
        <div aria-busy="true">
          <span className="sr-only" role="status">
            {t("app.loading")}
          </span>
          <BalanceHeroSkeleton />
          <div aria-hidden="true" className="mt-7">
            <Skeleton className="mx-4 my-4 h-3 w-20" />
            <div className="overflow-hidden rounded-lg bg-surface">
              <WalletCardSkeleton />
              <WalletCardSkeleton />
            </div>
          </div>
        </div>
      ) : phase === LoadPhase.Error ? (
        <ErrorState className="pt-16" error={loadError} onRetry={() => void load()} />
      ) : (
        <>
          <BalanceHero
            totalCents={total.totalCents}
            btcExcluded={total.btcExcluded}
            quote={quote}
            quoteStatus={quoteStatus}
          />

          {sections.length === 0 ? (
            <EmptyState
              icon={WalletCards}
              title={t("home.emptyTitle")}
              description={t("home.emptyBody")}
              action={
                <Link
                  to="/carteiras"
                  className="inline-flex min-h-touch items-center gap-2 rounded-md bg-accent px-4 text-subhead font-semibold text-on-accent no-underline hover:bg-accent-hover active:bg-accent-pressed"
                >
                  <Plus aria-hidden="true" className="size-5" strokeWidth={2} />
                  {t("home.createWallet")}
                </Link>
              }
            />
          ) : (
            sections.map((section) => (
              <WalletSection
                key={section.key}
                section={section}
                colorIndex={familySectionIndex(section.key)}
                currentUserId={userId}
                quoteAvailable={quoteAvailable}
                fromTab={AppTab.Home}
              />
            ))
          )}
        </>
      )}
    </>
  );
};

export default HomePage;
