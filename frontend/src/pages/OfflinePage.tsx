import { useContext, useEffect, useRef, useState } from "react";
import { RotateCw, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import ConnectivityContext from "../Contexts/ConnectivityContext";
import { Logo } from "../components/brand/Logo";
import { UpdatePrompt } from "../components/pwa/UpdatePrompt";
import { Button } from "../components/ui/Button";
import { UpdatePromptPlacement } from "../components/ui/variants";
import { ConnectivityStatus } from "../types/connectivity";
import { getStatus } from "../utils/connectivity";

export interface OfflinePageProps {
  /** Substitui o "Tentar de novo" padrão (conferir a conexão e recarregar) */
  onRetry?: () => void;
}

/**
 * Abertura sem internet, sem sessão verificável e sem dado guardado (FR-013, components.md §9).
 * Tela inteira sem abas; o foco começa no título para o leitor de tela ler a situação primeiro.
 * "Tentar de novo" confere a conexão antes de recarregar: ainda offline, a tela fica e o foco
 * volta ao título (REVIEW-005 B-4).
 */
const OfflinePage = ({ onRetry }: OfflinePageProps) => {
  const { t } = useTranslation();
  const connectivity = useContext(ConnectivityContext);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Título da página (WCAG 2.4.2)
  useEffect(() => {
    const previous = document.title;
    document.title = t("pwa.offline.pageDocumentTitle");
    return () => {
      document.title = previous;
    };
  }, [t]);

  const retry = async () => {
    if (onRetry) {
      onRetry();
      return;
    }
    if (!connectivity) {
      window.location.reload();
      return;
    }
    setChecking(true);
    await connectivity.checkConnection();
    setChecking(false);
    if (getStatus() === ConnectivityStatus.Online) {
      window.location.reload();
      return;
    }
    headingRef.current?.focus();
  };

  return (
    <>
      <main className="grid min-h-dvh place-items-center bg-bg px-gutter pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+var(--update-prompt-h,0px)+min(var(--update-prompt-h,0px),1px)*24)]">
        <div className="flex max-w-auth flex-col items-center gap-2 text-center">
          <Logo className="h-14" />
          <span
            aria-hidden="true"
            className="mt-8 mb-2 grid size-16 place-items-center rounded-pill bg-warning-soft text-warning"
          >
            <WifiOff className="size-[30px]" strokeWidth={1.75} />
          </span>
          <h1 ref={headingRef} tabIndex={-1} className="m-0 text-title-2 focus:outline-none">
            {t("pwa.offline.pageTitle")}
          </h1>
          <p className="m-0 mb-4 max-w-[30ch] text-body text-text-muted">{t("pwa.offline.pageBody")}</p>
          <Button
            icon={<RotateCw className="size-5" strokeWidth={1.75} />}
            loading={checking}
            loadingLabel={t("pwa.offline.checking")}
            onClick={() => void retry()}
          >
            {t("pwa.offline.retry")}
          </Button>
        </div>
      </main>
      <UpdatePrompt placement={UpdatePromptPlacement.Bare} />
    </>
  );
};

export default OfflinePage;
