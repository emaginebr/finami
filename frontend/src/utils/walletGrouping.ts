import type { GroupInfo } from "../types/group";
import type { WalletInfo } from "../types/wallet";

/** Chave da seção das carteiras sem família */
export const LOOSE_SECTION_KEY = "loose";

/** Seção da Home: uma por família, depois "Avulsas" (data-model §5) */
export interface HomeSection {
  key: string;
  title: string;
  /** `null` na seção "Avulsas" */
  groupId: number | null;
  wallets: WalletInfo[];
}

const collator = new Intl.Collator("pt-BR");

const byName = (a: { name: string }, b: { name: string }): number => collator.compare(a.name, b.name);

/**
 * Agrupa carteiras por família (famílias em ordem alfabética pt-BR, carteiras por nome) e
 * coloca as avulsas por último. Famílias sem carteira não geram seção. Carteiras ligadas a
 * uma família que a pessoa não enxerga caem em "Avulsas".
 */
export const groupWallets = (
  wallets: WalletInfo[],
  groups: GroupInfo[],
  looseTitle: string = "Avulsas",
): HomeSection[] => {
  const knownGroups = new Map(groups.map((group) => [group.groupId, group]));
  const byGroup = new Map<number, WalletInfo[]>();
  const loose: WalletInfo[] = [];

  for (const wallet of wallets) {
    if (wallet.groupId !== null && knownGroups.has(wallet.groupId)) {
      const list = byGroup.get(wallet.groupId) ?? [];
      list.push(wallet);
      byGroup.set(wallet.groupId, list);
    } else {
      loose.push(wallet);
    }
  }

  const sections: HomeSection[] = [...groups]
    .sort(byName)
    .filter((group) => byGroup.has(group.groupId))
    .map((group) => ({
      key: `group-${group.groupId}`,
      title: group.name,
      groupId: group.groupId,
      wallets: [...(byGroup.get(group.groupId) ?? [])].sort(byName),
    }));

  if (loose.length > 0) {
    sections.push({
      key: LOOSE_SECTION_KEY,
      title: looseTitle,
      groupId: null,
      wallets: [...loose].sort(byName),
    });
  }

  return sections;
};
