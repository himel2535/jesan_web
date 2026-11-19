import { toLatinDigits } from './phone';

/**
 * Quantities are STRINGS (docs/API.md §10): "500", "12.5". How many decimals a unit allows comes
 * from `GET product-units` (`decimals`; bags: 0). Never turned into a JavaScript number.
 */
export function cleanQuantityInput(value: string): string {
  return toLatinDigits(value).trim().replace(/[,\s]/g, '');
}

/** Above zero, at most `decimals` decimals (bags: whole numbers). */
export function isPositiveQuantity(value: string, decimals: number): boolean {
  const pattern = decimals > 0 ? new RegExp(`^\\d{1,12}(\\.\\d{1,${decimals}})?$`) : /^\d{1,12}$/;
  return pattern.test(value) && /[1-9]/.test(value);
}

/** Signed, non-zero (stock adjustments: "-3", "+5" or "5"). Returns the API form or null. */
export function signedQuantity(value: string, decimals: number): string | null {
  const v = cleanQuantityInput(value);
  const sign = v.startsWith('-') ? '-' : '';
  const body = v.replace(/^[+-]/, '');
  return isPositiveQuantity(body, decimals) ? `${sign}${body}` : null;
}

/** Sum of non-negative quantity strings for display; null if any is invalid. */
export function sumQuantity(values: readonly string[]): string | null {
  let scale = 0;
  for (const v of values) {
    if (!/^\d+(\.\d+)?$/.test(v)) return null;
    scale = Math.max(scale, (v.split('.')[1] ?? '').length);
  }
  let total = 0n;
  for (const v of values) {
    const [int = '0', frac = ''] = v.split('.');
    total += BigInt(`${int}${frac.padEnd(scale, '0')}`);
  }
  if (scale === 0) return total.toString();
  const s = total.toString().padStart(scale + 1, '0');
  const int = s.slice(0, -scale);
  const frac = s.slice(-scale).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}
