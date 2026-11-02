import { useEffect, useRef } from "react";
import { RotateCw, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";
import { Button } from "../ui/Button";
import { ButtonSize, ButtonVariant } from "../ui/variants";

export interface OfflineContentProps {
  onRetry: () => void;
  /** Nova tentativa em andamento: o botão fica ocupado e o trecho continua montado */
  retrying?: boolean;
  className?: string;
}

/**
 * Trecho/tela sem dado guardado e sem internet (contracts/ui.md, components.md §9). Mesma
 * anatomia do `ErrorState`, mas `role="status"`: não é erro da pessoa. As telas mantêm este
 * trecho durante "Tentar de novo" (`retrying`); se a tentativa falhar e o foco tiver se perdido
 * (o botão fica desabilitado enquanto carrega), ele volta para "Tentar de novo" (REVIEW-005 M-5).
 */
export const OfflineContent = ({ onRetry, retrying = false, className }: OfflineContentProps) => {
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasRetrying = useRef(retrying);

  useEffect(() => {
    const finished = wasRetrying.current && !retrying;
    wasRetrying.current = retrying;
    if (!finished) return;
    const active = document.activeElement;
    if (active === null || active === document.body || active === buttonRef.current) {
      buttonRef.current?.focus();
    }
  }, [retrying]);

  return (
    <div role="status" className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}>
      <span
        aria-hidden="true"
        className="mb-2 grid size-[72px] place-items-center rounded-pill bg-surface-2 text-text-muted"
      >
        <WifiOff className="size-9" strokeWidth={1.75} />
      </span>
      <h2 className="m-0 text-headline">{t("pwa.offline.contentUnavailable")}</h2>
      <p className="m-0 mb-3 max-w-[32ch] text-subhead text-text-muted">{t("pwa.offline.contentUnavailableHint")}</p>
      <Button
        ref={buttonRef}
        variant={ButtonVariant.Secondary}
        size={ButtonSize.Sm}
        icon={<RotateCw className="size-5" strokeWidth={1.75} />}
        loading={retrying}
        onClick={onRetry}
      >
        {t("pwa.offline.retry")}
      </Button>
    </div>
  );
};

export default OfflineContent;
