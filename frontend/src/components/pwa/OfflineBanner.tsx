import { useRef } from "react";
import { WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConnectivity } from "../../hooks/useConnectivity";
import { useCssHeightVar } from "../../hooks/useCssHeightVar";
import { cn } from "../../utils/cn";
import { formatDayMonth, formatTime } from "../../utils/dates";

/** Variável CSS com a altura da faixa (desloca cabeçalho compacto e toasts) */
export const OFFLINE_BANNER_HEIGHT_VAR = "--offline-banner-h";

/**
 * Faixa "Sem internet · dados de 01/11 às 18:42" (contracts/ui.md, components.md §9).
 * A região viva (`role="status"`) fica sempre montada e só o conteúdo entra e sai, para o
 * anúncio funcionar em todos os leitores de tela. Não é focável e não tem botões.
 */
export const OfflineBanner = () => {
  const { t } = useTranslation();
  const { showBanner, staleSince } = useConnectivity();
  const ref = useRef<HTMLDivElement>(null);
  useCssHeightVar(ref, OFFLINE_BANNER_HEIGHT_VAR, showBanner);

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn(
        showBanner &&
          [
            // Sangra até as bordas: desfaz o `px-gutter-safe` do conteúdo (inclusive no iPhone deitado)
            "sticky top-0 z-30 -mt-[env(safe-area-inset-top)] pt-[env(safe-area-inset-top)]",
            "-ml-[max(var(--spacing-gutter),env(safe-area-inset-left))] -mr-[max(var(--spacing-gutter),env(safe-area-inset-right))]",
            "border-b border-warning/30 bg-warning-soft motion-safe:animate-fade-in",
            "md:top-4 md:mx-0 md:mt-0 md:mb-4 md:rounded-lg md:border md:pt-0",
          ].join(" "),
      )}
    >
      {showBanner ? (
        <p className="m-0 flex min-h-9 items-center gap-2 px-gutter-safe py-2 text-footnote text-text md:px-4">
          <WifiOff aria-hidden="true" className="size-4 shrink-0 text-warning" strokeWidth={2} />
          <span>
            <span className="font-semibold">{t("pwa.offline.banner")}</span>
            {staleSince ? (
              <>
                <span aria-hidden="true" className="text-warning">
                  {" · "}
                </span>
                <span className="sr-only">, </span>
                <time dateTime={staleSince}>
                  {t("pwa.offline.staleData", {
                    date: formatDayMonth(staleSince),
                    time: formatTime(staleSince),
                  })}
                </time>
              </>
            ) : null}
          </span>
        </p>
      ) : null}
    </div>
  );
};

export default OfflineBanner;
