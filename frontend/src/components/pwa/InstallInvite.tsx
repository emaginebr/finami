import { useId, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useInstall } from "../../hooks/useInstall";
import { InstallOutcome } from "../../types/install";
import { cn } from "../../utils/cn";
import { prepareFocusAfter } from "../../utils/focus";
import { AppIcon } from "../brand/AppIcon";
import { Button } from "../ui/Button";
import { AppIconSize, ButtonSize, ButtonVariant } from "../ui/variants";
import { InstallIosSheet } from "./InstallIosSheet";

export interface InstallInviteProps {
  className?: string;
}

/**
 * Convite discreto de instalação na Home (contracts/ui.md §Instalação, components.md §9, FR-004):
 * aparece enquanto o app é instalável e o convite não foi dispensado nos últimos 30 dias.
 * Ao sair (dispensado, instalado ou recusado no diálogo nativo), o foco vai para o próximo
 * elemento da Home — nunca para o `<body>` (REVIEW-005 A-1/M-1).
 */
export const InstallInvite = ({ className }: InstallInviteProps) => {
  const { t } = useTranslation();
  const { showInvite, canPromptNative, promptInstall, dismissInvite } = useInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const bodyId = useId();

  if (!showInvite && !iosOpen) return null;

  const dismiss = () => {
    const moveFocus = prepareFocusAfter(sectionRef.current);
    dismissInvite();
    moveFocus();
  };

  const install = async () => {
    if (!canPromptNative) {
      setIosOpen(true);
      return;
    }
    const moveFocus = prepareFocusAfter(sectionRef.current);
    const outcome = await promptInstall();
    // Recusar no diálogo do navegador já é um "agora não": conta como dispensa
    if (outcome === InstallOutcome.Dismissed) dismissInvite();
    if (outcome !== InstallOutcome.Unavailable) moveFocus();
  };

  return (
    <>
      {showInvite ? (
        <section
          ref={sectionRef}
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          className={cn("mt-4 flex items-start gap-3 rounded-lg bg-surface p-3.5 pr-1 shadow-card", className)}
        >
          <AppIcon size={AppIconSize.Sm} className="mt-0.5 size-11 shadow-none" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="m-0 text-headline text-text">
              {t("pwa.install.title")}
            </h2>
            <p id={bodyId} className="m-0 mt-0.5 mb-2.5 text-subhead text-text-muted">
              {t("pwa.install.description")}
            </p>
            <Button
              variant={ButtonVariant.Secondary}
              size={ButtonSize.Sm}
              icon={<Download className="size-[18px]" strokeWidth={1.75} />}
              onClick={() => void install()}
              aria-haspopup={canPromptNative ? undefined : "dialog"}
            >
              {t("pwa.install.inviteAction")}
            </Button>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("pwa.install.inviteDismiss")}
            className="-mt-1.5 grid size-11 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={2} />
          </button>
        </section>
      ) : null}
      <InstallIosSheet open={iosOpen} onOpenChange={setIosOpen} />
    </>
  );
};

export default InstallInvite;
