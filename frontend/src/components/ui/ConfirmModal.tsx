import { useRef } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "./Modal";
import { Button } from "./Button";

import { ConfirmTone } from "./variants";

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ação confirmada; se lançar erro, o modal continua aberto */
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone | `${ConfirmTone}`;
  loading?: boolean;
}

/**
 * Confirmação (substitui `window.confirm()`), `role="alertdialog"`,
 * foco inicial em "Cancelar" (ação segura) — components.md §2.
 */
export const ConfirmModal = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = ConfirmTone.Default,
  loading = false,
}: ConfirmModalProps) => {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const destructive = tone === ConfirmTone.Destructive;

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Quem chamou já exibiu o erro; o modal fica aberto para nova tentativa
    }
  };

  return (
    <Modal open={open} onOpenChange={(next) => (loading ? undefined : onOpenChange(next))}>
      <ModalContent
        role="alertdialog"
        {...(description ? {} : { "aria-describedby": undefined })}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <ModalHeader>
          <ModalTitle>
            {destructive ? (
              <TriangleAlert aria-hidden="true" className="size-6 shrink-0 text-negative" />
            ) : null}
            {title}
          </ModalTitle>
          {description ? <ModalDescription>{description}</ModalDescription> : null}
        </ModalHeader>
        <ModalFooter>
          <Button
            variant={destructive ? "destructive" : "primary"}
            loading={loading}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {confirmLabel}
          </Button>
          <Button
            ref={cancelRef}
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel ?? t("actions.cancel")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ConfirmModal;
