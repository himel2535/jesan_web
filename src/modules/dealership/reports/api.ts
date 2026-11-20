'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { dealershipKeys } from '../master-data/api';
import type {
  CollectionsReportFilters,
  CollectionsReportResponse,
  DailySummaryResponse,
  DuesReportFilters,
  DuesReportResponse,
  ExpensesReportFilters,
  ExpensesReportResponse,
  SalesReportFilters,
  SalesReportResponse,
  StockMovementsFilters,
  StockMovementsResponse,
  StockReportFilters,
  StockReportResponse,
} from './types';

const base = (slug: string) => `/b/${encodeURIComponent(slug)}`;

/** Only set filters reach the key and the query string (`page` always included). */
function clean<T extends { page: number }>(filters: T, keys: readonly (keyof T)[]) {
  const out: Record<string, string | number> = { page: filters.page };
  for (const key of keys) {
    const value = filters[key];
    if (typeof value === 'string' && value) out[String(key)] = value;
  }
  return out;
}

const SALES_FILTER_KEYS = ['groupBy', 'from', 'to'] as const;

/** Every report is `report.view`, read-only, and never carries a purchase price, profit or commission figure. */
export function useSalesReport(slug: string, businessId: string, filters: SalesReportFilters) {
  const query = clean(filters, SALES_FILTER_KEYS);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'reportsSales', query),
    queryFn: ({ signal }) =>
      apiFetch<SalesReportResponse>(`${base(slug)}/reports/sales`, { query, signal }),
    placeholderData: keepPreviousData,
  });
}

const COLLECTIONS_FILTER_KEYS = ['groupBy', 'from', 'to'] as const;

export function useCollectionsReport(
  slug: string,
  businessId: string,
  filters: CollectionsReportFilters,
) {
  const query = clean(filters, COLLECTIONS_FILTER_KEYS);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'reportsCollections', query),
    queryFn: ({ signal }) =>
      apiFetch<CollectionsReportResponse>(`${base(slug)}/reports/collections`, { query, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useDuesReport(slug: string, businessId: string, filters: DuesReportFilters) {
  const query = clean(filters, []);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'reportsDues', query),
    queryFn: ({ signal }) =>
      apiFetch<DuesReportResponse>(`${base(slug)}/reports/dues`, { query, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useStockReport(slug: string, businessId: string, filters: StockReportFilters) {
  const query = clean(filters, []);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'reportsStock', query),
    queryFn: ({ signal }) =>
      apiFetch<StockReportResponse>(`${base(slug)}/reports/stock`, { query, signal }),
    placeholderData: keepPreviousData,
  });
}

const STOCK_MOVEMENTS_FILTER_KEYS = ['from', 'to'] as const;

export function useStockMovementsReport(
  slug: string,
  businessId: string,
  filters: StockMovementsFilters,
) {
  const query = clean(filters, STOCK_MOVEMENTS_FILTER_KEYS);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'reportsStockMovements', query),
    queryFn: ({ signal }) =>
      apiFetch<StockMovementsResponse>(`${base(slug)}/reports/stock-movements`, {
        query,
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

/** No `page`: jesan-api never paginates this one. */
export function useExpensesReport(
  slug: string,
  businessId: string,
  filters: ExpensesReportFilters,
) {
  const query: Record<string, string> = { groupBy: filters.groupBy };
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'reportsExpenses', query),
    queryFn: ({ signal }) =>
      apiFetch<ExpensesReportResponse>(`${base(slug)}/reports/expenses`, { query, signal }),
    placeholderData: keepPreviousData,
  });
}

/** No filter on the dashboard: an empty `date` is a deliberate request for "today", not stale. */
export function useDailySummary(slug: string, businessId: string) {
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'dailySummary', {}),
    queryFn: ({ signal }) =>
      apiFetch<DailySummaryResponse>(`${base(slug)}/reports/daily-summary`, { signal }),
  });
}
