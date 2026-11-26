import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { dealershipKeys } from '../master-data/api';
import type { CashbookResponse, CommissionSeriesResponse, MonthlySeriesResponse } from './types';

const base = (slug: string) => `/b/${encodeURIComponent(slug)}/dashboard`;

export interface DashboardRange {
  from: string;
  to: string;
}

/** Cash, bank and unassigned positions for a date range (`cashbook.view`). */
export function dashboardCashbookQuery(slug: string, businessId: string, range: DashboardRange) {
  return {
    queryKey: dealershipKeys.list(businessId, 'dashboardCashbook', { ...range }),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<CashbookResponse>(`${base(slug)}/cashbook`, { query: { ...range }, signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  };
}

/** Twelve months of collection, sales and quantities for one year (`report.view`). */
export function dashboardMonthlySeriesQuery(slug: string, businessId: string, year: number) {
  return {
    queryKey: dealershipKeys.list(businessId, 'dashboardMonthly', { year }),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<MonthlySeriesResponse>(`${base(slug)}/monthly-series`, { query: { year }, signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  };
}

/** Commission by month, calculated and received (`commission.view`, owner-only). */
export function dashboardCommissionSeriesQuery(slug: string, businessId: string, year: number) {
  return {
    queryKey: dealershipKeys.list(businessId, 'dashboardCommission', { year }),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<CommissionSeriesResponse>(`${base(slug)}/commission-series`, {
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
