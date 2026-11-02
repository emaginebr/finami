import { describe, expect, it } from "vitest";
import { USER_ID, makeGroup, makeWallet } from "../test/fixtures";
import { buildWalletTree } from "./walletTree";

const SILVA = makeGroup({
  groupId: 1,
  name: "Silva",
  members: [
    { userId: 9, firstName: "Pedro", lastName: "Silva", joinedAt: "2026-01-01T00:00:00Z" },
    { userId: USER_ID, firstName: "Ana", lastName: "Silva", joinedAt: "2026-01-01T00:00:00Z" },
  ],
});
const ALVES = makeGroup({ groupId: 2, name: "Alves", members: [] });

describe("buildWalletTree", () => {
  it("agrupa Família → Pessoa → Carteira, com a pessoa logada primeiro e tudo em ordem alfabética", () => {
    const tree = buildWalletTree(
      [
        makeWallet({ walletId: 1, name: "Mesada", groupId: 1, ownerUserId: 9, ownerName: "Pedro Silva" }),
        makeWallet({ walletId: 2, name: "Zeta", groupId: 1 }),
        makeWallet({ walletId: 3, name: "Alfa", groupId: 1 }),
        makeWallet({ walletId: 4, name: "Nubank", groupId: null }),
        makeWallet({ walletId: 5, name: "De família oculta", groupId: 77 }),
      ],
      [SILVA, ALVES],
      USER_ID,
    );

    expect(tree.families.map((f) => f.group.name)).toEqual(["Alves", "Silva"]);
    expect(tree.families[0]?.people).toEqual([]);

    const silva = tree.families[1]?.people ?? [];
    expect(silva.map((p) => [p.userId, p.name, p.colorIndex])).toEqual([
      [USER_ID, "Ana Silva", 1],
      [9, "Pedro Silva", 0],
    ]);
    expect(silva[0]?.wallets.map((w) => w.name)).toEqual(["Alfa", "Zeta"]);

    expect(tree.loose).toHaveLength(1);
    expect(tree.loose[0]?.wallets.map((w) => w.name)).toEqual(["De família oculta", "Nubank"]);
  });
});
