import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { RotateCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Banner } from "./Banner";
import { Button } from "./Button";

export interface RetryBannerProps {
  /** Título em negrito da faixa (opcional) */
  title?: ReactNode;
  /** Texto do erro */
  children: ReactNode;
  /** Rótulo do botão (ex.: "Tentar de novo") */
  retryLabel: string;
  /** Nova tentativa em andamento: o botão fica em loading "Carregando…" no lugar */
  retrying: boolean;
  onRetry: () => void;
  /** Ícone no lugar do padrão (ex.: `WifiOff` em erro de rede) */
  icon?: LucideIcon;
  className?: string;
}

/**
 * Faixa de erro `role="alert"` com "Tentar de novo" dentro dela (mockups `c-net-load`/`k-error`).
 * Quem usa deve manter a faixa montada durante a nova tentativa: o botão entra em loading e,
 * se a tentativa falhar, o foco volta para ele (WCAG 2.4.3).
 */
export const RetryBanner = ({
  title,
  children,
  retryLabel,
  retrying,
  onRetry,
  icon,
  className,
}: RetryBannerProps) => {
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const requested = useRef(false);

  // O botão fica `disabled` durante a tentativa e o navegador pode tirar o foco dele
  useEffect(() => {
    if (retrying || !requested.current) return;
    requested.current = false;
    buttonRef.current?.focus();
  }, [retrying]);

  return (
    <Banner tone="error" role="alert" icon={icon} title={title} className={className}>
      <span className="block">{children}</span>
      <Button
        ref={buttonRef}
        variant="secondary"
        size="sm"
        className="mt-2"
        loading={retrying}
        loadingLabel={t("app.loading")}
        icon={<RotateCw className="size-[18px]" strokeWidth={1.75} />}
        onClick={() => {
          requested.current = true;
          onRetry();
        }}
      >
        {retryLabel}
      </Button>
    </Banner>
  );
};

export default RetryBanner;
