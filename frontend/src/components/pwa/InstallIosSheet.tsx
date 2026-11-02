import { Check, Share, SquarePlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useInstall } from "../../hooks/useInstall";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

export interface InstallIosSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface IosStep {
  /** Chave i18n do texto (com `<b>` no nome do botão do Safari) */
  textKey: string;
  /** Linha de ajuda abaixo do texto */
  hintKey?: string;
  icon: LucideIcon;
  strokeWidth: number;
}

const IOS_STEPS: IosStep[] = [
  { textKey: "pwa.install.iosStepShare", hintKey: "pwa.install.iosStepShareHint", icon: Share, strokeWidth: 1.75 },
  {
    textKey: "pwa.install.iosStepAddToHome",
    hintKey: "pwa.install.iosStepAddToHomeHint",
    icon: SquarePlus,
    strokeWidth: 1.75,
  },
  { textKey: "pwa.install.iosStepConfirm", icon: Check, strokeWidth: 2.25 },
];

/**
 * Passo a passo da instalação no iPhone/iPad (contracts/ui.md §Instalação, components.md §9):
 * o Safari não oferece diálogo nativo. `Sheet` (sobe de baixo no celular, modal central ≥ 768 px),
 * sem botão no cabeçalho, foco inicial em "Entendi"; Esc e o scrim fecham e o foco volta ao gatilho.
 */
export const InstallIosSheet = ({ open, onOpenChange }: InstallIosSheetProps) => {
  const { t } = useTranslation();
  const { isIpad } = useInstall();
  const intro = t("pwa.install.iosIntro");

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isIpad ? t("pwa.install.iosTitleIpad") : t("pwa.install.iosTitle")}
      description={intro}
      leading={<span />}
      footer={
        <Button block data-autofocus="" onClick={() => onOpenChange(false)}>
          {t("pwa.install.iosDone")}
        </Button>
      }
    >
      {/* A descrição do Sheet é `sr-only`; esta cópia visível não é lida duas vezes */}
      <p aria-hidden="true" className="m-0 mb-4 text-subhead text-text-muted">
        {intro}
      </p>
      <ol className="m-0 list-none overflow-hidden rounded-lg bg-surface p-0">
        {IOS_STEPS.map(({ textKey, hintKey, icon: Icon, strokeWidth }, index) => (
          <li key={textKey} className="list-row has-icon flex min-h-16 items-center gap-3 px-4 py-2.5 text-body">
            <span
              aria-hidden="true"
              className="relative grid size-9 shrink-0 place-items-center rounded-[10px] bg-info-soft text-info"
            >
              <Icon className="size-5" strokeWidth={strokeWidth} />
              <span className="absolute -top-1.5 -left-1.5 grid size-[18px] place-items-center rounded-pill bg-info text-[11px] font-bold text-on-accent ring-2 ring-surface">
                {index + 1}
              </span>
            </span>
            <span className="min-w-0 flex-1 text-text">
              <Trans i18nKey={textKey} components={{ b: <strong className="font-semibold" /> }} />
              {hintKey ? (
                <small className="mt-0.5 block text-footnote text-text-muted">{t(hintKey)}</small>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
};

export default InstallIosSheet;
