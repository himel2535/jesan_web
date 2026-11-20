import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import {
  DEFAULT_STALE_TIME_MS,
  isWakingError,
  makeQueryClient,
  retryDelay,
  shouldRetry,
} from './query-client';
import { createModuleKeys } from './query-keys';

describe('createModuleKeys', () => {
  const keys = createModuleKeys('dealership');

  it('always starts with module, then businessId', () => {
    expect(keys.all).toEqual(['dealership']);
    expect(keys.list('b1', 'sales', { page: 2 })).toEqual([
      'dealership',
      'b1',
      'sales',
      'list',
      { page: 2 },
    ]);
    expect(keys.detail('b1', 'customers', 'c9')).toEqual([
      'dealership',
      'b1',
      'customers',
      'detail',
      'c9',
    ]);
  });

  it('lets invalidation target one entity without touching others', async () => {
    const client = makeQueryClient();
    client.setQueryData(keys.list('b1', 'sales'), ['s']);
    client.setQueryData(keys.list('b1', 'products'), ['p']);
    client.setQueryData(createModuleKeys('manufacturing').list('b2', 'sales'), ['m']);

    await client.invalidateQueries({ queryKey: keys.entity('b1', 'sales') });

    const state = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
    expect(state(keys.list('b1', 'sales'))).toBe(true);
    expect(state(keys.list('b1', 'products'))).toBe(false);
    expect(state(createModuleKeys('manufacturing').list('b2', 'sales'))).toBe(false);
  });
});

describe('query client defaults', () => {
  const http = (status: number) =>
    new ApiError({ kind: 'http', status, code: `HTTP_${status}`, message: '' });

  it('caches for 30 s and does not refetch on window focus', () => {
    const defaults = makeQueryClient().getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(DEFAULT_STALE_TIME_MS);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
  });

  it('retries a plain 5xx once, never a 4xx', () => {
    expect(shouldRetry(0, http(500))).toBe(true);
    expect(shouldRetry(1, http(500))).toBe(false);
    for (const status of [400, 401, 403, 404, 409, 422, 429]) {
      expect(shouldRetry(0, http(status))).toBe(false);
    }
  });

  // A free Render instance answers nothing until it has woken up, which takes a few seconds.
  it('retries a waking server three times: network, timeout and 502/503/504', () => {
    const waking = [
      new ApiError({ kind: 'network', status: 0, code: 'NETWORK', message: '' }),
      new ApiError({ kind: 'timeout', status: 0, code: 'TIMEOUT', message: '' }),
      http(502),
      http(503),
      http(504),
    ];
    for (const error of waking) {
      expect(isWakingError(error)).toBe(true);
      expect(shouldRetry(0, error)).toBe(true);
      expect(shouldRetry(2, error)).toBe(true);
      expect(shouldRetry(3, error)).toBe(false);
    }
    expect(isWakingError(http(500))).toBe(false);
    expect(isWakingError(http(404))).toBe(false);
  });

  // TanStack rethrows the caller's AbortError as-is: retrying a cancelled request is a bug.
  it('never retries something that is not an ApiError', () => {
    expect(shouldRetry(0, new DOMException('Aborted', 'AbortError'))).toBe(false);
    expect(shouldRetry(0, new Error('boom'))).toBe(false);
    expect(isWakingError(new Error('boom'))).toBe(false);
  });

  it('waits longer between each attempt, capped at 8 s', () => {
    expect([0, 1, 2, 3, 4].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 8000]);
    expect(makeQueryClient().getDefaultOptions().queries?.retryDelay).toBe(retryDelay);
  });
});
