import { useId } from "react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

export interface SwitchRowProps {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Envio em curso: `aria-busy`, spinner no botão branco e cliques ignorados (components.md §12) */
  busy?: boolean;
  /**
   * Indisponível sem tirar da ordem de Tab (offline ou o outro interruptor do mesmo membro enviando):
   * `aria-disabled="true"`, `opacity-60`; o clique chama `onBlockedClick`.
   */
  ariaDisabled?: boolean;
  /** Ids extras para o `aria-describedby` (nota offline, nota de alcance, erro), depois da ajuda */
  describedBy?: string;
  /** Clique com `ariaDisabled` (ex.: toast "Sem internet…") */
  onBlockedClick?: () => void;
}

/**
 * Linha de lista com interruptor (`role="switch"`) — components.md §3 e §12.
 * O rótulo é um `<label>` ligado ao botão (tocar no texto também alterna); a ajuda fica fora dele e
 * entra no `aria-describedby`.
 */
export const SwitchRow = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  busy = false,
  ariaDisabled = false,
  describedBy,
  onBlockedClick,
}: SwitchRowProps) => {
  const switchId = useId();
  const descriptionId = useId();
  const describedByIds = [description ? descriptionId : null, describedBy || null].filter(Boolean).join(" ");

  return (
    <div
      className={cn(
        "list-row flex min-h-row w-full gap-3 px-4",
        description ? "items-start py-3" : "items-center py-2",
      )}
    >
      <span className="min-w-0 flex-1">
        <label htmlFor={switchId} className={cn("block text-body", ariaDisabled || disabled ? "cursor-not-allowed" : "cursor-pointer")}>
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className="mt-0.5 block text-footnote text-text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={describedByIds || undefined}
        aria-busy={busy || undefined}
        aria-disabled={ariaDisabled || undefined}
        disabled={disabled}
        onClick={() => {
          if (busy) return;
          if (ariaDisabled) {
            onBlockedClick?.();
            return;
          }
          onChange(!checked);
        }}
        className={cn(
          "relative h-[31px] w-[51px] shrink-0 rounded-pill border motion-safe:transition-colors",
          description ? "mt-0.5" : undefined,
          // Área de toque ≥ 44 px (59×47) sem mudar o desenho do trilho
          "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']",
          "after:absolute after:top-[2px] after:left-[2px] after:size-[25px] after:rounded-pill after:bg-logo-white after:shadow after:content-['']",
          "motion-safe:after:transition-transform disabled:cursor-not-allowed disabled:opacity-60",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          ariaDisabled && "cursor-not-allowed opacity-60",
          busy && "cursor-progress",
          checked ? "border-accent bg-accent after:translate-x-5" : "border-border bg-surface-3",
        )}
      >
        {/* Sempre montado, acompanhando o botão branco: ao ligar, o spinner desliza junto com ele em vez de
            saltar para a direita (REVIEW-008 M-6, acabamento) */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-[2px] left-[2px] z-10 grid size-[25px] place-items-center motion-safe:transition-transform",
            checked && "translate-x-5",
          )}
        >
          {busy ? <Loader2 className="size-3.5 text-brand motion-safe:animate-spin" strokeWidth={2.25} /> : null}
        </span>
      </button>
    </div>
  );
};

export default SwitchRow;
