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
  /** Elemento extra à direita do rótulo (ex.: alternador "Bitcoin | Reais", feature 006) */
  labelAccessory?: ReactNode;
  /** Valor em satoshis inteiros (só com `currency` BTC): símbolo "sat" e teclado numérico */
  sats?: boolean;
  /**
   * Campo somente leitura com uma frase no lugar do valor (feature 007: "Valor calculado na
   * confirmação"). Continua focável (`readOnly`, não `disabled`) e com o mesmo nome acessível.
   */
  readOnlyText?: string;
}

/** Mantém só dígitos, vírgula e ponto (o teclado decimal do iOS já limita) */
const sanitize = (text: string): string => text.replace(/[^\d.,]/g, "");

/**
 * Campo de valor (components.md §3): prefixo da moeda, `inputMode={sats ? "numeric" : "decimal"}`,
 * fonte grande com números tabulares, erro ligado por `aria-describedby`.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      label,
      currency,
      value,
      onChange,
      error,
      hint,
      disabled,
      id,
      autoFocus,
      dataAutofocus,
      labelAccessory,
      sats = false,
      readOnlyText,
    },
    ref,
  ) => {
    const readOnly = readOnlyText !== undefined;
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
        {labelAccessory ? (
          // Em 320 px / zoom 200 % o acessório desce para baixo do rótulo, sem cortar
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
            <label htmlFor={inputId} className="text-footnote font-medium text-text-muted">
              {label}
            </label>
            {labelAccessory}
          </div>
        ) : (
          <label htmlFor={inputId} className="text-footnote font-medium text-text-muted">
            {label}
          </label>
        )}
        <div
          className={cn(
            "flex min-h-16 items-baseline gap-2 rounded-md border px-4 py-2",
            "focus-within:border-focus focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
            // Somente leitura: deixa de parecer editável (regra do TextField, components.md §11)
            readOnly ? "bg-surface" : "bg-surface-2",
            error ? "border-negative" : readOnly ? "border-transparent" : "border-border",
            disabled && "opacity-60",
          )}
          // Somente leitura: tocar na frase visível foca o campo, como num campo normal
          onClick={
            readOnly ? (event) => event.currentTarget.querySelector<HTMLInputElement>("input")?.focus() : undefined
          }
        >
          <span aria-hidden="true" className="text-title-2 font-medium text-text-muted">
            {sats ? "sat" : currencySymbol(currency)}
          </span>
          <span id={currencyId} className="sr-only">
            {t(`currencyIn.${sats ? "SAT" : currency}`)}
          </span>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode={sats ? "numeric" : "decimal"}
            autoComplete="off"
            enterKeyHint="done"
            value={readOnly ? readOnlyText : value}
            readOnly={readOnly}
            disabled={disabled}
            autoFocus={autoFocus}
            data-autofocus={dataAutofocus ? "" : undefined}
            placeholder={readOnly ? undefined : sats ? "0" : currency === Currency.BTC ? "0,00000000" : "0,00"}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => {
              if (!readOnly) onChange(sanitize(event.target.value));
            }}
            className={cn(
              // Somente leitura: o <input> continua focável e com o nome acessível, mas a frase visível é o
              // <span> abaixo — um <input> não quebra linha (REVIEW-007 I-2, 1.4.10)
              readOnly
                ? "sr-only"
                : "w-full min-w-0 bg-transparent text-[2rem] leading-tight font-bold text-text tabular-nums",
              "placeholder:text-text-subtle focus:outline-none disabled:cursor-not-allowed",
            )}
          />
          {readOnly ? (
            <span
              aria-hidden="true"
              className="min-w-0 flex-1 self-center text-headline leading-tight font-semibold break-words text-text-muted"
            >
              {readOnlyText}
            </span>
          ) : null}
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
