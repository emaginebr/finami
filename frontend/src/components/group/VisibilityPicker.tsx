import { useId } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatementVisibility } from "../../types/group";
import { cn } from "../../utils/cn";

const OPTIONS: StatementVisibility[] = [
  StatementVisibility.ResponsibleOnly,
  StatementVisibility.AllMembers,
  StatementVisibility.MembersSummary,
];

export interface VisibilityPickerProps {
  value: StatementVisibility;
  onChange: (value: StatementVisibility) => void;
  /** Rótulo do grupo de opções */
  label: string;
  disabled?: boolean;
}

/**
 * Quem vê os extratos da família (components.md §6): `role="radiogroup"` com rádios nativos
 * (setas do teclado), título e explicação de cada opção.
 */
export const VisibilityPicker = ({ value, onChange, label, disabled = false }: VisibilityPickerProps) => {
  const { t } = useTranslation();
  const name = useId();
  const labelId = useId();

  return (
    <div role="radiogroup" aria-labelledby={labelId} className="overflow-hidden rounded-lg bg-surface">
      <span id={labelId} className="sr-only">
        {label}
      </span>
      {OPTIONS.map((option) => {
        const checked = option === value;
        const descriptionId = `${name}-${option}-description`;
        return (
          <label
            key={option}
            className={cn(
              "list-row flex min-h-row-2 cursor-pointer items-start gap-3 px-4 py-3.5",
              "hover:bg-surface-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-focus",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={checked}
              disabled={disabled}
              aria-describedby={descriptionId}
              onChange={() => onChange(option)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-pill border-2",
                checked ? "border-accent bg-accent text-on-accent" : "border-border",
              )}
            >
              {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-headline">{t(`visibility.${option}`)}</span>
              <span id={descriptionId} className="mt-0.5 block text-footnote text-text-muted">
                {t(`visibilityDescription.${option}`)}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
};

export default VisibilityPicker;
