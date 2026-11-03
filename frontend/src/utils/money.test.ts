import { describe, expect, it } from "vitest";
import { Currency } from "../types/api";
import {
  AMOUNT_ERRORS,
  formatBrl,
  formatBtc,
  formatMoneyParts,
  formatSigned,
  fromCents,
  parseAmountInput,
  toCents,
} from "./money";

const NBSP = " ";
const MINUS = "−";

describe("formatação", () => {
  it("formata reais em pt-BR", () => {
    expect(formatBrl(1234.56)).toBe(`R$${NBSP}1.234,56`);
    expect(formatBrl(0)).toBe(`R$${NBSP}0,00`);
    expect(formatBrl("10.5")).toBe(`R$${NBSP}10,50`);
  });

  it("formata valores grandes com separador de milhar", () => {
    expect(formatBrl(1234567890.12)).toBe(`R$${NBSP}1.234.567.890,12`);
    expect(formatBtc(21000000)).toBe(`₿${NBSP}21.000.000,00000`);
  });

  it("formata bitcoin com 5 casas fixas, truncando (nunca arredonda para cima)", () => {
    expect(formatBtc(0.12345678)).toBe(`₿${NBSP}0,12345`);
    expect(formatBtc(0.99999999)).toBe(`₿${NBSP}0,99999`);
    expect(formatBtc(1)).toBe(`₿${NBSP}1,00000`);
    expect(formatBtc("0.00000001")).toBe(`₿${NBSP}0,00000`);
  });

  it("usa o sinal − (U+2212) nos negativos", () => {
    expect(formatBrl(-50)).toBe(`${MINUS}R$${NBSP}50,00`);
    expect(formatBtc(-0.5)).toBe(`${MINUS}₿${NBSP}0,50000`);
  });

  it("formatSigned mostra + e − explícitos e zero sem sinal", () => {
    expect(formatSigned(100, Currency.BRL)).toBe(`+R$${NBSP}100,00`);
    expect(formatSigned(-1234.5, Currency.BRL)).toBe(`${MINUS}R$${NBSP}1.234,50`);
    expect(formatSigned(-0.00012345, Currency.BTC)).toBe(`${MINUS}₿${NBSP}0,00012`);
    expect(formatSigned(0, Currency.BRL)).toBe(`R$${NBSP}0,00`);
  });

  it("não mostra −R$ 0,00 para negativos que arredondam para zero", () => {
    expect(formatBrl(-0.001)).toBe(`R$${NBSP}0,00`);
  });

  it("usa um único formato de negativo: sinal antes do símbolo, sem espaço", () => {
    expect(formatSigned(-342.1, Currency.BRL)).toBe(`${MINUS}R$${NBSP}342,10`);
    expect(formatBrl(-342.1)).toBe(`${MINUS}R$${NBSP}342,10`);
    expect(formatBtc(-0.001)).toBe(`${MINUS}₿${NBSP}0,00100`);
    expect(formatMoneyParts(-342.1, Currency.BRL)).toEqual({
      sign: MINUS,
      symbol: "R$",
      digits: "342,10",
      negative: true,
    });
    expect(formatMoneyParts(100, Currency.BRL, true)?.sign).toBe("+");
    expect(formatMoneyParts(100, Currency.BRL)?.sign).toBe("");
    expect(formatMoneyParts(-0.001, Currency.BRL)?.sign).toBe("");
    expect(formatMoneyParts("abc", Currency.BRL)).toBeNull();
  });

  it("devolve — para valores inválidos", () => {
    expect(formatBrl("abc")).toBe("—");
  });
});

describe("parseAmountInput", () => {
  it("aceita milhar com ponto e decimal com vírgula", () => {
    expect(parseAmountInput("1.234,56", Currency.BRL)).toEqual({ value: "1234.56", error: null });
  });

  it("aceita ponto como decimal", () => {
    expect(parseAmountInput("1234.56", Currency.BRL)).toEqual({ value: "1234.56", error: null });
    expect(parseAmountInput("0.5", Currency.BTC)).toEqual({ value: "0.5", error: null });
  });

  it("aceita o menor valor de bitcoin", () => {
    expect(parseAmountInput("0,00000001", Currency.BTC)).toEqual({
      value: "0.00000001",
      error: null,
    });
  });

  it("ignora prefixo da moeda, espaços e zeros à esquerda", () => {
    expect(parseAmountInput(" R$ 0100,50 ", Currency.BRL)).toEqual({ value: "100.5", error: null });
    expect(parseAmountInput("1.000.000", Currency.BRL)).toEqual({ value: "1000000", error: null });
  });

  it("rejeita mais casas decimais que a moeda permite", () => {
    expect(parseAmountInput("0,001", Currency.BRL)).toEqual({
      value: null,
      error: AMOUNT_ERRORS.tooManyDecimals(2),
    });
    expect(parseAmountInput("0,000000001", Currency.BTC)).toEqual({
      value: null,
      error: AMOUNT_ERRORS.tooManyDecimals(8),
    });
  });

  it("rejeita zero e negativos", () => {
    expect(parseAmountInput("0", Currency.BRL).error).toBe(AMOUNT_ERRORS.notPositive);
    expect(parseAmountInput("0,00", Currency.BRL).error).toBe(AMOUNT_ERRORS.notPositive);
    expect(parseAmountInput("-5", Currency.BRL).error).toBe(AMOUNT_ERRORS.notPositive);
  });

  it("rejeita texto vazio ou inválido", () => {
    expect(parseAmountInput("", Currency.BRL).error).toBe(AMOUNT_ERRORS.required);
    expect(parseAmountInput("abc", Currency.BRL).error).toBe(AMOUNT_ERRORS.invalid);
    expect(parseAmountInput("1,2,3", Currency.BRL).error).toBe(AMOUNT_ERRORS.invalid);
    expect(parseAmountInput("12.34.5", Currency.BRL).error).toBe(AMOUNT_ERRORS.invalid);
    expect(parseAmountInput("1e5", Currency.BRL).error).toBe(AMOUNT_ERRORS.invalid);
    expect(parseAmountInput(",", Currency.BRL).error).toBe(AMOUNT_ERRORS.invalid);
  });
});

describe("toCents", () => {
  it("não sofre com erro de ponto flutuante", () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(500.1)).toBe(50010);
  });

  it("aceita strings decimais e negativos", () => {
    expect(toCents("1234.56")).toBe(123456);
    expect(toCents("0.005")).toBe(1);
    expect(toCents(-12.34)).toBe(-1234);
    expect(toCents("-12.34")).toBe(-1234);
  });

  it("soma o exemplo do spec centavo a centavo", () => {
    const total = toCents(1000) + toCents(500) + toCents(0.01 * 500000);
    expect(total).toBe(650000);
    expect(formatBrl(fromCents(total))).toBe(`R$${NBSP}6.500,00`);
  });
});
