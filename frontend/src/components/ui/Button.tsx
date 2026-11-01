import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";

import { ButtonSize, ButtonVariant } from "./variants";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | `${ButtonVariant}`;
  size?: ButtonSize | `${ButtonSize}`;
  /** Largura total */
  block?: boolean;
  /** Mostra spinner, desabilita e marca `aria-busy` (evita duplo envio) */
  loading?: boolean;
  /** Texto exibido durante o carregamento (padrão: rótulo mantido em `sr-only` + "Enviando…") */
  loadingLabel?: string;
  /** Ícone à esquerda (20 px) */
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  [ButtonVariant.Primary]:
    "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed",
  [ButtonVariant.Secondary]:
    "bg-surface-2 text-text border border-border hover:bg-surface-3 active:bg-surface-3",
  [ButtonVariant.Ghost]: "bg-transparent text-accent hover:bg-surface-2 active:bg-surface-3",
  [ButtonVariant.Destructive]: "bg-negative text-on-accent hover:opacity-90 active:opacity-80",
  [ButtonVariant.DestructiveGhost]:
    "bg-transparent text-negative hover:bg-surface-2 active:bg-surface-3",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  [ButtonSize.Md]: "min-h-12 px-5 text-headline",
  [ButtonSize.Sm]: "min-h-touch px-4 text-subhead font-semibold",
};

const DISABLED_CLASSES =
  "disabled:bg-surface-2 disabled:text-text-disabled disabled:border-transparent disabled:cursor-not-allowed disabled:hover:bg-surface-2";

/** Botão do design system (components.md §3) — altura mínima de 44 px */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = ButtonVariant.Primary,
      size = ButtonSize.Md,
      block = false,
      loading = false,
      loadingLabel,
      icon,
      className,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const isPrimaryBusy = loading && variant === ButtonVariant.Primary;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap",
          "motion-safe:transition-colors motion-safe:duration-150",
          VARIANT_CLASSES[variant as ButtonVariant],
          SIZE_CLASSES[size as ButtonSize],
          block && "flex w-full",
          isPrimaryBusy
            ? "disabled:bg-accent-pressed disabled:text-on-accent disabled:cursor-progress"
            : DISABLED_CLASSES,
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-[18px] motion-safe:animate-spin" />
            {loadingLabel ? (
              <span>{loadingLabel}</span>
            ) : (
              <>
                <span className="sr-only">{children}</span>
                <span className="sr-only">{t("actions.sending")}</span>
              </>
            )}
          </>
        ) : (
          <>
            {icon ? (
              <span aria-hidden="true" className="inline-flex shrink-0">
                {icon}
              </span>
            ) : null}
            {children}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
