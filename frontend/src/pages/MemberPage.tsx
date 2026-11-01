import { useCallback, useEffect, useState } from "react";
import { ChevronRight, EyeOff } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LargeTitleHeader } from "../components/layout/LargeTitleHeader";
import { AppTab, readNavState } from "../components/layout/navigation";
import type { NavState } from "../components/layout/navigation";
import { Avatar } from "../components/ui/Avatar";
import { ErrorState } from "../components/ui/ErrorState";
import { listRowClasses } from "../components/ui/listRow";
import { BalanceHero, BalanceHeroSkeleton } from "../components/wallet/BalanceHero";
import { WalletBalanceRow } from "../components/wallet/WalletBalanceRow";
import { useBalance } from "../hooks/useBalance";
import { useQuote } from "../hooks/useQuote";
import { useTransaction } from "../hooks/useTransaction";
import { ApiError, isApiError } from "../types/api";
import { DetailLevel } from "../types/balance";
import type { UserGroupBalancesResult } from "../types/balance";
import { familyColorClass } from "../utils/familyColors";
import { formatBrl, toCents } from "../utils/money";
import { isQuoteUsable } from "../utils/quote";

/** Membro (rota `/pessoas/:userId`): carteiras nas famílias que quem vê pode ver (US5) */
const MemberPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navState = readNavState(location.state);
  const { userId: userIdParam } = useParams();
  const userId = Number(userIdParam);
  const validId = Number.isInteger(userId) && userId > 0;

  const { getUserGroupBalances } = useBalance();
  const { quote, status: quoteStatus, loadQuote } = useQuote();
  const { ledgerVersion } = useTransaction();
  const [result, setResult] = useState<UserGroupBalancesResult | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  const load = useCallback(async () => {
    if (!validId) {
      setLoadError(new ApiError(404, t("errors.notFound")));
      return;
    }
    setLoadError(null);
    try {
      setResult(await getUserGroupBalances(userId));
    } catch (err) {
      setLoadError(err);
    }
  }, [getUserGroupBalances, userId, validId, t]);

  useEffect(() => {
    void load();
  }, [load, ledgerVersion]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const backTo = navState.backTo ?? "/carteiras";
  const backLabel = navState.backLabel ?? t("nav.wallets");
  const quoteAvailable = isQuoteUsable(quoteStatus) && !(result?.btcExcluded ?? false);

  if (loadError) {
    const notFound = isApiError(loadError) && (loadError.status === 404 || loadError.status === 403);
    return (
      <>
        <LargeTitleHeader title={t("balances.memberFallback")} backTo={backTo} backLabel={backLabel} />
        <ErrorState
          error={loadError}
          title={notFound ? t("errors.notFoundTitle") : undefined}
          message={notFound ? t("balances.memberNotFound") : undefined}
          onRetry={notFound ? undefined : () => void load()}
          action={
            notFound ? (
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

  if (!result) {
    return (
      <>
        <LargeTitleHeader title={t("balances.memberFallback")} backTo={backTo} backLabel={backLabel} />
        <div aria-busy="true">
          <span className="sr-only" role="status">
            {t("app.loading")}
          </span>
          <BalanceHeroSkeleton />
        </div>
      </>
    );
  }

  const name = `${result.firstName} ${result.lastName}`.trim();
  const childState = (groupName: string, groupId: number): NavState => ({
    tab: navState.tab ?? AppTab.Wallets,
    backTo: `/familias/${groupId}`,
    backLabel: groupName,
  });

  return (
    <>
      {/* Avatar à esquerda do nome (REVIEW M-1), na mesma cor da tela de origem (M-2) */}
      <LargeTitleHeader
        title={name}
        backTo={backTo}
        backLabel={backLabel}
        leading={<Avatar name={name} colorIndex={navState.colorIndex ?? result.userId} size="lg" />}
        subtitle={<span className="text-footnote">{t("balances.memberOf", { count: result.groups.length })}</span>}
      />

      <BalanceHero
        label={t("balances.memberTotal")}
        totalCents={toCents(result.totalBrl)}
        btcExcluded={result.btcExcluded}
        quote={quote}
        quoteStatus={quoteStatus}
        btcExcludedBody={t("balances.btcExcludedBody")}
      />

      {result.groups.map((group, index) => {
        const headingId = `member-group-${group.groupId}`;
        return (
          <section key={group.groupId} aria-labelledby={headingId} className="mt-7">
            <Link
              to={`/familias/${group.groupId}`}
              state={{ tab: navState.tab ?? AppTab.Wallets }}
              className="flex min-h-touch items-start gap-2 px-4 py-[13px] text-footnote font-semibold tracking-wider text-text-muted uppercase no-underline hover:text-text"
            >
              <span aria-hidden="true" className={"mt-1 size-2.5 shrink-0 rounded-pill " + familyColorClass(index)} />
              <h2 id={headingId} className="m-0 line-clamp-2 min-w-0 break-words hyphens-auto">
                {group.name}
              </h2>
              <ChevronRight aria-hidden="true" className="mt-0.5 ml-0.5 size-3.5 shrink-0" />
              <span className="ml-auto shrink-0 font-medium tracking-normal whitespace-nowrap normal-case tabular-nums">
                {formatBrl(group.totalBrl)}
              </span>
            </Link>
            <div className="overflow-hidden rounded-lg bg-surface">
              {group.detailLevel === DetailLevel.Full ? (
                group.wallets.map((wallet) => (
                  <WalletBalanceRow
                    key={wallet.walletId}
                    wallet={wallet}
                    quoteAvailable={quoteAvailable}
                    linkState={childState(group.name, group.groupId)}
                  />
                ))
              ) : (
                <div className={listRowClasses({ twoLines: true, withIcon: true })}>
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-3 text-text-muted">
                    <EyeOff className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body">{t("balances.onlyTotal")}</span>
                    <span className="mt-0.5 block text-footnote text-text-muted">{t("balances.onlyTotalHint")}</span>
                  </span>
                  <span className="shrink-0 text-headline whitespace-nowrap tabular-nums">{formatBrl(group.totalBrl)}</span>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
};

export default MemberPage;
