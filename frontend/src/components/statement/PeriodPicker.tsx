import { useId, useState } from "react";
import { Calendar, CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StatementPeriod } from "../../types/statement";
import { PeriodPreset, formatPeriodRange, presetPeriod, validatePeriod } from "../../utils/dates";
import { SegmentedControl } from "../ui/SegmentedControl";
import { TextField } from "../ui/TextField";

export interface PeriodPickerProps {
  /** Período aplicado ao extrato */
  period: StatementPeriod;
  /** Só é chamado com períodos válidos */
  onChange: (period: StatementPeriod) => void;
  disabled?: boolean;
}

/**
 * Atalhos de período + intervalo personalizado (components.md §6).
 * Período inválido (início > fim ou > 366 dias) mostra o erro e não é aplicado.
 */
export const PeriodPicker = ({ period, onChange, disabled = false }: PeriodPickerProps) => {
  const { t } = useTranslation();
  const errorId = useId();
  const [selected, setSelected] = useState<PeriodPreset>(period.preset);
  const [draftStart, setDraftStart] = useState(period.start);
  const [draftEnd, setDraftEnd] = useState(period.end);
  const [error, setError] = useState<string | null>(null);

  const select = (preset: PeriodPreset) => {
    setSelected(preset);
    if (preset === PeriodPreset.Custom) {
      setDraftStart(period.start);
      setDraftEnd(period.end);
      setError(null);
      return;
    }
    setError(null);
    onChange({ preset, ...presetPeriod(preset) });
  };

  const changeCustom = (start: string, end: string) => {
    setDraftStart(start);
    setDraftEnd(end);
    const validation = validatePeriod(start, end);
    setError(validation);
    if (!validation) onChange({ preset: PeriodPreset.Custom, start, end });
  };

  const isCustom = selected === PeriodPreset.Custom;

  return (
    <div>
      <SegmentedControl
        ariaLabel={t("statement.period")}
        value={selected}
        onChange={select}
        disabled={disabled}
        options={[
          { value: PeriodPreset.ThisMonth, label: t("statement.presets.thisMonth") },
          { value: PeriodPreset.LastMonth, label: t("statement.presets.lastMonth") },
          {
            value: PeriodPreset.Last30,
            label: t("statement.presets.last30Short"),
            ariaLabel: t("statement.presets.last30"),
          },
          { value: PeriodPreset.Custom, label: t("statement.presets.custom") },
        ]}
      />

      {isCustom ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <TextField
              label={t("statement.from")}
              type="date"
              className="tabular-nums"
              value={draftStart}
              max={draftEnd || undefined}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => changeCustom(event.target.value, draftEnd)}
            />
            <TextField
              label={t("statement.to")}
              type="date"
              className="tabular-nums"
              value={draftEnd}
              min={draftStart || undefined}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => changeCustom(draftStart, event.target.value)}
            />
          </div>
          {error ? (
            <p id={errorId} role="alert" className="m-0 mt-2 flex items-start gap-1.5 text-footnote text-negative">
              <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
              {error}
            </p>
          ) : null}
        </>
      ) : null}

      <p className="m-0 mt-2 mb-4 flex items-center justify-center gap-1.5 text-footnote text-text-muted">
        <Calendar aria-hidden="true" className="size-3.5" />
        <span className="tabular-nums">{formatPeriodRange(period.start, period.end)}</span>
      </p>
    </div>
  );
};

export default PeriodPicker;
