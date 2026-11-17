'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/**
 * Translates keys that are only known at run time (e.g. a permission key from the API), with a
 * fallback when the translation file has no entry yet — a new API permission then shows its key
 * instead of breaking the page.
 */
export function useDynamicT() {
  const t = useTranslations();
  return useCallback(
    (key: string, fallback: string, values?: Record<string, string | number>) => {
      const loose = t as unknown as {
        (k: string, v?: Record<string, string | number>): string;
        has: (k: string) => boolean;
      };
      return loose.has(key) ? loose(key, values) : fallback;
    },
    [t],
  );
}
