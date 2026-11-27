import { TIME_ZONE, intlTag, type Locale } from './config';

/**
 * The single place for number, money, quantity and date display.
 * Display only: amounts are calculated on the server (proposal rule 7). Strings are accepted so a
 * Decimal sent by the API as text is formatted exactly, without a float round-trip.
 */
export type NumericInput = number | bigint | string;

const TAKA = '৳';

function toIntlInput(value: NumericInput): number | bigint | `${number}` {
  return typeof value === 'string' ? (value.trim() as `${number}`) : value;
}

function isNegative(value: NumericInput): boolean {
  if (typeof value === 'string') return value.trim().startsWith('-');
  return value < 0;
}

function absolute(value: NumericInput): NumericInput {
  if (typeof value === 'string') return value.trim().replace(/^-/, '');
  if (typeof value === 'bigint') return value < 0n ? -value : value;
  return Math.abs(value);
}

export function formatNumber(
  value: NumericInput,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(intlTag[locale], options).format(toIntlInput(value));
}

/** ৳ in front, two decimals, lakh/crore grouping: ৳১২,৩৪,৫৬৭.৫০ / ৳12,34,567.50 */
export function formatMoney(value: NumericInput, locale: Locale): string {
  const digits = formatNumber(absolute(value), locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative(value) ? '-' : ''}${TAKA}${digits}`;
}

/**
 * A headline amount with no paisa: ৳ 3,25,750. For dashboard figures, where
 * two decimal places on every tile is noise. Everything that has to balance to
 * the paisa keeps using `formatMoney`.
 */
export function formatMoneyRounded(value: NumericInput, locale: Locale): string {
  const digits = formatNumber(absolute(value), locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${isNegative(value) ? '-' : ''}${TAKA} ${digits}`;
}

/** Quantities (bags, kg, …): up to `maxFractionDigits` decimals, none shown when whole. */
export function formatQuantity(value: NumericInput, locale: Locale, maxFractionDigits = 3): string {
  return formatNumber(value, locale, { maximumFractionDigits: maxFractionDigits });
}

export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(intlTag[locale], { timeZone: TIME_ZONE, ...options }).format(date);
}

/** Today's date (YYYY-MM-DD) in the business time zone, e.g. a purchase date's default and max. */
export function businessToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD; the time zone decides which day it is (Dhaka after midnight).
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}
