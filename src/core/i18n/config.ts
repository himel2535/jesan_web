export const locales = ['bn', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'bn';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Business time zone; every date is shown in Bangladesh time regardless of the viewer. */
export const TIME_ZONE = 'Asia/Dhaka';

/**
 * Intl locale tag per app locale. `bn-BD` gives Bengali digits with lakh/crore grouping;
 * `en-IN` gives Latin digits with the same lakh/crore grouping (12,34,567).
 */
export const intlTag: Record<Locale, string> = { bn: 'bn-BD', en: 'en-IN' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Cookie first, then the browser's Accept-Language, then Bengali. */
export function resolveLocale(cookieValue?: string | null, acceptLanguage?: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(',')
      .map((part) => {
        const [tag = '', ...params] = part.trim().split(';');
        const q = params.find((p) => p.trim().startsWith('q='));
        return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q.trim().slice(2)) : 1 };
      })
      .filter((entry) => entry.q > 0)
      .sort((a, b) => b.q - a.q);
    for (const { lang } of ranked) if (isLocale(lang)) return lang;
  }
  return defaultLocale;
}
