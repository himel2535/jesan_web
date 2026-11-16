import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { DEFAULT_STALE_TIME_MS, makeQueryClient, shouldRetry } from './query-client';
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
  it('caches for 30 s and does not refetch on window focus', () => {
    const defaults = makeQueryClient().getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(DEFAULT_STALE_TIME_MS);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
  });

  it('retries once, never on 4xx', () => {
    const http = (status: number) =>
      new ApiError({ kind: 'http', status, code: `HTTP_${status}`, message: '' });
    expect(shouldRetry(0, http(500))).toBe(true);
    expect(shouldRetry(1, http(500))).toBe(false);
    expect(shouldRetry(0, http(404))).toBe(false);
    expect(
      shouldRetry(0, new ApiError({ kind: 'timeout', status: 0, code: 'TIMEOUT', message: '' })),
    ).toBe(true);
  });
});
