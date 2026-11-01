import { useId } from "react";
import { ChevronsUpDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectRowProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Id do texto de erro/ajuda (`aria-describedby`) */
  describedBy?: string;
  /** Marca o campo como inválido (`aria-invalid`) */
  invalid?: boolean;
}

/**
 * Linha de lista com seleção nativa (`<select>` com `<label>`): no iPhone abre o seletor do
 * sistema, acessível por teclado e leitor de tela.
 */
export const SelectRow = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
  describedBy,
  invalid = false,
}: SelectRowProps) => {
  const id = useId();
  return (
    <div className="list-row relative flex min-h-row w-full items-center gap-3 px-4 py-2 focus-within:bg-surface-3">
      <label htmlFor={id} className="flex-1 text-body">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[60%] appearance-none truncate rounded-md bg-transparent py-2 pr-7 pl-2 text-right text-body text-text-muted disabled:text-text-disabled"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface-2 text-text">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        aria-hidden="true"
        className="pointer-events-none absolute right-4 size-[18px] text-text-subtle"
      />
    </div>
  );
};

export default SelectRow;
