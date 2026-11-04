import { useId } from "react";
import type { ReactNode, Ref } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TRANSFER_KINDS, TransferKind } from "../../types/transaction";
import { SegmentedControl } from "../ui/SegmentedControl";

export interface TransferKindPickerProps {
  /** `id` do rótulo "Tipo" (o painel de quitação também se rotula por ele) */
  labelId: string;
  /** `null` = nada escolhido (nenhuma opção marcada, FR-003) */
  value: TransferKind | null;
  onChange: (kind: TransferKind) => void;
  /** Primeiro nome do titular do De */
  sourceOwnerName: string;
  /** Primeiro nome do titular do Para */
  destinationOwnerName: string;
  /** "Escolha o tipo da transferência." depois de "Continuar" sem tipo */
  error: string | null;
  disabled?: boolean;
  /** Trilho do grupo (a página põe o foco na parada de Tab dele quando falta o tipo) */
  groupRef?: Ref<HTMLDivElement>;
  /** Painel de quitação, dentro do bloco "Tipo" (components.md §11) */
  children?: ReactNode;
}

/**
 * Seletor "Tipo" da transferência entre pessoas (components.md §11): `radiogroup` segmentado com
 * Empréstimo · Quitação · Pagamento, sem seleção inicial, ajuda curta da opção escolhida e erro.
 */
export const TransferKindPicker = ({
  labelId,
  value,
  onChange,
  sourceOwnerName,
  destinationOwnerName,
  error,
  disabled = false,
  groupRef,
  children,
}: TransferKindPickerProps) => {
  const { t } = useTranslation();
  const helpId = useId();
  const errorId = useId();

  const help = (() => {
    switch (value) {
      case TransferKind.Loan:
        return t("transaction.kind.help.loan", { debtor: destinationOwnerName, creditor: sourceOwnerName });
      case TransferKind.Settlement:
        return t("transaction.kind.help.settlement", { debtor: sourceOwnerName, creditor: destinationOwnerName });
      case TransferKind.Payment:
        return t("transaction.kind.help.payment");
      default:
        return null;
    }
  })();

  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <span id={labelId} className="text-footnote font-medium text-text-muted">
        {t("transaction.kind.label")}
      </span>
      <SegmentedControl
        ref={groupRef}
        ariaLabelledBy={labelId}
        ariaDescribedBy={describedBy || undefined}
        required
        invalid={Boolean(error)}
        stackNarrow
        disabled={disabled}
        value={value}
        onChange={onChange}
        options={TRANSFER_KINDS.map((kind) => ({ value: kind, label: t(`transaction.kind.${kind}`) }))}
      />
      {/*
        Sempre montado e na árvore de acessibilidade (vazio = `sr-only`, não `hidden`): assim a região viva já
        existe antes da primeira escolha e ela é anunciada (REVIEW-007 I-1)
      */}
      <p id={helpId} aria-live="polite" className="m-0 text-footnote text-text-muted empty:sr-only">
        {help}
      </p>
      {error ? (
        <span id={errorId} role="alert" className="flex items-start gap-1.5 text-footnote text-negative">
          <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
          {error}
        </span>
      ) : null}
      {children}
    </div>
  );
};

export default TransferKindPicker;
