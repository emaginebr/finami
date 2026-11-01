import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface SwitchRowProps {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Linha de lista com interruptor (`role="switch"`) — components.md §3 */
export const SwitchRow = ({ label, description, checked, onChange, disabled = false }: SwitchRowProps) => {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="list-row flex min-h-row w-full items-center gap-3 px-4 py-2">
      <span className="min-w-0 flex-1">
        <span id={labelId} className="block text-body">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="mt-0.5 block text-footnote text-text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[31px] w-[51px] shrink-0 rounded-pill border motion-safe:transition-colors",
          "after:absolute after:top-[2px] after:left-[2px] after:size-[25px] after:rounded-pill after:bg-logo-white after:shadow after:content-['']",
          "motion-safe:after:transition-transform disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "border-accent bg-accent after:translate-x-5" : "border-border bg-surface-3",
        )}
      />
    </div>
  );
};

export default SwitchRow;
