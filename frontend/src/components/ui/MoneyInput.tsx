import { forwardRef, useId } from "react";
import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Currency } from "../../types/api";
import { cn } from "../../utils/cn";
import { currencySymbol } from "../../utils/money";

export interface MoneyInputProps {
  label: string;
  currency: Currency;
  /** Texto digitado (validado por `parseAmountInput` em quem usa) */
  value: string;
  onChange: (text: string) => void;
  error?: string | null;
  /** Ajuda abaixo (ex.: "Disponível: R$ 1.250,00") */
  hint?: ReactNode;
  disabled?: boolean;
  id?: string;
  autoFocus?: boolean;
  /** Marca o campo como foco inicial da folha */
  dataAutofocus?: boolean;
}

/** Mantém só dígitos, vírgula e ponto (o teclado decimal do iOS já limita) */
const sanitize = (text: string): string => text.replace(/[^\d.,]/g, "");

/**
 * Campo de valor (components.md §3): prefixo da moeda, `inputMode="decimal"`,
 * fonte grande com números tabulares, erro ligado por `aria-describedby`.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ label, currency, value, onChange, error, hint, disabled, id, autoFocus, dataAutofocus }, ref) => {
    const { t } = useTranslation();
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const currencyId = `${inputId}-currency`;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const describedBy = [currencyId, hint ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-footnote font-medium text-text-muted">
          {label}
        </label>
        <div
          className={cn(
            "flex min-h-16 items-baseline gap-2 rounded-md border bg-surface-2 px-4 py-2",
            "focus-within:border-focus focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
            error ? "border-negative" : "border-border",
            disabled && "opacity-60",
          )}
        >
          <span aria-hidden="true" className="text-title-2 font-medium text-text-muted">
            {currencySymbol(currency)}
          </span>
          <span id={currencyId} className="sr-only">
            {t(`currencyIn.${currency}`)}
          </span>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            value={value}
            disabled={disabled}
            autoFocus={autoFocus}
            data-autofocus={dataAutofocus ? "" : undefined}
            placeholder={currency === Currency.BTC ? "0,00000000" : "0,00"}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(sanitize(event.target.value))}
            className={cn(
              "w-full min-w-0 bg-transparent text-[2rem] leading-tight font-bold text-text tabular-nums",
              "placeholder:text-text-subtle focus:outline-none disabled:cursor-not-allowed",
            )}
          />
        </div>
        {hint ? (
          <span id={hintId} className="text-footnote text-text-muted tabular-nums">
            {hint}
          </span>
        ) : null}
        {error ? (
          <span id={errorId} role="alert" className="flex items-start gap-1.5 text-footnote text-negative">
            <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
            {error}
          </span>
        ) : null}
      </div>
    );
  },
);

MoneyInput.displayName = "MoneyInput";

export default MoneyInput;
