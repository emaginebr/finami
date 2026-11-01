import type { ReactNode } from "react";
import { CircleAlert, Clock, Info, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

import { BannerTone } from "./variants";

const TONES: Record<BannerTone, { className: string; icon: LucideIcon }> = {
  [BannerTone.Error]: { className: "bg-negative-soft text-negative", icon: CircleAlert },
  [BannerTone.Warning]: { className: "bg-warning-soft text-warning", icon: TriangleAlert },
  [BannerTone.Info]: { className: "bg-info-soft text-info", icon: Info },
  [BannerTone.Expired]: { className: "bg-info-soft text-info", icon: Clock },
};

export interface BannerProps {
  tone: BannerTone | `${BannerTone}`;
  title?: ReactNode;
  children?: ReactNode;
  /** `alert` para erros, `status` para avisos informativos */
  role?: "alert" | "status";
  /** Ícone no lugar do padrão do tom (ex.: `UserCheck`, `Clock`) */
  icon?: LucideIcon;
  className?: string;
}

/** Faixa de aviso com ícone + texto (nunca só cor) */
export const Banner = ({ tone, title, children, role, icon, className }: BannerProps) => {
  const style = TONES[tone as BannerTone];
  const Icon = icon ?? style.icon;
  return (
    <div
      role={role}
      className={cn("flex items-start gap-2.5 rounded-md p-3 text-footnote", style.className, className)}
    >
      <Icon aria-hidden="true" className="mt-px size-[18px] shrink-0" />
      <span>
        {title ? <b className="mb-0.5 block font-semibold text-text">{title}</b> : null}
        {children}
      </span>
    </div>
  );
};

export default Banner;
