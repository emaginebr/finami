import { useId } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";
import { familyColorClass } from "../../utils/familyColors";
import type { HomeSection } from "../../utils/walletGrouping";
import type { AppTab, NavState } from "../layout/navigation";
import { WalletCard } from "./WalletCard";

export interface WalletSectionProps {
  section: HomeSection;
  /** Posição da família (cor do marcador); ignorado em "Avulsas" */
  colorIndex: number;
  currentUserId: number | null;
  /** Há cotação utilizável; sem ela as carteiras BTC mostram "sem cotação" */
  quoteAvailable: boolean;
  fromTab?: AppTab;
  showInactive?: boolean;
  /** Cabeçalho da família é link para `/familias/:groupId` (padrão true) */
  linkHeader?: boolean;
}

/** Seção de carteiras de uma família (cabeçalho é link) ou "Avulsas" (sem link) */
export const WalletSection = ({
  section,
  colorIndex,
  currentUserId,
  quoteAvailable,
  fromTab,
  showInactive,
  linkHeader = true,
}: WalletSectionProps) => {
  const headingId = useId();
  const isFamily = section.groupId !== null;
  const state: NavState = fromTab ? { tab: fromTab } : {};
  // Nomes longos: tudo alinhado à primeira linha e no máximo 2 linhas (REVIEW H-3)
  const headClasses =
    "flex min-h-touch items-start gap-2 px-4 py-[13px] text-footnote font-semibold tracking-wider text-text-muted uppercase no-underline";

  const heading = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "mt-1 size-2.5 shrink-0 rounded-pill",
          isFamily ? familyColorClass(colorIndex) : "bg-border",
        )}
      />
      <h2 id={headingId} className="m-0 line-clamp-2 min-w-0 break-words hyphens-auto">
        {section.title}
      </h2>
    </>
  );

  return (
    <section aria-labelledby={headingId} className="mt-7">
      {isFamily && linkHeader ? (
        <Link
          to={`/familias/${section.groupId}`}
          state={state}
          className={cn(headClasses, "self-start hover:text-text")}
        >
          {heading}
          <ChevronRight aria-hidden="true" className="mt-0.5 ml-0.5 size-3.5 shrink-0" />
        </Link>
      ) : (
        <div className={headClasses}>{heading}</div>
      )}
      <div className="overflow-hidden rounded-lg bg-surface">
        {section.wallets.map((wallet) => (
          <WalletCard
            key={wallet.walletId}
            wallet={wallet}
            currentUserId={currentUserId}
            quoteAvailable={quoteAvailable}
            fromTab={fromTab}
            showInactive={showInactive}
          />
        ))}
      </div>
    </section>
  );
};

export default WalletSection;
