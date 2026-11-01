import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "../../utils/cn";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  /** Texto de ajuda abaixo do campo */
  hint?: ReactNode;
  /** Mensagem de erro (liga `aria-invalid` e `aria-describedby`) */
  error?: string | null;
  /** Complemento visual do rótulo (ex.: "(opcional)") */
  labelSuffix?: ReactNode;
  /** Conteúdo sobreposto à direita do campo (ex.: botão de mostrar senha) */
  trailing?: ReactNode;
  /** Conteúdo abaixo, alinhado à direita (ex.: contador "14/500") */
  counter?: ReactNode;
  containerClassName?: string;
}

/** Campo de texto com `<label>` associado, ajuda e erro ligados por `aria-describedby` */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      hint,
      error,
      labelSuffix,
      trailing,
      counter,
      id,
      className,
      containerClassName,
      required,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    // Com erro, a mensagem de erro substitui a ajuda (REVIEW R-1)
    const showHint = Boolean(hint) && !error;
    const describedBy =
      [error ? errorId : null, showHint ? hintId : null, props["aria-describedby"] ?? null]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        <label htmlFor={inputId} className="text-footnote font-medium text-text-muted">
          {label}
          {required ? (
            <span aria-hidden="true" className="text-negative">
              {" "}
              *
            </span>
          ) : null}
          {labelSuffix ? <span className="font-normal text-text-subtle"> {labelSuffix}</span> : null}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={error ? true : undefined}
            {...props}
            aria-describedby={describedBy}
            className={cn(
              "min-h-12 w-full rounded-md border bg-surface-2 px-4 text-body text-text",
              "placeholder:text-text-subtle",
              "focus-visible:border-focus",
              "disabled:cursor-not-allowed disabled:text-text-disabled",
              "read-only:border-transparent read-only:bg-surface",
              error ? "border-negative" : "border-border",
              trailing ? "pr-12" : null,
              className,
            )}
          />
          {trailing ? <div className="absolute top-0.5 right-0.5">{trailing}</div> : null}
        </div>
        {showHint ? (
          <span id={hintId} className="text-footnote text-text-muted">
            {hint}
          </span>
        ) : null}
        {error ? (
          <span id={errorId} role="alert" className="flex items-start gap-1.5 text-footnote text-negative">
            <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
            {error}
          </span>
        ) : null}
        {counter ? (
          <span className="text-right text-caption text-text-subtle">{counter}</span>
        ) : null}
      </div>
    );
  },
);

TextField.displayName = "TextField";

export default TextField;
