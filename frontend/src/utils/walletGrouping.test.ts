import { describe, expect, it } from "vitest";
import { makeGroup, makeWallet } from "../test/fixtures";
import { LOOSE_SECTION_KEY, groupWallets } from "./walletGrouping";

describe("groupWallets", () => {
  const silva = makeGroup({ groupId: 1, name: "Silva" });
  const praia = makeGroup({ groupId: 2, name: "Praia" });
  const vazia = makeGroup({ groupId: 3, name: "Árvore" });

  it("ordena famílias alfabeticamente (pt-BR) e coloca Avulsas por último", () => {
    const wallets = [
      makeWallet({ name: "Nubank", groupId: null }),
      makeWallet({ name: "Conta conjunta", groupId: 1 }),
      makeWallet({ name: "Casa de praia", groupId: 2 }),
    ];

    const sections = groupWallets(wallets, [silva, praia]);

    expect(sections.map((s) => s.title)).toEqual(["Praia", "Silva", "Avulsas"]);
    expect(sections.map((s) => s.groupId)).toEqual([2, 1, null]);
    expect(sections[2]?.key).toBe(LOOSE_SECTION_KEY);
  });

  it("ordena as carteiras de cada seção por nome", () => {
    const wallets = [
      makeWallet({ name: "Mesada do Pedro", groupId: 1 }),
      makeWallet({ name: "conta conjunta", groupId: 1 }),
      makeWallet({ name: "Ávila", groupId: 1 }),
    ];

    const [section] = groupWallets(wallets, [silva]);

    expect(section?.wallets.map((w) => w.name)).toEqual(["Ávila", "conta conjunta", "Mesada do Pedro"]);
  });

  it("não cria seção para família sem carteira nem Avulsas vazia", () => {
    const wallets = [makeWallet({ name: "Conta conjunta", groupId: 1 })];

    const sections = groupWallets(wallets, [silva, vazia]);

    expect(sections.map((s) => s.title)).toEqual(["Silva"]);
  });

  it("usa o título informado para as avulsas", () => {
    const sections = groupWallets([makeWallet({ groupId: null })], [], "Sem família");

    expect(sections.map((s) => s.title)).toEqual(["Sem família"]);
  });

  it("devolve lista vazia sem carteiras", () => {
    expect(groupWallets([], [silva])).toEqual([]);
  });
});
