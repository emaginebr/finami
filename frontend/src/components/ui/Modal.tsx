import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ComponentRef, HTMLAttributes } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../../utils/cn";

/** Modal central (skill `react-modal`, components.md §2) sobre Radix Dialog */
const Modal = DialogPrimitive.Root;
const ModalTrigger = DialogPrimitive.Trigger;
const ModalPortal = DialogPrimitive.Portal;
const ModalClose = DialogPrimitive.Close;

const ModalOverlay = forwardRef<
  ComponentRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-scrim motion-safe:animate-fade-in", className)}
    {...props}
  />
));
ModalOverlay.displayName = "ModalOverlay";

const ModalContent = forwardRef<
  ComponentRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <ModalPortal>
    <ModalOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed top-1/2 left-1/2 z-50 w-[calc(100%-3rem)] max-w-sheet -translate-x-1/2 -translate-y-1/2",
        "max-h-[90dvh] overflow-y-auto rounded-card bg-surface-2 p-6 text-text shadow-modal",
        "motion-safe:animate-modal-in focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </ModalPortal>
));
ModalContent.displayName = "ModalContent";

const ModalHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-5 flex flex-col gap-2", className)} {...props} />
);
ModalHeader.displayName = "ModalHeader";

/** Rodapé: empilhado no celular (primário em cima), lado a lado à direita no desktop */
const ModalFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col gap-2 md:flex-row-reverse md:justify-start", className)}
    {...props}
  />
);
ModalFooter.displayName = "ModalFooter";

const ModalTitle = forwardRef<
  ComponentRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("m-0 flex items-center gap-2.5 text-title-2", className)}
    {...props}
  />
));
ModalTitle.displayName = "ModalTitle";

const ModalDescription = forwardRef<
  ComponentRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("m-0 text-body text-text-muted", className)}
    {...props}
  />
));
ModalDescription.displayName = "ModalDescription";

export {
  Modal,
  ModalPortal,
  ModalOverlay,
  ModalTrigger,
  ModalClose,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
};
