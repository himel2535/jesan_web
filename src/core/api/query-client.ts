import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

export const DEFAULT_STALE_TIME_MS = 30_000;

/** Statuses a sleeping or restarting backend returns while it comes up. */
const WAKING_STATUSES = new Set([502, 503, 504]);

/** True while the error only means "the server is not up yet", not "the request is wrong". */
export function isWakingError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.kind !== 'http' || WAKING_STATUSES.has(error.status);
}

/**
 * How often a failed read is sent again:
 * - a cancelled request (not an ApiError) is never retried;
 * - 4xx never, the same request would fail the same way;
 * - a server that is only waking up (network, timeout, 502/503/504) up to three times, because a
 *   free Render instance needs a few seconds to answer its first request;
 * - any other 5xx once, as before.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.isClientError) return false;
  return failureCount < (isWakingError(error) ? 3 : 1);
}

/** Growing gaps between those attempts: 1s, 2s, 4s (capped at 8s). */
export function retryDelay(failureCount: number): number {
  return Math.min(1000 * 2 ** failureCount, 8000);
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
        retryDelay,
      },
      mutations: { retry: false },
    },
  });
}
