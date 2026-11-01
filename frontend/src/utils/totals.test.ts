import { describe, expect, it } from "vitest";
import { Currency } from "../types/api";
import { USER_ID, makeWallet } from "../test/fixtures";
import { computeHomeTotal } from "./totals";
import { formatBrl, fromCents } from "./money";

describe("computeHomeTotal", () => {
  it("soma o exemplo do spec: R$ 1.000 + R$ 500 + 0,01 BTC a R$ 500.000 = R$ 6.500,00", () => {
    const wallets = [
      makeWallet({ balance: 1000 }),
      makeWallet({ balance: 500 }),
      makeWallet({ currency: Currency.BTC, balance: 0.01, estimatedBrl: 5000 }),
    ];

    const total = computeHomeTotal(wallets, USER_ID, true);

    expect(total).toEqual({ totalCents: 650000, btcExcluded: false });
    expect(formatBrl(fromCents(total.totalCents))).toBe(formatBrl(6500));
  });

  it("deixa fora carteira de outro titular", () => {
    const wallets = [
      makeWallet({ balance: 1000 }),
      makeWallet({ balance: 100, ownerUserId: 99, ownerName: "Pedro Silva" }),
    ];

    expect(computeHomeTotal(wallets, USER_ID, true).totalCents).toBe(100000);
  });

  it("marca btcExcluded quando a carteira BTC vem com estimatedBrl nulo", () => {
    const wallets = [
      makeWallet({ balance: 10.5 }),
      makeWallet({ currency: Currency.BTC, balance: 0.5, estimatedBrl: null }),
    ];

    expect(computeHomeTotal(wallets, USER_ID, true)).toEqual({ totalCents: 1050, btcExcluded: true });
  });

  it("marca btcExcluded quando a cotação está indisponível, mesmo com estimatedBrl", () => {
    const wallets = [makeWallet({ currency: Currency.BTC, balance: 0.01, estimatedBrl: 5000 })];

    expect(computeHomeTotal(wallets, USER_ID, false)).toEqual({ totalCents: 0, btcExcluded: true });
  });

  it("ignora carteira inativa", () => {
    const wallets = [makeWallet({ balance: 300 }), makeWallet({ balance: 700, isActive: false })];

    expect(computeHomeTotal(wallets, USER_ID, true).totalCents).toBe(30000);
  });

  it("soma centavos sem erro de ponto flutuante", () => {
    const wallets = [makeWallet({ balance: 0.1 }), makeWallet({ balance: 0.2 })];

    expect(computeHomeTotal(wallets, USER_ID, true).totalCents).toBe(30);
  });

  it("não marca btcExcluded sem carteiras BTC próprias", () => {
    const wallets = [
      makeWallet({ balance: 1 }),
      makeWallet({ currency: Currency.BTC, ownerUserId: 99, estimatedBrl: null }),
    ];

    expect(computeHomeTotal(wallets, USER_ID, false).btcExcluded).toBe(false);
  });
});
