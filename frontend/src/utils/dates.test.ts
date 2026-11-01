import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PERIOD_ERRORS,
  PeriodPreset,
  formatDate,
  formatDateTime,
  periodLengthInDays,
  presetPeriod,
  todayInSaoPaulo,
  validatePeriod,
} from "./dates";

const setNow = (iso: string) => vi.setSystemTime(new Date(iso));

describe("períodos com relógio fixo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no primeiro dia do mês, 'Este mês' começa e termina hoje e 'Mês passado' é o mês anterior", () => {
    setNow("2026-11-01T12:00:00Z");

    expect(todayInSaoPaulo()).toBe("2026-11-01");
    expect(presetPeriod(PeriodPreset.ThisMonth)).toEqual({ start: "2026-11-01", end: "2026-11-01" });
    expect(presetPeriod(PeriodPreset.LastMonth)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(presetPeriod(PeriodPreset.Last30)).toEqual({ start: "2026-10-03", end: "2026-11-01" });
  });

  it("na virada de ano, 'Mês passado' é dezembro do ano anterior", () => {
    setNow("2027-01-15T15:00:00Z");

    expect(presetPeriod(PeriodPreset.ThisMonth)).toEqual({ start: "2027-01-01", end: "2027-01-15" });
    expect(presetPeriod(PeriodPreset.LastMonth)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(presetPeriod(PeriodPreset.Last30)).toEqual({ start: "2026-12-17", end: "2027-01-15" });
  });

  it("usa o fuso de São Paulo perto da meia-noite UTC", () => {
    // 02:00 UTC de 1º de janeiro = 23:00 de 31 de dezembro em São Paulo (UTC−3)
    setNow("2027-01-01T02:00:00Z");

    expect(todayInSaoPaulo()).toBe("2026-12-31");
    expect(presetPeriod(PeriodPreset.ThisMonth)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(presetPeriod(PeriodPreset.LastMonth)).toEqual({ start: "2026-11-01", end: "2026-11-30" });

    // 03:00 UTC = meia-noite em São Paulo: já é o novo ano
    setNow("2027-01-01T03:00:00Z");
    expect(todayInSaoPaulo()).toBe("2027-01-01");
    expect(presetPeriod(PeriodPreset.LastMonth)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });

  it("considera fevereiro de ano bissexto", () => {
    setNow("2028-03-10T12:00:00Z");

    expect(presetPeriod(PeriodPreset.LastMonth)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
});

describe("validatePeriod", () => {
  it("aceita exatamente 366 dias contando início e fim", () => {
    expect(periodLengthInDays("2026-01-01", "2027-01-01")).toBe(366);
    expect(validatePeriod("2026-01-01", "2027-01-01")).toBeNull();
  });

  it("rejeita mais de 366 dias", () => {
    expect(validatePeriod("2026-01-01", "2027-01-02")).toBe(PERIOD_ERRORS.tooLong);
  });

  it("aceita um único dia e rejeita início depois do fim", () => {
    expect(validatePeriod("2026-11-01", "2026-11-01")).toBeNull();
    expect(validatePeriod("2026-11-02", "2026-11-01")).toBe(PERIOD_ERRORS.startAfterEnd);
  });

  it("rejeita datas inexistentes ou mal formatadas", () => {
    expect(validatePeriod("2026-02-30", "2026-03-01")).toBe(PERIOD_ERRORS.invalid);
    expect(validatePeriod("01/11/2026", "2026-11-30")).toBe(PERIOD_ERRORS.invalid);
    expect(validatePeriod("", "")).toBe(PERIOD_ERRORS.invalid);
  });
});

describe("formatação de datas", () => {
  it("exibe data e hora no fuso de Brasília", () => {
    expect(formatDateTime("2026-11-01T14:03:00Z")).toBe("01/11/2026 11:03");
    expect(formatDateTime("2026-12-01T02:30:00Z")).toBe("30/11/2026 23:30");
  });

  it("trata data sem fuso como UTC", () => {
    expect(formatDateTime("2026-11-01T14:03:00")).toBe("01/11/2026 11:03");
  });

  it("formata datas civis sem deslocar o dia", () => {
    expect(formatDate("2026-11-05")).toBe("05/11/2026");
    expect(formatDate("2027-01-01T02:00:00Z")).toBe("31/12/2026");
  });
});
