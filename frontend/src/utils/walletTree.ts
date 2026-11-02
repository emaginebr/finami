import type { GroupInfo } from "../types/group";
import type { WalletInfo } from "../types/wallet";

/** Titular e as carteiras dele dentro de um nó da árvore */
export interface WalletTreePerson {
  userId: number;
  name: string;
  /** Posição da pessoa na família (cor do avatar, igual à da página da família) */
  colorIndex: number;
  wallets: WalletInfo[];
}

/** Família com as pessoas que têm carteira nela */
export interface WalletTreeFamily {
  group: GroupInfo;
  people: WalletTreePerson[];
}

/** Aba Carteiras: Família → Pessoa → Carteira, e as avulsas por pessoa */
export interface WalletTree {
  families: WalletTreeFamily[];
  /** Carteiras sem família (ou de família que a pessoa não enxerga), por titular */
  loose: WalletTreePerson[];
}

const collator = new Intl.Collator("pt-BR");

const byName = (a: { name: string }, b: { name: string }): number => collator.compare(a.name, b.name);

/** Agrupa por titular: a pessoa logada primeiro, depois em ordem alfabética; carteiras por nome */
const groupByOwner = (
  wallets: WalletInfo[],
  currentUserId: number | null,
  group: GroupInfo | null,
): WalletTreePerson[] => {
  const byOwner = new Map<number, WalletInfo[]>();
  for (const wallet of wallets) {
    const list = byOwner.get(wallet.ownerUserId) ?? [];
    list.push(wallet);
    byOwner.set(wallet.ownerUserId, list);
  }

  return [...byOwner.entries()]
    .map(([userId, list]) => {
      const memberIndex = group?.members.findIndex((m) => m.userId === userId) ?? -1;
      const member = memberIndex >= 0 ? group?.members[memberIndex] : undefined;
      return {
        userId,
        name: member ? `${member.firstName} ${member.lastName}` : (list[0]?.ownerName ?? ""),
        colorIndex: memberIndex >= 0 ? memberIndex : userId,
        wallets: [...list].sort(byName),
      };
    })
    .sort((a, b) => {
      if (a.userId === currentUserId) return -1;
      if (b.userId === currentUserId) return 1;
      return byName(a, b);
    });
};

/**
 * Monta a árvore da aba Carteiras. Todas as famílias aparecem (em ordem alfabética pt-BR),
 * mesmo sem carteira; dentro delas só as pessoas que têm carteira.
 */
export const buildWalletTree = (
  wallets: WalletInfo[],
  groups: GroupInfo[],
  currentUserId: number | null,
): WalletTree => {
  const knownGroups = new Set(groups.map((group) => group.groupId));
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

  return {
    families: [...groups].sort(byName).map((group) => ({
      group,
      people: groupByOwner(byGroup.get(group.groupId) ?? [], currentUserId, group),
    })),
    loose: groupByOwner(loose, currentUserId, null),
  };
};
