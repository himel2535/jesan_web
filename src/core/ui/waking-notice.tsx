'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * One app-wide line for the case the user would otherwise read as "the server is broken": the free
 * Render instance has gone to sleep, the first request failed, and the query is trying again
 * (`shouldRetry`, up to three times). Watching the query cache keeps this in one place, so no page
 * needs its own code for it, and nothing is shown while a page simply loads for the first time.
 */
export function useServerWaking(): boolean {
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();

  const subscribe = useCallback((onChange: () => void) => cache.subscribe(onChange), [cache]);
  const waking = useCallback(
    () =>
      cache
        .getAll()
        .some(
          (query) => query.state.fetchStatus === 'fetching' && query.state.fetchFailureCount > 0,
        ),
    [cache],
  );

  // The server never retries, so it renders the same thing as the first client paint: nothing.
  return useSyncExternalStore(subscribe, waking, () => false);
}

export function WakingNotice() {
  const t = useTranslations('common');
  const waking = useServerWaking();

  return (
    <div role="status" aria-live="polite">
      {waking ? (
        <p className="border-b border-border bg-surface-muted px-4 py-2 text-center text-sm font-medium text-fg-muted md:px-6">
          {t('serverWaking')}
        </p>
      ) : null}
    </div>
  );
}
