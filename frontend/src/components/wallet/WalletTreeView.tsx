import { useId } from "react";
import { ChevronRight, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { GroupInfo } from "../../types/group";
import { cn } from "../../utils/cn";
import { familyColorClass } from "../../utils/familyColors";
import type { WalletTreeFamily, WalletTreePerson } from "../../utils/walletTree";
import { AppTab } from "../layout/navigation";
import type { NavState } from "../layout/navigation";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { listRowClasses } from "../ui/listRow";
import { WalletCard } from "./WalletCard";

const STATE: NavState = { tab: AppTab.Wallets };

/** Recuos da árvore: pessoa dentro da família, carteira dentro da pessoa */
const PERSON_INDENT = "pl-8";
const WALLET_INDENT = "pl-14";
/** Em "Avulsas" não há linha de família acima: um nível a menos de recuo */
const WALLET_INDENT_TOP = "pl-8";

interface PersonBranchProps {
  person: WalletTreePerson;
  currentUserId: number | null;
  quoteAvailable: boolean;
  /** Dentro de uma família (recuada); `false` em "Avulsas" */
  nested?: boolean;
}

/** Pessoa (link para `/pessoas/:userId`) seguida das carteiras dela */
const PersonBranch = ({ person, currentUserId, quoteAvailable, nested = true }: PersonBranchProps) => {
  const { t } = useTranslation();
  const isMe = person.userId === currentUserId;
  return (
    <>
      <Link
        to={`/pessoas/${person.userId}`}
        state={{ ...STATE, colorIndex: person.colorIndex }}
        className={cn(listRowClasses({ withIcon: true, interactive: true }), nested && PERSON_INDENT)}
      >
        <Avatar name={person.name} colorIndex={person.colorIndex} size="xs" />
        <span className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-subhead font-semibold">
            {person.name}
            {isMe ? <span className="font-normal text-text-muted"> ({t("wallets.tree.you")})</span> : null}
          </h3>
          <span className="block text-footnote text-text-muted">
            {t("wallets.tree.walletCount", { count: person.wallets.length })}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
      </Link>
      {person.wallets.map((wallet) => (
        <WalletCard
          key={wallet.walletId}
          wallet={wallet}
          currentUserId={currentUserId}
          quoteAvailable={quoteAvailable}
          fromTab={AppTab.Wallets}
          hideOwner
          className={nested ? WALLET_INDENT : WALLET_INDENT_TOP}
        />
      ))}
    </>
  );
};

interface FamilyBranchProps {
  family: WalletTreeFamily;
  colorIndex: number;
  currentUserId: number | null;
  quoteAvailable: boolean;
}

const responsibleName = (group: GroupInfo) => {
  const responsible = group.members.find((m) => m.userId === group.responsibleUserId);
  return responsible ? `${responsible.firstName} ${responsible.lastName}` : "";
};

/** Família (link para `/familias/:groupId`) → pessoas → carteiras */
export const FamilyBranch = ({ family, colorIndex, currentUserId, quoteAvailable }: FamilyBranchProps) => {
  const { t } = useTranslation();
  const headingId = useId();
  const { group } = family;
  return (
    <section aria-labelledby={headingId} className="mt-4 overflow-hidden rounded-lg bg-surface">
      <Link
        to={`/familias/${group.groupId}`}
        state={STATE}
        className={listRowClasses({ twoLines: true, withIcon: true, interactive: true })}
      >
        <span
          aria-hidden="true"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-md text-on-family",
            familyColorClass(colorIndex),
          )}
        >
          <Users className="size-5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <h2 id={headingId} className="m-0 line-clamp-2 text-headline break-words hyphens-auto">
            {group.name}
          </h2>
          <span className="mt-0.5 block truncate text-footnote text-text-muted">
            {t("groups.memberCount", { count: group.members.length })}
            {" · "}
            {group.isResponsible ? (
              <Badge variant="responsible">{t("badges.responsible")}</Badge>
            ) : (
              t("groups.responsibleIs", { name: responsibleName(group) })
            )}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-[18px] shrink-0 text-text-subtle" />
      </Link>
      {family.people.length === 0 ? (
        <p className={cn("list-row m-0 py-3 pr-4 text-footnote text-text-muted", PERSON_INDENT)}>
          {t("wallets.tree.noWallets")}
        </p>
      ) : (
        family.people.map((person) => (
          <PersonBranch
            key={person.userId}
            person={person}
            currentUserId={currentUserId}
            quoteAvailable={quoteAvailable}
          />
        ))
      )}
    </section>
  );
};

interface LooseBranchProps {
  people: WalletTreePerson[];
  currentUserId: number | null;
  quoteAvailable: boolean;
}

/** Carteiras sem família ("Avulsas"), agrupadas por pessoa */
export const LooseBranch = ({ people, currentUserId, quoteAvailable }: LooseBranchProps) => {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mt-7">
      <div className="flex min-h-touch items-start gap-2 px-4 py-[13px] text-footnote font-semibold tracking-wider text-text-muted uppercase">
        <span aria-hidden="true" className="mt-1 size-2.5 shrink-0 rounded-pill bg-border" />
        <h2 id={headingId} className="m-0">
          {t("home.looseSection")}
        </h2>
      </div>
      <div className="overflow-hidden rounded-lg bg-surface">
        {people.map((person) => (
          <PersonBranch
            key={person.userId}
            person={person}
            currentUserId={currentUserId}
            quoteAvailable={quoteAvailable}
            nested={false}
          />
        ))}
      </div>
    </section>
  );
};
