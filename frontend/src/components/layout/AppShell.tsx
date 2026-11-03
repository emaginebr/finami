import { Suspense, useEffect } from "react";
import { Outlet, matchPath, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useNotification } from "../../hooks/useNotification";
import { cn } from "../../utils/cn";
import { OfflineBanner } from "../pwa/OfflineBanner";
import { UpdatePrompt } from "../pwa/UpdatePrompt";
import { Fab } from "./Fab";
import { PageLoading } from "./PageLoading";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

/**
 * Rotas do shell **sem** o botão "+": as próprias telas de lançamento (feature 006, FR-024).
 * Todas as demais rotas do shell mostram o Fab (a `/autorizar` já fica fora do shell).
 */
const FAB_EXCLUDED_ROUTES = ["/depositar", "/sacar", "/transferir"];

/** Extrato de carteira: a carteira vai pré-selecionada no lançamento (FR-025) */
const WALLET_STATEMENT_ROUTE = "/carteiras/:walletId";

interface FabTarget {
  show: boolean;
  /** Carteira aberta no extrato, pré-selecionada na página do lançamento */
  walletId: number | null;
}

const fabTargetFor = (pathname: string): FabTarget => {
  const excluded = FAB_EXCLUDED_ROUTES.some((pattern) => matchPath({ path: pattern, end: true }, pathname));
  if (excluded) return { show: false, walletId: null };
  const match = matchPath({ path: WALLET_STATEMENT_ROUTE, end: true }, pathname);
  const id = Number(match?.params.walletId);
  return { show: true, walletId: Number.isInteger(id) && id > 0 ? id : null };
};

/**
 * Casca do app (components.md §1): TabBar (< 768 px) ou Sidebar (≥ 768 px),
 * `<main>` com largura máxima de 720 px e o Fab (menu Depositar · Sacar · Transferir).
 */
export const AppShell = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const fab = fabTargetFor(location.pathname);
  const { refreshUnreadIfStale } = useNotification();

  // Contador do sino atualizado a cada troca de tela (no máximo 1 vez a cada 10 s — R-06)
  useEffect(() => {
    refreshUnreadIfStale();
  }, [location.pathname, refreshUnreadIfStale]);

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
            // + espaço do aviso de nova versão quando visível (`--update-prompt-h` + 12 px, components.md §9)
            fab.show
              ? "pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+88px+var(--update-prompt-h,0px)+min(var(--update-prompt-h,0px),1px)*12)]"
              : "pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+24px+var(--update-prompt-h,0px)+min(var(--update-prompt-h,0px),1px)*12)]",
            // Desktop: o cartão de versão (canto inferior direito) não cobre as últimas linhas (M-6)
            "md:pb-[calc(6rem+var(--update-prompt-h,0px)+min(var(--update-prompt-h,0px),1px)*24)]",
          )}
        >
          {/* Feature 005: faixa "Sem internet" (região viva sempre montada) */}
          <OfflineBanner />
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      {/* Aviso de nova versão: na ordem de foco depois do conteúdo e antes da TabBar (REVIEW-005 M-6) */}
      <UpdatePrompt />
      <TabBar />
      {/* Remonta a cada tela: o menu do "+" sempre começa fechado */}
      {fab.show ? <Fab key={location.pathname} walletId={fab.walletId} /> : null}
    </div>
  );
};

export default AppShell;
