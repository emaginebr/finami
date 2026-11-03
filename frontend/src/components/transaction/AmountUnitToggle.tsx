import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";
import { AmountUnit } from "./sheetModel";

export interface AmountUnitToggleProps {
  value: AmountUnit;
  onChange: (unit: AmountUnit) => void;
  disabled?: boolean;
}

const UNITS: AmountUnit[] = [AmountUnit.Btc, AmountUnit.Brl];

/**
 * Alternador "Bitcoin | Reais" da linha do rótulo Valor (components.md §10): dois botões
 * `aria-pressed` na ordem normal de Tab (sem roving tabindex). Tocar no já pressionado não faz nada.
 */
export const AmountUnitToggle = ({ value, onChange, disabled = false }: AmountUnitToggleProps) => {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("transaction.amountUnit.label")}
      className="inline-flex gap-0.5 rounded-pill border border-border bg-surface p-1"
    >
      {UNITS.map((unit) => {
        const pressed = unit === value;
        return (
          <button
            key={unit}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => {
              if (!pressed) onChange(unit);
            }}
            className={cn(
              "min-h-touch min-w-[5.5rem] rounded-pill px-3 text-subhead font-semibold motion-safe:transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-60",
              pressed ? "bg-brand-tint text-text" : "text-text-muted hover:text-text",
            )}
          >
            {t(`transaction.amountUnit.${unit}`)}
          </button>
        );
      })}
    </div>
  );
};

export default AmountUnitToggle;
