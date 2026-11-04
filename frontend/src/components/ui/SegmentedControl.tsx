import { forwardRef, useRef } from "react";
import type { KeyboardEvent, ReactElement, Ref } from "react";
import { cn } from "../../utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Rótulo completo para leitores de tela quando o visível é abreviado */
  ariaLabel?: string;
  /** Opção visível mas inativa: `disabled`, sem hover e pulada pelas setas (feature 007) */
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  /** `null` = nada escolhido: nenhum `aria-checked="true"` e a parada de Tab cai na primeira opção */
  value: T | null;
  onChange: (value: T) => void;
  /** Nome do grupo (obrigatório para `role="radiogroup"`, salvo com `ariaLabelledBy`) */
  ariaLabel?: string;
  /** `id` do rótulo visível do grupo (preferível a um `aria-label` duplicado) */
  ariaLabelledBy?: string;
  /** `id`s da ajuda e do erro do grupo */
  ariaDescribedBy?: string;
  /** Escolha obrigatória (`aria-required`) */
  required?: boolean;
  /** Erro: trilho `border-negative` e `aria-invalid` */
  invalid?: boolean;
  /** Empilha as opções quando o contêiner tem menos de 16rem (zoom 200 %, feature 007) */
  stackNarrow?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Colunas por quantidade de opções (classes estáticas, para a container query poder sobrescrever) */
const GRID_COLUMNS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

/**
 * Controle segmentado estilo iOS (components.md §3): `role="radiogroup"`,
 * roving tabindex, setas ←/→ (e ↑/↓), Home e End. As setas movem e selecionam juntas
 * (APG Radio Group) e pulam opções desabilitadas.
 */
const SegmentedControlInner = <T extends string>(
  {
    options,
    value,
    onChange,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    required = false,
    invalid = false,
    stackNarrow = false,
    disabled = false,
    className,
  }: SegmentedControlProps<T>,
  ref: Ref<HTMLDivElement>,
) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = value === null ? -1 : options.findIndex((option) => option.value === value);
  const enabledIndexes = options.flatMap((option, index) => (option.disabled ? [] : [index]));
  // Sem escolha, a parada de Tab é a primeira opção habilitada (sem marcá-la, FR-003 da 007)
  const tabStopIndex = selectedIndex >= 0 ? selectedIndex : (enabledIndexes[0] ?? 0);

  const select = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    refs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (enabledIndexes.length === 0) return;
    const position = enabledIndexes.indexOf(index);
    const last = enabledIndexes.length - 1;
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = enabledIndexes[position < 0 || position === last ? 0 : position + 1] ?? null;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = enabledIndexes[position <= 0 ? last : position - 1] ?? null;
        break;
      case "Home":
        next = enabledIndexes[0] ?? null;
        break;
      case "End":
        next = enabledIndexes[last] ?? null;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next !== null) select(next);
  };

  const columns = GRID_COLUMNS[options.length];

  const group = (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy || undefined}
      aria-required={required || undefined}
      aria-invalid={invalid || undefined}
      aria-disabled={disabled || undefined}
      style={
        // Colunas que podem encolher abaixo do rótulo: nunca estoura a largura (REVIEW G-2)
        stackNarrow && columns ? undefined : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }
      }
      className={cn(
        "grid gap-0.5 rounded-pill border bg-surface p-1",
        invalid ? "border-negative" : "border-border",
        stackNarrow && columns && `${columns} @max-[16rem]:grid-cols-1 @max-[16rem]:rounded-lg`,
        disabled && "opacity-60",
        className,
      )}
    >
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        const optionDisabled = disabled || Boolean(option.disabled);
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
            tabIndex={index === tabStopIndex ? 0 : -1}
            disabled={optionDisabled}
            onClick={() => select(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "min-h-touch min-w-0 rounded-pill px-1.5 text-subhead leading-tight font-semibold",
              "break-words whitespace-normal hyphens-auto max-[359px]:text-footnote",
              "motion-safe:transition-colors motion-safe:duration-150",
              checked
                ? "bg-brand-tint text-text"
                : option.disabled
                  ? "text-text-disabled"
                  : "text-text-muted hover:text-text",
              "disabled:cursor-not-allowed",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  // A container query precisa de um ancestral com `@container`
  return stackNarrow && columns ? <div className="@container">{group}</div> : group;
};

export const SegmentedControl = forwardRef(SegmentedControlInner) as <T extends string>(
  props: SegmentedControlProps<T> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;

export default SegmentedControl;
