import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

export const DEFAULT_STALE_TIME_MS = 30_000;

/** Retry once, but never on 4xx: the same request will fail the same way. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.isClientError) return false;
  return failureCount < 1;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
      mutations: { retry: false },
    },
  });
}
