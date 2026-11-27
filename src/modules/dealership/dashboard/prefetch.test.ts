import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardKpisQuery } from './api';
import { dayPeriods, monthPeriods } from './periods';

const getter = vi.hoisted(() => vi.fn());
vi.mock('@/core/api/server', () => ({ serverGetter: getter }));

const { prefetchDashboard } = await import('./prefetch');

const TODAY = '2026-11-27';
const options = {
  slug: 'example-cement',
  businessId: 'b1',
  today: TODAY,
  canCommission: true,
  canCashbook: true,
};

describe('prefetchDashboard', () => {
  beforeEach(() => {
    getter.mockReset();
  });

  it('fills the cache under the keys the browser asks for, so the cards paint with data', async () => {
    getter.mockImplementation(async (path: string) => ({ path }));
    const queryClient = new QueryClient();
    await prefetchDashboard(queryClient, options);

    for (const windows of [monthPeriods(TODAY, 'thisMonth'), dayPeriods(TODAY, 'today')]) {
      const { queryKey } = dashboardKpisQuery('example-cement', 'b1', windows.current);
      expect(queryClient.getQueryData(queryKey)).toEqual({
        path: '/b/example-cement/dashboard/kpis',
      });
    }
    const paths = getter.mock.calls.map((call) => call[0] as string);
    // The KPI rows cost one request each; commission and cash book are included for an owner.
    expect(paths.filter((p) => p.endsWith('/kpis'))).toHaveLength(2);
    // No comparison window is ever asked for.
    expect(getter.mock.calls.some((call) => JSON.stringify(call).includes('prevFrom'))).toBe(false);
    expect(paths.some((p) => p.endsWith('/commission-series'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/cashbook'))).toBe(true);
  });

  it('skips what the person may not see, so no request is wasted on a 403', async () => {
    getter.mockResolvedValue({});
    await prefetchDashboard(new QueryClient(), {
      ...options,
      canCommission: false,
      canCashbook: false,
    });
    const paths = getter.mock.calls.map((call) => call[0] as string);
    expect(paths.some((p) => p.endsWith('/commission-series'))).toBe(false);
    expect(paths.some((p) => p.endsWith('/cashbook'))).toBe(false);
  });

  it('never waits longer than the budget for a slow API', async () => {
    getter.mockImplementation(() => new Promise(() => undefined));
    const queryClient = new QueryClient();
    const started = Date.now();
    await prefetchDashboard(queryClient, { ...options, budgetMs: 30 });
    expect(Date.now() - started).toBeLessThan(500);
    const { queryKey } = dashboardKpisQuery(
      'example-cement',
      'b1',
      monthPeriods(TODAY, 'thisMonth').current,
    );
    expect(queryClient.getQueryData(queryKey)).toBeUndefined();
  });

  it('leaves a failed request to the browser, and keeps the ones that worked', async () => {
    getter.mockImplementation(async (path: string) => {
      if (path.endsWith('/finance-summary')) throw new Error('boom');
      return { ok: true };
    });
    const queryClient = new QueryClient();
    await prefetchDashboard(queryClient, options);
    const { queryKey } = dashboardKpisQuery(
      'example-cement',
      'b1',
      monthPeriods(TODAY, 'thisMonth').current,
    );
    expect(queryClient.getQueryData(queryKey)).toEqual({ ok: true });
  });
});
