import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, WalletCards } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LargeTitleHeader } from "../components/layout/LargeTitleHeader";
import { AppTab } from "../components/layout/navigation";
import { NotificationBell } from "../components/notification/NotificationBell";
import { InstallInvite } from "../components/pwa/InstallInvite";
import { OfflineContent } from "../components/pwa/OfflineContent";
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
import { useOnReconnected } from "../hooks/useOnReconnected";
import { isOfflineError } from "../types/api";
import { useWallet } from "../hooks/useWallet";
import { QuoteStatus } from "../types/quote";
import { TransactionKind } from "../types/transaction";
import { formatLongDate } from "../utils/dates";
import { computeHomeTotal } from "../utils/totals";
import { TRANSACTION_PATHS } from "../utils/transactionRoutes";
import { groupWallets } from "../utils/walletGrouping";

/** Parâmetro do atalho antigo do manifest (`/?acao=novo-lancamento`) */
const ACTION_PARAM = "acao";
const NEW_TRANSACTION_ACTION = "novo-lancamento";

enum LoadPhase {
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}

/** Home (rota `/`): saldo total + as carteiras da pessoa, por família e avulsas (US1) */
const HomePage = () => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { wallets, loaded: walletsLoaded, loadWallets } = useWallet();
  const { groups, loadGroups } = useGroup();
  const { quote, status: quoteStatus, cached: quoteCached, loadQuote } = useQuote();
  const [phase, setPhase] = useState<LoadPhase>(LoadPhase.Loading);
  const [loadError, setLoadError] = useState<unknown>(null);

  // Carteiras, famílias e cotação em paralelo (SC-001); a cotação nunca derruba a tela
  const load = useCallback(async () => {
    setPhase(LoadPhase.Loading);
    // "Sem internet" fica na tela durante a nova tentativa (REVIEW-005 M-5)
    setLoadError((previous: unknown) => (isOfflineError(previous) ? previous : null));
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
      setLoadError(null);
      setPhase(LoadPhase.Ready);
    }
  }, [loadWallets, loadGroups, loadQuote]);

  useEffect(() => {
    void load();
  }, [load]);

  // Conexão voltou: recarrega o que a Home mostra (FR-012)
  useOnReconnected(() => {
    void load();
  });

  // Atalho antigo do app instalado (`/?acao=novo-lancamento`): leva à página Depositar
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const action = searchParams.get(ACTION_PARAM);
  useEffect(() => {
    if (action === NEW_TRANSACTION_ACTION) navigate(TRANSACTION_PATHS[TransactionKind.Income], { replace: true });
  }, [action, navigate]);

  const userId = session?.user.userId ?? null;
  // Só as carteiras ativas de que a pessoa é titular (as dos outros membros ficam na página da família)
  const activeWallets = useMemo(
    () => wallets.filter((w) => w.isActive && w.ownerUserId === userId),
    [wallets, userId],
  );
  const quoteAvailable = quoteStatus === QuoteStatus.Available || quoteStatus === QuoteStatus.Stale;
  const total = useMemo(
    () => computeHomeTotal(activeWallets, userId ?? -1, quoteAvailable),
    [activeWallets, userId, quoteAvailable],
  );
  const sections = useMemo(
    () => groupWallets(activeWallets, groups, t("home.looseSection")),
    [activeWallets, groups, t],
  );

  const offlineRetry = phase === LoadPhase.Loading && isOfflineError(loadError);
  const showOffline = (phase === LoadPhase.Error || offlineRetry) && isOfflineError(loadError);
  const showSkeleton = phase === LoadPhase.Loading && !walletsLoaded && !offlineRetry;
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
      ) : showOffline ? (
        <OfflineContent className="pt-16" retrying={offlineRetry} onRetry={() => void load()} />
      ) : phase === LoadPhase.Error ? (
        <ErrorState className="pt-16" error={loadError} onRetry={() => void load()} />
      ) : (
        <>
          <BalanceHero
            totalCents={total.totalCents}
            btcExcluded={total.btcExcluded}
            quote={quote}
            quoteStatus={quoteStatus}
            quoteFromCache={quoteCached}
          />

          {/* Convite de instalação (feature 005): só depois de os dados carregarem */}
          {phase === LoadPhase.Ready ? <InstallInvite /> : null}

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
