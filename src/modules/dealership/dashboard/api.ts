import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch, type ApiGetter } from '@/core/api/client';
import { dealershipKeys } from '../keys';
import type {
  CashbookResponse,
  CommissionSeriesResponse,
  FinanceSummaryResponse,
  KpisResponse,
  MonthlySeriesResponse,
} from './types';

const base = (slug: string) => `/b/${encodeURIComponent(slug)}/dashboard`;

export interface DashboardRange {
  from: string;
  to: string;
}

/** Cash, bank and unassigned positions for a date range (`cashbook.view`). */
export function dashboardCashbookQuery(
  slug: string,
  businessId: string,
  range: DashboardRange,
  get: ApiGetter = apiFetch,
) {
  return {
    queryKey: dealershipKeys.list(businessId, 'dashboardCashbook', { ...range }),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      get<CashbookResponse>(`${base(slug)}/cashbook`, { query: { ...range }, signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  };
}

/** Twelve months of collection, sales and quantities for one year (`report.view`). */
export function dashboardMonthlySeriesQuery(
  slug: string,
  businessId: string,
  year: number,
  get: ApiGetter = apiFetch,
) {
  return {
    queryKey: dealershipKeys.list(businessId, 'dashboardMonthly', { year }),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      get<MonthlySeriesResponse>(`${base(slug)}/monthly-series`, { query: { year }, signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  };
}

/** Commission received by month (`commission.view`, owner-only). */
export function dashboardCommissionSeriesQuery(
  slug: string,
  businessId: string,
  year: number,
  get: ApiGetter = apiFetch,
) {
  return {
    queryKey: dealershipKeys.list(businessId, 'dashboardCommission', { year }),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      get<CommissionSeriesResponse>(`${base(slug)}/commission-series`, {
        query: { year },
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60_000,
  };
}

export function useDashboardCashbook(slug: string, businessId: string, range: DashboardRange) {
  return useQuery(dashboardCashbookQuery(slug, businessId, range));
}

export function useDashboardMonthlySeries(slug: string, businessId: string, year: number) {
  return useQuery(dashboardMonthlySeriesQuery(slug, businessId, year));
}

/** Owner-only: pass `enabled = false` for users without `commission.view`, so no request is sent. */
export function useDashboardCommissionSeries(
  slug: string,
  businessId: string,
  year: number,
  enabled = true,
) {
  return useQuery({ ...dashboardCommissionSeriesQuery(slug, businessId, year), enabled });
}

/** The whole Financial Summary for one window, in a single call (`report.view`). */
export function dashboardFinanceSummaryQuery(
  slug: string,
  businessId: string,
  range: DashboardRange,
  get: ApiGetter = apiFetch,
) {
  return {
    queryKey: dealershipKeys.list(businessId, 'dashboardFinance', { ...range }),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      get<FinanceSummaryResponse>(`${base(slug)}/finance-summary`, {
        query: { ...range },
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  };
}

export function useDashboardFinanceSummary(
  slug: string,
  businessId: string,
  range: DashboardRange,
) {
  return useQuery(dashboardFinanceSummaryQuery(slug, businessId, range));
}

/**
 * The four KPI figures (collection, sales, bags sold, bags bought) for one window in one call.
 * Cards that share the window share this query, so a whole row of cards costs one request.
 * There is no comparison window: the cards show the figure for what is selected, nothing else.
 */
export function dashboardKpisQuery(
  slug: string,
  businessId: string,
  range: DashboardRange,
  get: ApiGetter = apiFetch,
) {
  const query = { from: range.from, to: range.to };
  return {
    queryKey: dealershipKeys.list(businessId, 'dashboardKpis', query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      get<KpisResponse>(`${base(slug)}/kpis`, { query, signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  };
}

export function useDashboardKpis(slug: string, businessId: string, range: DashboardRange) {
  return useQuery(dashboardKpisQuery(slug, businessId, range));
}
