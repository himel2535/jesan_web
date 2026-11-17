/**
 * Same rule as jesan-api (`src/core/auth/identifier.ts` normalizePhone), so the form can say
 * "not valid" before sending: 01XXXXXXXXX, 8801XXXXXXXXX or any +international 8–15 digits.
 * Returns the normalized +8801… form, or null. The API stays the authority.
 */
export function normalizePhone(value: string): string | null {
  const compact = toLatinDigits(value).replace(/[\s\-().]/g, '');
  let candidate: string;
  if (/^01\d{9}$/.test(compact)) candidate = `+880${compact.slice(1)}`;
  else if (/^8801\d{9}$/.test(compact)) candidate = `+${compact}`;
  else candidate = compact;
  return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null;
}

const BENGALI_ZERO = '০'.charCodeAt(0);

/** ০১২৩ → 0123, so people can type in Bengali digits. */
export function toLatinDigits(value: string): string {
  return value.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - BENGALI_ZERO));
}
