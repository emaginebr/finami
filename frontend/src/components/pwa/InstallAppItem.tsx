import { useId, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useInstall } from "../../hooks/useInstall";
import { InstallOutcome } from "../../types/install";
import { prepareFocusAfter } from "../../utils/focus";
import { notifyMessage } from "../../utils/notify";
import { listRowClasses } from "../ui/listRow";
import { InstallIosSheet } from "./InstallIosSheet";

const SECTION_TITLE_CLASSES =
  "m-0 flex min-h-touch items-center px-4 text-footnote font-semibold tracking-wider text-text-muted uppercase";

/**
 * Seção "App" da Conta com o item "Instalar o Finami" (contracts/ui.md §Instalação).
 * Diálogo nativo quando o navegador oferece; no iOS abre o passo a passo. Recusado o diálogo
 * nativo, o item continua e orienta a usar o ícone/menu do navegador (REVIEW-005 A-1). Não
 * aparece quando o app já está instalado nem em navegador sem suporte fora do iOS (FR-022).
 */
export const InstallAppItem = () => {
  const { t } = useTranslation();
  const { canInstall, canPromptNative, isIos, promptInstall } = useInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const headingId = useId();
  const titleId = useId();
  const descriptionId = useId();

  if (!canInstall) return null;

  const install = async () => {
    if (canPromptNative) {
      // Aceito, a seção sai: o foco vai para o próximo item da Conta ("Sair") — §9
      const moveFocus = prepareFocusAfter(sectionRef.current);
      const outcome = await promptInstall();
      if (outcome === InstallOutcome.Accepted) moveFocus();
      return;
    }
    if (isIos) {
      setIosOpen(true);
      return;
    }
    notifyMessage(t("pwa.install.browserMenuHint"));
  };

  return (
    <section ref={sectionRef} aria-labelledby={headingId} className="mt-7">
      <h2 id={headingId} className={SECTION_TITLE_CLASSES}>
        {t("pwa.install.section")}
      </h2>
      <div className="overflow-hidden rounded-lg bg-surface">
        <button
          type="button"
          onClick={() => void install()}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          aria-haspopup={!canPromptNative && isIos ? "dialog" : undefined}
          className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
        >
          <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-[8px] bg-accent text-on-accent">
            <Download className="size-[18px]" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span id={titleId} className="block text-body">
              {t("pwa.install.title")}
            </span>
            <span id={descriptionId} className="mt-0.5 block text-footnote text-text-muted">
              {t("pwa.install.description")}
            </span>
          </span>
        </button>
      </div>
      <InstallIosSheet open={iosOpen} onOpenChange={setIosOpen} />
    </section>
  );
};

export default InstallAppItem;
