import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "../../utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Rótulo completo para leitores de tela quando o visível é abreviado */
  ariaLabel?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nome do grupo (obrigatório para `role="radiogroup"`) */
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Controle segmentado estilo iOS (components.md §3): `role="radiogroup"`,
 * roving tabindex, setas ←/→ (e ↑/↓), Home e End.
 */
export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: SegmentedControlProps<T>) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const select = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    refs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1;
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = index === last ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = index === 0 ? last : index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      style={{
        // Colunas que podem encolher abaixo do rótulo: nunca estoura a largura (REVIEW G-2)
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
      className={cn(
        "grid gap-0.5 rounded-pill border border-border bg-surface p-1",
        disabled && "opacity-60",
        className,
      )}
    >
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => select(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "min-h-touch min-w-0 rounded-pill px-1.5 text-subhead leading-tight font-semibold",
              "break-words whitespace-normal hyphens-auto max-[359px]:text-footnote",
              "motion-safe:transition-colors motion-safe:duration-150",
              checked ? "bg-brand-tint text-text" : "text-text-muted hover:text-text",
              "disabled:cursor-not-allowed",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
