import { useTranslation } from "react-i18next";
import { AppIcon } from "../brand/AppIcon";
import { cn } from "../../utils/cn";

export interface PageLoadingProps {
  /** Ocupa a tela inteira (verificação da sessão) */
  fullScreen?: boolean;
}

/** Tela de carregamento com o ícone do app e "Carregando…" anunciado */
export const PageLoading = ({ fullScreen = false }: PageLoadingProps) => {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-4 text-subhead text-text-muted",
        fullScreen ? "min-h-dvh" : "py-24",
      )}
    >
      <AppIcon size="md" className="motion-safe:animate-pulse" />
      <span>{t("app.loading")}</span>
    </div>
  );
};

export default PageLoading;
