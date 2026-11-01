import { Suspense } from "react";
import { Outlet, matchPath, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUi } from "../../hooks/useUi";
import { cn } from "../../utils/cn";
import { TransactionSheet } from "../transaction/TransactionSheet";
import { Fab } from "./Fab";
import { PageLoading } from "./PageLoading";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

/** Rotas com o botão "+" (FR-009) */
const FAB_ROUTES = ["/", "/carteiras", "/carteiras/:walletId"];

interface FabTarget {
  show: boolean;
  /** Carteira aberta no extrato, pré-selecionada na folha */
  walletId: number | null;
}

const fabTargetFor = (pathname: string): FabTarget => {
  for (const pattern of FAB_ROUTES) {
    const match = matchPath({ path: pattern, end: true }, pathname);
    if (match) {
      const id = Number(match.params.walletId);
      return { show: true, walletId: Number.isInteger(id) && id > 0 ? id : null };
    }
  }
  return { show: false, walletId: null };
};

/**
 * Casca do app (components.md §1): TabBar (< 768 px) ou Sidebar (≥ 768 px),
 * `<main>` com largura máxima de 720 px, Fab e a folha de lançamento.
 */
export const AppShell = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const {
    transactionSheetOpen,
    transactionSheetWalletId,
    transactionSheetKey,
    openTransactionSheet,
    setTransactionSheetOpen,
  } = useUi();
  const fab = fabTargetFor(location.pathname);

  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-surface-2 px-4 py-3 text-text focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("app.skipToContent")}
      </a>
      <Sidebar />
      <main id="conteudo" tabIndex={-1} className="focus:outline-none md:pl-sidebar">
        <div
          className={cn(
            // Margem lateral respeita o recorte da tela no iPhone deitado (REVIEW G-4)
            "mx-auto w-full max-w-content px-gutter-safe pt-safe md:pr-gutter-lg md:pl-gutter-lg md:py-8",
            fab.show
              ? "pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+88px)]"
              : "pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+24px)]",
            "md:pb-24",
          )}
        >
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <TabBar />
      {fab.show ? (
        <Fab expanded={transactionSheetOpen} onClick={() => openTransactionSheet(fab.walletId)} />
      ) : null}
      <TransactionSheet
        key={transactionSheetKey}
        open={transactionSheetOpen}
        onOpenChange={setTransactionSheetOpen}
        defaultWalletId={transactionSheetWalletId}
      />
    </div>
  );
};

export default AppShell;
