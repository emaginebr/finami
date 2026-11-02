import { useContext, useId, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import AppUpdateContext from "../../Contexts/AppUpdateContext";
import { useCssHeightVar } from "../../hooks/useCssHeightVar";
import { cn } from "../../utils/cn";
import { notifyErrorMessage } from "../../utils/notify";
import { Button } from "../ui/Button";
import { ButtonSize, ButtonVariant, UpdatePromptPlacement } from "../ui/variants";

/** Variável CSS com a altura do cartão (o FAB e o fim do conteúdo sobem) */
export const UPDATE_PROMPT_HEIGHT_VAR = "--update-prompt-h";

export interface UpdatePromptProps {
  placement?: UpdatePromptPlacement;
}

const PLACEMENT_CLASSES: Record<UpdatePromptPlacement, string> = {
  [UpdatePromptPlacement.Shell]:
    "bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+12px)] md:bottom-[104px] md:right-[max(24px,calc((100vw-960px)/2-72px))]",
  [UpdatePromptPlacement.Bare]: "bottom-[calc(env(safe-area-inset-bottom)+12px)] md:bottom-6 md:right-6",
};

/**
 * Aviso "Nova versão disponível · Atualizar · Agora não" (contracts/ui.md, components.md §9).
 * Não modal e não move o foco; a região viva fica sempre montada e só o conteúdo entra.
 * Renderizado dentro de cada casca (ordem de foco depois do conteúdo, antes da TabBar — M-6).
 * Durante "Atualizar" o cartão continua, só "Agora não" sai e o botão mostra "Atualizando…"
 * (REVIEW-005 B-3). Fora do `AppUpdateProvider` não renderiza nada.
 */
export const UpdatePrompt = ({ placement = UpdatePromptPlacement.Shell }: UpdatePromptProps) => {
  const { t } = useTranslation();
  const appUpdate = useContext(AppUpdateContext);
  const textId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const visible = appUpdate !== undefined && (appUpdate.needRefresh || appUpdate.updating);
  useCssHeightVar(cardRef, UPDATE_PROMPT_HEIGHT_VAR, visible);

  if (!appUpdate) return null;
  const { updating, update, dismiss } = appUpdate;

  const runUpdate = async () => {
    const ok = await update();
    if (!ok) notifyErrorMessage(t("pwa.update.failed"));
  };

  return (
    <div role="status" aria-live="polite" aria-labelledby={visible ? textId : undefined}>
      {visible ? (
        <div
          ref={cardRef}
          className={cn(
            "fixed inset-x-3 z-40 flex flex-col gap-2 rounded-[14px] border border-border bg-surface-3 p-3 pl-3.5 shadow-modal",
            "motion-safe:animate-modal-in md:inset-x-auto md:w-[360px]",
            PLACEMENT_CLASSES[placement],
          )}
        >
          <p id={textId} className="m-0 flex min-h-6 items-center gap-2.5 text-subhead font-semibold text-text">
            <RefreshCw aria-hidden="true" className="size-5 shrink-0 text-accent" strokeWidth={1.75} />
            {t("pwa.update.available")}
          </p>
          <div className="flex justify-end gap-2">
            {!updating ? (
              <Button variant={ButtonVariant.Ghost} size={ButtonSize.Sm} onClick={dismiss}>
                {t("pwa.update.notNow")}
              </Button>
            ) : null}
            <Button
              size={ButtonSize.Sm}
              loading={updating}
              loadingLabel={t("pwa.update.updating")}
              onClick={() => void runUpdate()}
            >
              {t("pwa.update.update")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UpdatePrompt;
