import { Currency } from "../types/api";

/** Sinal de menos tipográfico (U+2212) usado nos valores negativos */
export const MINUS_SIGN = "−";
const NBSP = " ";

/** Casas decimais aceitas por moeda (digitação e API; BTC em satoshi) */
export const CURRENCY_DECIMALS: Record<Currency, number> = {
  [Currency.BRL]: 2,
  [Currency.BTC]: 8,
};

/** Casas decimais exibidas por moeda */
export const DISPLAY_DECIMALS: Record<Currency, number> = {
  [Currency.BRL]: 2,
  [Currency.BTC]: 5,
};

const CURRENCY_PREFIX: Record<Currency, string> = {
  [Currency.BRL]: "R$",
  [Currency.BTC]: "₿",
};

const NUMBER_FORMATS: Record<Currency, Intl.NumberFormat> = {
  [Currency.BRL]: new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  // Bitcoin exibido com 5 casas, truncado (nunca mostra mais do que existe na carteira).
  // `roundingMode` é ES2023: o cast cobre a lib ES2020 do tsconfig.
  [Currency.BTC]: new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: DISPLAY_DECIMALS[Currency.BTC],
    maximumFractionDigits: DISPLAY_DECIMALS[Currency.BTC],
    roundingMode: "trunc",
  } as Intl.NumberFormatOptions),
};

/**
 * Precisão total da moeda (BTC com 8 casas fixas, truncado). Usada onde o valor exibido
 * tem de ser exatamente o registrado (confirmação, SC-005) ou onde 5 casas zerariam o valor.
 * Sem `trunc`: a API já devolve no máximo 8 casas, e truncar o double (0,00097591 →
 * 0,000975909999…) poderia perder o último satoshi.
 */
const FULL_NUMBER_FORMATS: Record<Currency, Intl.NumberFormat> = {
  [Currency.BRL]: NUMBER_FORMATS[Currency.BRL],
  [Currency.BTC]: new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: CURRENCY_DECIMALS[Currency.BTC],
    maximumFractionDigits: CURRENCY_DECIMALS[Currency.BTC],
  }),
};

/** Texto exibido quando o valor não é um número válido */
export const EMPTY_VALUE = "—";

const toNumber = (value: number | string): number =>
  typeof value === "number" ? value : Number(value);

interface FormatParts {
  negative: boolean;
  positive: boolean;
  body: string;
}

const formatParts = (value: number | string, currency: Currency, full: boolean = false): FormatParts | null => {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return null;
  const digits = (full ? FULL_NUMBER_FORMATS : NUMBER_FORMATS)[currency].format(Math.abs(n));
  // Evita "−R$ 0,00" quando o valor arredondado é zero
  const nonZero = /[1-9]/.test(digits);
  return {
    negative: n < 0 && nonZero,
    positive: n > 0 && nonZero,
    body: `${CURRENCY_PREFIX[currency]}${NBSP}${digits}`,
  };
};

/** Formata na moeda indicada; negativos levam "−" (U+2212) */
export const formatMoney = (value: number | string, currency: Currency): string => {
  const parts = formatParts(value, currency);
  if (!parts) return EMPTY_VALUE;
  return parts.negative ? `${MINUS_SIGN}${parts.body}` : parts.body;
};

/** `R$ 1.234,56` (pt-BR); negativos como `−R$ 1.234,56` */
export const formatBrl = (value: number | string): string => formatMoney(value, Currency.BRL);

/** `₿ 0,12345` (5 casas fixas, truncado); negativos como `−₿ 0,12345` */
export const formatBtc = (value: number | string): string => formatMoney(value, Currency.BTC);

/**
 * Valor com sinal explícito: `+R$ 100,00`, `−R$ 100,00` ou `R$ 0,00`.
 * Com `full`, BTC sai com 8 casas fixas (`+₿ 0,00040000`).
 */
export const formatSigned = (value: number | string, currency: Currency, full: boolean = false): string => {
  const parts = formatParts(value, currency, full);
  if (!parts) return EMPTY_VALUE;
  if (parts.negative) return `${MINUS_SIGN}${parts.body}`;
  if (parts.positive) return `+${parts.body}`;
  return parts.body;
};

/** Na precisão total da moeda: `₿ 0,00040000` (8 casas fixas), `R$ 200,00` */
export const formatMoneyFull = (value: number | string, currency: Currency): string => {
  const parts = formatParts(value, currency, true);
  if (!parts) return EMPTY_VALUE;
  return parts.negative ? `${MINUS_SIGN}${parts.body}` : parts.body;
};

/** O valor (≠ 0) some na exibição padrão (ex.: ₿ 0,000004 → "₿ 0,00000") */
export const hidesInDisplay = (value: number | string, currency: Currency): boolean => {
  const n = toNumber(value);
  if (!Number.isFinite(n) || n === 0) return false;
  return !/[1-9]/.test(NUMBER_FORMATS[currency].format(Math.abs(n)));
};

/** Partes de um valor formatado, para exibir sinal e símbolo em estilos diferentes */
export interface MoneyParts {
  /** "−" (U+2212), "+" (só com `signed`) ou "" */
  sign: string;
  /** `R$` ou `₿` */
  symbol: string;
  /** Dígitos sem sinal (`342,10`) */
  digits: string;
  negative: boolean;
}

/**
 * Sinal, símbolo e dígitos na ordem única do app: `−R$ 342,10` (nunca `R$ −342,10`).
 * Com `signed`, positivos ganham "+" como em `formatSigned`.
 */
export const formatMoneyParts = (
  value: number | string,
  currency: Currency,
  signed: boolean = false,
): MoneyParts | null => {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return null;
  const digits = NUMBER_FORMATS[currency].format(Math.abs(n));
  const nonZero = /[1-9]/.test(digits);
  const negative = n < 0 && nonZero;
  const sign = negative ? MINUS_SIGN : signed && n > 0 && nonZero ? "+" : "";
  return { sign, symbol: CURRENCY_PREFIX[currency], digits, negative };
};

/** Símbolo da moeda (`R$` ou `₿`) */
export const currencySymbol = (currency: Currency): string => CURRENCY_PREFIX[currency];

/**
 * Só os dígitos formatados, sem o símbolo (`1.234,56`; negativos com "−").
 * Usado quando o símbolo é exibido à parte (ex.: BalanceHero).
 */
export const formatAmountNumber = (value: number | string, currency: Currency): string => {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return EMPTY_VALUE;
  const digits = NUMBER_FORMATS[currency].format(Math.abs(n));
  return n < 0 && /[1-9]/.test(digits) ? `${MINUS_SIGN}${digits}` : digits;
};

// ---------------------------------------------------------------------------
// Entrada de valores
// ---------------------------------------------------------------------------

/** Mensagens de validação do valor digitado */
export const AMOUNT_ERRORS = {
  required: "Informe o valor.",
  invalid: "Valor inválido.",
  notPositive: "O valor deve ser maior que zero.",
  tooManyDecimals: (decimals: number): string =>
    `Use no máximo ${decimals} casas decimais.`,
};

/** Resultado de `parseAmountInput` */
export interface ParsedAmount {
  /** Decimal normalizado com ponto (ex.: `"1234.56"`) ou `null` se inválido */
  value: string | null;
  /** Mensagem de erro para exibir junto ao campo, ou `null` */
  error: string | null;
}

const fail = (error: string): ParsedAmount => ({ value: null, error });

const THOUSANDS_DOT = /^\d{1,3}(\.\d{3})+$/;
const THOUSANDS_COMMA = /^\d{1,3}(,\d{3})+$/;

/** Separa parte inteira e decimal aceitando vírgula ou ponto como separador decimal */
const splitDecimal = (text: string): { integer: string; fraction: string } | null => {
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // Os dois aparecem: o último é o decimal, o outro só pode separar milhares
    const decimalAt = Math.max(lastComma, lastDot);
    const integer = text.slice(0, decimalAt);
    const fraction = text.slice(decimalAt + 1);
    const pattern = lastComma > lastDot ? THOUSANDS_DOT : THOUSANDS_COMMA;
    if (!pattern.test(integer)) return null;
    return { integer: integer.replace(/[.,]/g, ""), fraction };
  }

  const separator = lastComma >= 0 ? "," : lastDot >= 0 ? "." : null;
  if (separator === null) return { integer: text, fraction: "" };

  const pieces = text.split(separator);
  if (pieces.length === 2) return { integer: pieces[0] ?? "", fraction: pieces[1] ?? "" };

  // Vários separadores iguais (ex.: "1.234.567"): só milhares, sem decimais
  const pattern = separator === "." ? THOUSANDS_DOT : THOUSANDS_COMMA;
  if (!pattern.test(text)) return null;
  return { integer: pieces.join(""), fraction: "" };
};

/**
 * Lê o valor digitado (vírgula ou ponto), valida (> 0, casas decimais da moeda)
 * e devolve uma string decimal com ponto para enviar à API (research R-09).
 */
export const parseAmountInput = (text: string, currency: Currency): ParsedAmount => {
  const cleaned = text
    .replace(/R\$|₿/g, "")
    .replace(/[\s\u00A0]/g, "");

  if (cleaned.length === 0) return fail(AMOUNT_ERRORS.required);
  if (/^[-−]/.test(cleaned)) return fail(AMOUNT_ERRORS.notPositive);

  const split = splitDecimal(cleaned);
  if (!split) return fail(AMOUNT_ERRORS.invalid);

  const { integer, fraction } = split;
  if (!/^\d*$/.test(integer) || !/^\d*$/.test(fraction)) return fail(AMOUNT_ERRORS.invalid);
  if (integer.length === 0 && fraction.length === 0) return fail(AMOUNT_ERRORS.invalid);

  const maxDecimals = CURRENCY_DECIMALS[currency];
  const trimmedFraction = fraction.replace(/0+$/, "");
  if (trimmedFraction.length > maxDecimals) {
    return fail(AMOUNT_ERRORS.tooManyDecimals(maxDecimals));
  }

  const normalizedInteger = integer.replace(/^0+(?=\d)/, "") || "0";
  if (!/[1-9]/.test(normalizedInteger + trimmedFraction)) {
    return fail(AMOUNT_ERRORS.notPositive);
  }

  const value =
    trimmedFraction.length > 0 ? `${normalizedInteger}.${trimmedFraction}` : normalizedInteger;
  return { value, error: null };
};

// ---------------------------------------------------------------------------
// Centavos
// ---------------------------------------------------------------------------

/** Converte uma string decimal ("1234.565") para centavos com arredondamento meio-para-cima */
const decimalStringToCents = (text: string): number => {
  const match = /^([-+]?)(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!match) return Number.NaN;
  const sign = match[1] === "-" ? -1 : 1;
  const integer = Number(match[2] || "0");
  const fraction = (match[3] ?? "").padEnd(3, "0");
  const cents = Number(fraction.slice(0, 2));
  const roundUp = Number(fraction[2]) >= 5 ? 1 : 0;
  return sign * (integer * 100 + cents + roundUp);
};

/**
 * Valor em reais → centavos inteiros, sem erro de ponto flutuante
 * (ex.: `toCents(19.99) === 1999`, `toCents(1.005) === 101`).
 */
export const toCents = (value: number | string): number => {
  if (typeof value === "string") return decimalStringToCents(value);
  if (!Number.isFinite(value)) return Number.NaN;
  const sign = value < 0 ? -1 : 1;
  // toPrecision(15) remove o ruído binário (1.005 * 100 = 100.49999…)
  const scaled = Number((Math.abs(value) * 100).toPrecision(15));
  const cents = Math.round(scaled);
  return cents === 0 ? 0 : sign * cents;
};

/** Centavos inteiros → reais */
export const fromCents = (cents: number): number => cents / 100;
