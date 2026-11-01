/** Datas no fuso de Brasília (research R-12) */

export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

/** Maior período aceito pelo extrato, contando início e fim (espelha o backend) */
export const MAX_PERIOD_DAYS = 366;

/** Atalhos de período do extrato */
export enum PeriodPreset {
  ThisMonth = "thisMonth",
  LastMonth = "lastMonth",
  Last30 = "last30",
  Custom = "custom",
}

/** Intervalo de datas em `yyyy-MM-dd` (inclusivo nas duas pontas) */
export interface DateRange {
  start: string;
  end: string;
}

/** Mensagens de validação do período */
export const PERIOD_ERRORS = {
  invalid: "Informe datas válidas.",
  startAfterEnd: "A data inicial deve ser anterior ou igual à data final.",
  tooLong: `O período máximo do extrato é de ${MAX_PERIOD_DAYS} dias.`,
};

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, size = 2): string => String(n).padStart(size, "0");

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const SP_PARTS_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Componentes de data/hora de um instante no fuso de São Paulo */
const partsInSaoPaulo = (date: Date): DateParts => {
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(SP_PARTS_FORMAT.formatToParts(date).find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
  };
};

/** Data civil (sem fuso) como número de dias desde 1970-01-01 */
const toDayNumber = (year: number, month: number, day: number): number =>
  Date.UTC(year, month - 1, day) / MS_PER_DAY;

const fromDayNumber = (dayNumber: number): string => {
  const d = new Date(dayNumber * MS_PER_DAY);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** Lê `yyyy-MM-dd` como número de dias; `null` se a data não existir */
const parseIsoDate = (text: string): number | null => {
  const match = ISO_DATE.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dayNumber = toDayNumber(year, month, day);
  // Rejeita datas que "transbordam" (ex.: 2026-02-30)
  return fromDayNumber(dayNumber) === text ? dayNumber : null;
};

/** Hoje em São Paulo, em `yyyy-MM-dd` */
export const todayInSaoPaulo = (now: Date = new Date()): string => {
  const { year, month, day } = partsInSaoPaulo(now);
  return `${year}-${pad(month)}-${pad(day)}`;
};

/**
 * Intervalo de um atalho de período, calculado no fuso de São Paulo:
 * - `thisMonth`: dia 1 do mês corrente até hoje
 * - `lastMonth`: primeiro ao último dia do mês anterior
 * - `last30`: os últimos 30 dias, incluindo hoje
 */
export const presetPeriod = (
  preset: Exclude<PeriodPreset, PeriodPreset.Custom>,
  now: Date = new Date(),
): DateRange => {
  const { year, month, day } = partsInSaoPaulo(now);
  const today = toDayNumber(year, month, day);

  switch (preset) {
    case PeriodPreset.ThisMonth:
      return { start: fromDayNumber(toDayNumber(year, month, 1)), end: fromDayNumber(today) };
    case PeriodPreset.LastMonth: {
      const firstOfThisMonth = toDayNumber(year, month, 1);
      // Date.UTC normaliza mês 0 → dezembro do ano anterior
      const firstOfLastMonth = toDayNumber(year, month - 1, 1);
      return { start: fromDayNumber(firstOfLastMonth), end: fromDayNumber(firstOfThisMonth - 1) };
    }
    case PeriodPreset.Last30:
      return { start: fromDayNumber(today - 29), end: fromDayNumber(today) };
  }
};

/** Quantidade de dias do período, contando início e fim; `null` se alguma data for inválida */
export const periodLengthInDays = (start: string, end: string): number | null => {
  const s = parseIsoDate(start);
  const e = parseIsoDate(end);
  if (s === null || e === null) return null;
  return e - s + 1;
};

/** Valida o período do extrato; devolve a mensagem de erro ou `null` se válido */
export const validatePeriod = (start: string, end: string): string | null => {
  const s = parseIsoDate(start);
  const e = parseIsoDate(end);
  if (s === null || e === null) return PERIOD_ERRORS.invalid;
  if (s > e) return PERIOD_ERRORS.startAfterEnd;
  if (e - s + 1 > MAX_PERIOD_DAYS) return PERIOD_ERRORS.tooLong;
  return null;
};

/** Interpreta datas da API; sem fuso explícito, assume UTC */
const parseApiDate = (value: string | Date): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `dd/MM/yyyy`. Datas `yyyy-MM-dd` são exibidas como estão; instantes, no fuso de São Paulo */
export const formatDate = (value: string | Date): string => {
  if (typeof value === "string") {
    const match = ISO_DATE.exec(value);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const date = parseApiDate(value);
  if (!date) return "";
  const { year, month, day } = partsInSaoPaulo(date);
  return `${pad(day)}/${pad(month)}/${year}`;
};

/** Dia civil (`yyyy-MM-dd`) de um instante no fuso de São Paulo */
export const dayKeyOf = (value: string | Date): string => {
  const date = parseApiDate(value);
  if (!date) return "";
  const { year, month, day } = partsInSaoPaulo(date);
  return `${year}-${pad(month)}-${pad(day)}`;
};

const DAY_MONTH_FORMAT = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long" });
const DAY_MONTH_YEAR_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Rótulos relativos usados em `formatDayHeading` */
export interface DayHeadingLabels {
  today: string;
  yesterday: string;
}

/** Cabeçalho de dia do extrato: "Hoje", "Ontem", "12 de outubro" (com ano se for outro ano) */
export const formatDayHeading = (
  dayKey: string,
  labels: DayHeadingLabels,
  now: Date = new Date(),
): string => {
  const target = parseIsoDate(dayKey);
  const todayKey = todayInSaoPaulo(now);
  const today = parseIsoDate(todayKey);
  if (target === null || today === null) return dayKey;
  if (target === today) return labels.today;
  if (target === today - 1) return labels.yesterday;
  const date = new Date(target * MS_PER_DAY);
  const sameYear = dayKey.slice(0, 4) === todayKey.slice(0, 4);
  return (sameYear ? DAY_MONTH_FORMAT : DAY_MONTH_YEAR_FORMAT).format(date);
};

/** "01/10/2026 – 31/10/2026" */
export const formatPeriodRange = (start: string, end: string): string =>
  `${formatDate(start)} – ${formatDate(end)}`;

/** `HH:mm` no fuso de São Paulo */
export const formatTime = (value: string | Date): string => {
  const date = parseApiDate(value);
  if (!date) return "";
  const { hour, minute } = partsInSaoPaulo(date);
  return `${pad(hour)}:${pad(minute)}`;
};

const LONG_DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** "Domingo, 1 de novembro" (fuso de São Paulo) */
export const formatLongDate = (now: Date = new Date()): string => {
  const text = LONG_DATE_FORMAT.format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** `dd/MM/yyyy HH:mm` no fuso de São Paulo */
export const formatDateTime = (value: string | Date): string => {
  const date = parseApiDate(value);
  if (!date) return "";
  const { year, month, day, hour, minute } = partsInSaoPaulo(date);
  return `${pad(day)}/${pad(month)}/${year} ${pad(hour)}:${pad(minute)}`;
};
