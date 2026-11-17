'use client';

import { useSyncExternalStore } from 'react';

export const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * Whether a media query matches, kept in sync. On the server and where matchMedia is missing
 * (tests) it returns `serverValue` (default true = desktop layout).
 */
export function useMediaQuery(query: string, serverValue = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () =>
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(query).matches
        : serverValue,
    () => serverValue,
  );
}

/** Desktop (≥768px) shows tables; phones show cards. */
export const useIsDesktop = () => useMediaQuery(DESKTOP_QUERY);
