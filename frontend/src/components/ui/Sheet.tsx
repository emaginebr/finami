import { forwardRef, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título obrigatório (`Dialog.Title`) */
  title: string;
  /** Descrição para leitores de tela (opcional, `sr-only`) */
  description?: string;
  /** Botão à esquerda do cabeçalho; padrão: "Cancelar" que fecha */
  leading?: ReactNode;
  /** Ação à direita do cabeçalho */
  trailing?: ReactNode;
  /** Rodapé fixo (ex.: botão principal) */
  footer?: ReactNode;
  /** `false` ignora Esc e toque fora (ex.: durante envio) */
  dismissible?: boolean;
  /** Marca o conteúdo como ocupado (`aria-busy`) */
  busy?: boolean;
  /** Ocupa quase toda a altura no celular */
  tall?: boolean;
  children: ReactNode;
}

/**
 * Folha (components.md §2): abaixo de 768 px sobe de baixo com alça; a partir de 768 px
 * vira modal central de 480 px. Foco preso e Esc pelo Radix Dialog. O foco inicial vai para
 * o primeiro elemento com `data-autofocus`, se houver.
 */
export const Sheet = forwardRef<HTMLDivElement, SheetProps>(
  (
    {
      open,
      onOpenChange,
      title,
      description,
      leading,
      trailing,
      footer,
      dismissible = true,
      busy = false,
      tall = false,
      children,
    },
    forwardedRef,
  ) => {
    const { t } = useTranslation();
    const innerRef = useRef<HTMLDivElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const blockIfBusy = (event: Event) => {
      if (!dismissible) event.preventDefault();
    };

    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim motion-safe:animate-fade-in" />
          <DialogPrimitive.Content
            ref={setRefs}
            aria-busy={busy || undefined}
            {...(description ? {} : { "aria-describedby": undefined })}
            onOpenAutoFocus={(event) => {
              const target = innerRef.current?.querySelector<HTMLElement>("[data-autofocus]");
              if (target) {
                event.preventDefault();
                target.focus();
              }
            }}
            onEscapeKeyDown={blockIfBusy}
            onPointerDownOutside={blockIfBusy}
            onInteractOutside={blockIfBusy}
            className={cn(
              "fixed z-50 flex flex-col bg-surface-2 text-text focus:outline-none",
              // Celular: folha presa embaixo
              "inset-x-0 bottom-0 rounded-t-sheet pb-safe pl-safe pr-safe shadow-sheet motion-safe:animate-sheet-in",
              tall ? "top-[calc(env(safe-area-inset-top)+0.625rem)]" : "max-h-[92dvh]",
              // Desktop: modal central
              "md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[80dvh] md:w-[calc(100%-3rem)] md:max-w-sheet",
              "md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card md:pr-0 md:pb-0 md:pl-0 md:shadow-modal md:motion-safe:animate-modal-in",
            )}
          >
            <div
              aria-hidden="true"
              className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-pill bg-border/60 md:hidden"
            />
            {/* `gap-2` + título menor abaixo de 360 px separam "Cancelar"/"Voltar" do título (REVIEW-003 B-1) */}
            <div className="grid min-h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-2">
              <div className="justify-self-start">
                {leading ?? (
                  <DialogPrimitive.Close asChild>
                    <button
                      type="button"
                      disabled={!dismissible}
                      className="inline-flex min-h-touch min-w-touch items-center rounded-md px-2 text-body text-accent disabled:text-text-disabled"
                    >
                      {t("actions.cancel")}
                    </button>
                  </DialogPrimitive.Close>
                )}
              </div>
              <DialogPrimitive.Title className="m-0 text-center text-callout font-semibold min-[360px]:text-headline">
                {title}
              </DialogPrimitive.Title>
              <div className="justify-self-end">{trailing}</div>
            </div>
            {description ? (
              <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
            ) : null}
            <div className="flex-1 overflow-y-auto px-4 pt-1 pb-6">{children}</div>
            {footer ? (
              <div className="shrink-0 border-t-[0.5px] border-separator px-4 pt-3 pb-4">{footer}</div>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  },
);

Sheet.displayName = "Sheet";

/** Botão de cabeçalho da folha (ex.: "Voltar") com alvo ≥ 44 px */
export interface SheetHeaderButtonProps {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}

export const SheetHeaderButton = ({ onClick, children, disabled, ariaLabel }: SheetHeaderButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className="inline-flex min-h-touch min-w-touch items-center gap-0.5 rounded-md pr-2 text-body text-accent disabled:text-text-disabled"
  >
    {children}
  </button>
);

export default Sheet;
