import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { serverGetter } from '@/core/api/server';
import {
  dashboardCashbookQuery,
  dashboardCommissionSeriesQuery,
  dashboardFinanceSummaryQuery,
  dashboardKpisQuery,
  dashboardMonthlySeriesQuery,
} from './api';
import { dayPeriods, monthPeriods } from './periods';

/** How long the page may wait for the API before it renders without the data and lets the browser fetch. */
export const PREFETCH_BUDGET_MS = 1000;

/**
 * Starts the first-paint requests of the dashboard on the server and waits for them, but never
 * longer than `budgetMs`: whatever has arrived is handed to the browser (so those cards paint with
 * data), and anything still running is simply fetched by the browser as before. A failed request
 * is skipped, the same query then runs (and reports its error) in the browser.
 *
 * The queries are the browser's own (same factories, same keys, same default windows: this month
 * against the same days last month, and today against yesterday), only fetched with the server's
 * getter.
 */
export async function prefetchDashboard(
  queryClient: QueryClient,
  options: {
    slug: string;
    businessId: string;
    today: string;
    canCommission: boolean;
    canCashbook: boolean;
    budgetMs?: number;
  },
): Promise<void> {
  const {
    slug,
    businessId,
    today,
    canCommission,
    canCashbook,
    budgetMs = PREFETCH_BUDGET_MS,
  } = options;
  const get = serverGetter;
  const month = monthPeriods(today, 'thisMonth');
  const day = dayPeriods(today, 'today');
  const year = Number(today.slice(0, 4));

  /** Starts one factory-built query in the server's cache under the key the browser will use. */
  const start = (query: {
    queryKey: QueryKey;
    queryFn: (context: { signal: AbortSignal }) => Promise<unknown>;
    staleTime: number;
  }) =>
    queryClient.prefetchQuery({
      queryKey: query.queryKey,
      queryFn: () => query.queryFn({ signal: new AbortController().signal }),
      staleTime: query.staleTime,
    });

  const requests = [
    dashboardKpisQuery(slug, businessId, month, get),
    dashboardKpisQuery(slug, businessId, day, get),
    dashboardFinanceSummaryQuery(slug, businessId, month.current, get),
    dashboardFinanceSummaryQuery(slug, businessId, month.previous ?? month.current, get),
    dashboardFinanceSummaryQuery(slug, businessId, day.current, get),
    dashboardMonthlySeriesQuery(slug, businessId, year, get),
    dashboardMonthlySeriesQuery(slug, businessId, year - 1, get),
    ...(canCommission
      ? [
          dashboardCommissionSeriesQuery(slug, businessId, year, get),
          dashboardCommissionSeriesQuery(slug, businessId, year - 1, get),
        ]
      : []),
    ...(canCashbook ? [dashboardCashbookQuery(slug, businessId, month.current, get)] : []),
  ].map((query) => start(query));

  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, budgetMs);
  });
  await Promise.race([Promise.allSettled(requests), budget]);
  clearTimeout(timer);
}
