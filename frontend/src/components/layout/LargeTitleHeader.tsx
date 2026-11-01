import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export interface LargeTitleHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Linha acima do título (ex.: data na Home) */
  eyebrow?: ReactNode;
  /** Rota do botão voltar */
  backTo?: string;
  /** Rótulo da tela anterior (ex.: "Carteiras") */
  backLabel?: string;
  /** Botões de ícone de 44 px com `aria-label` */
  actions?: ReactNode;
  /** Elemento à esquerda do título (ex.: avatar na tela do membro) */
  leading?: ReactNode;
}

/** Cabeçalho com título grande estilo iOS (components.md §1) */
export const LargeTitleHeader = ({
  title,
  subtitle,
  eyebrow,
  backTo,
  backLabel,
  actions,
  leading,
}: LargeTitleHeaderProps) => {
  const { t } = useTranslation();
  const label = backLabel ?? t("nav.back");
  const hasNavRow = Boolean(backTo || actions);

  return (
    <header className="mb-4 pt-3 md:pt-0">
      {hasNavRow ? (
        <div className="-mx-2 flex min-h-header items-center justify-between">
          {backTo ? (
            <Link
              to={backTo}
              aria-label={t("nav.backTo", { label })}
              className="inline-flex min-h-touch min-w-touch items-center gap-0.5 pr-2 text-body text-accent no-underline"
            >
              <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={1.75} />
              <span aria-hidden="true">{label}</span>
            </Link>
          ) : (
            <span />
          )}
          {actions ? <div className="ml-auto flex gap-1">{actions}</div> : null}
        </div>
      ) : null}
      {eyebrow ? (
        <p className="m-0 mt-3 text-footnote font-semibold tracking-wider text-text-muted uppercase">
          {eyebrow}
        </p>
      ) : null}
      <div className={leading ? "mt-1 flex items-center gap-4" : undefined}>
        {leading}
        <div className="min-w-0">
          {/* Nomes muito longos: até 3 linhas, nome completo no `title` (REVIEW F-4) */}
          <h1
            title={title}
            className="m-0 mt-1 line-clamp-3 font-display text-large-title break-words hyphens-auto"
          >
            {title}
          </h1>
          {subtitle ? <p className="m-0 mt-1 text-subhead text-text-muted">{subtitle}</p> : null}
        </div>
      </div>
    </header>
  );
};

export default LargeTitleHeader;
