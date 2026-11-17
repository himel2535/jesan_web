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
