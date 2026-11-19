import { toLatinDigits } from './phone';

/**
 * Money is a STRING end to end (docs/API.md §1): never parsed into a JavaScript number, never
 * calculated in the browser. Patterns copied from jesan-api `src/core/common/money.ts`
 * (Decimal(14,2): up to 12 integer digits, up to 2 decimals).
 */
export const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
export const SIGNED_MONEY_PATTERN = /^-?\d{1,12}(\.\d{1,2})?$/;

/** What the user typed → what the API expects: trimmed, Latin digits, no thousands commas. */
export function cleanMoneyInput(value: string): string {
  return toLatinDigits(value).trim().replace(/[,\s]/g, '');
}

/** Negative balance = advance. Decided from the sign character, not by number conversion. */
export function isNegativeMoney(value: string): boolean {
  return value.trim().startsWith('-');
}

export function absoluteMoney(value: string): string {
  return value.trim().replace(/^-/, '');
}

/**
 * Two money strings mean the same amount ("570" vs "570.00")? Compared as text after
 * normalizing the decimals, so a PATCH only sends real changes. No float involved.
 */
export function sameMoney(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined) => {
    if (v === null || v === undefined || v.trim() === '') return null;
    const t = v.trim();
    const sign = t.startsWith('-') ? '-' : '';
    const [int = '', frac = ''] = absoluteMoney(t).split('.');
    return `${sign}${int.replace(/^0+(?=\d)/, '')}.${(frac + '00').slice(0, 2)}`;
  };
  return norm(a) === norm(b);
}

/** "12.345" → { units: 12345n, scale: 3 } (non-negative decimal strings only). */
function toScaled(value: string): { units: bigint; scale: number } {
  const [int = '0', frac = ''] = value.trim().split('.');
  return { units: BigInt(`${int || '0'}${frac}`), scale: frac.length };
}

/** Scaled integer (in cents) → "1234.50". */
function centsToMoney(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const int = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${int}.${frac}`;
}

/**
 * Quantity × unit price for DISPLAY ONLY (the server computes and stores the real total):
 * exact decimal arithmetic on BigInt, rounded half up to 2 decimals like jesan-api.
 * Returns null when either input is not a valid non-negative decimal.
 */
export function multiplyMoney(quantity: string, unitPrice: string): string | null {
  const decimal = /^\d+(\.\d+)?$/;
  if (!decimal.test(quantity.trim()) || !decimal.test(unitPrice.trim())) return null;
  const q = toScaled(quantity);
  const p = toScaled(unitPrice);
  const product = q.units * p.units; // scale q.scale + p.scale
  const scale = q.scale + p.scale;
  if (scale <= 2) return centsToMoney(product * 10n ** BigInt(2 - scale));
  const divisor = 10n ** BigInt(scale - 2);
  const cents = product / divisor;
  const rest = product % divisor;
  return centsToMoney(rest * 2n >= divisor ? cents + 1n : cents);
}

/** Sum of money strings ("570.00", "12.5") for display; null if any is invalid. */
export function sumMoney(values: readonly string[]): string | null {
  let total = 0n;
  for (const v of values) {
    const t = v.trim();
    if (!SIGNED_MONEY_PATTERN.test(t)) return null;
    const negative = t.startsWith('-');
    const [int = '0', frac = ''] = absoluteMoney(t).split('.');
    const cents = BigInt(int) * 100n + BigInt((frac + '00').slice(0, 2));
    total += negative ? -cents : cents;
  }
  return centsToMoney(total);
}
