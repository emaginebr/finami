import type { ReactNode } from "react";
import { CircleAlert, Lock, RotateCw, SearchX, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isApiError } from "../../types/api";
import { cn } from "../../utils/cn";
import { Button } from "./Button";

export interface ErrorStateProps {
  /** Erro de origem: define ícone, título e texto quando não informados */
  error?: unknown;
  title?: string;
  message?: ReactNode;
  icon?: LucideIcon;
  /** Mostra "Tentar novamente" */
  onRetry?: () => void;
  /** Ação extra (ex.: "Voltar" no 404) */
  action?: ReactNode;
  className?: string;
}

/** Estado de erro (components.md §4) com `role="alert"` e "Tentar novamente" */
export const ErrorState = ({
  error,
  title,
  message,
  icon,
  onRetry,
  action,
  className,
}: ErrorStateProps) => {
  const { t } = useTranslation();
  const status = isApiError(error) ? error.status : null;

  // "Não foi possível conectar" só para falha de rede (status 0); 500 e outros erros do
  // servidor mostram "Algo deu errado" + a mensagem do servidor (REVIEW G-6)
  let defaultIcon: LucideIcon = CircleAlert;
  let defaultTitle = t("errors.genericTitle");
  let defaultMessage: ReactNode = isApiError(error) ? error.mensagem : t("errors.generic");
  if (isApiError(error) && error.isNetworkError) {
    defaultIcon = WifiOff;
    defaultTitle = t("errors.connectTitle");
    defaultMessage = t("errors.connectMessage");
  } else if (status === 403) {
    defaultIcon = Lock;
    defaultTitle = t("errors.forbiddenTitle");
    defaultMessage = t("errors.forbidden");
  } else if (status === 404) {
    defaultIcon = SearchX;
    defaultTitle = t("errors.notFoundTitle");
    defaultMessage = null;
  }

  const Icon = icon ?? defaultIcon;
  const text = message ?? defaultMessage;

  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}
    >
      <span
        aria-hidden="true"
        className="mb-2 grid size-[72px] place-items-center rounded-pill bg-surface-2 text-text-muted"
      >
        <Icon className="size-9" strokeWidth={1.75} />
      </span>
      <h2 className="m-0 text-headline">{title ?? defaultTitle}</h2>
      {text ? <p className="m-0 mb-3 max-w-[32ch] text-subhead text-text-muted">{text}</p> : null}
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          icon={<RotateCw className="size-5" strokeWidth={1.75} />}
          onClick={onRetry}
        >
          {t("actions.retry")}
        </Button>
      ) : null}
      {action}
    </div>
  );
};

export default ErrorState;
