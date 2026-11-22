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

/** Query options for a sales report window; shared by `useSalesReport` and KPI-card `useQueries` groups. */
export function salesReportQuery(slug: string, businessId: string, filters: SalesReportFilters) {
  const query = clean(filters, SALES_FILTER_KEYS);
  return {
    queryKey: dealershipKeys.list(businessId, 'reportsSales', query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<SalesReportResponse>(`${base(slug)}/reports/sales`, { query, signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  };
}

/** Every report is `report.view`, read-only, and never carries a purchase price, profit or commission figure. */
export function useSalesReport(slug: string, businessId: string, filters: SalesReportFilters) {
  return useQuery(salesReportQuery(slug, businessId, filters));
}

const COLLECTIONS_FILTER_KEYS = ['groupBy', 'from', 'to'] as const;

/** Query options for a collections report window; shared by `useCollectionsReport` and KPI-card `useQueries` groups. */
export function collectionsReportQuery(
  slug: string,
  businessId: string,
  filters: CollectionsReportFilters,
) {
  const query = clean(filters, COLLECTIONS_FILTER_KEYS);
  return {
    queryKey: dealershipKeys.list(businessId, 'reportsCollections', query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<CollectionsReportResponse>(`${base(slug)}/reports/collections`, { query, signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  };
}

export function useCollectionsReport(
  slug: string,
  businessId: string,
  filters: CollectionsReportFilters,
) {
  return useQuery(collectionsReportQuery(slug, businessId, filters));
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

/** Query options for an expenses report window; shared by `useExpensesReport` and KPI-card `useQueries` groups. No `page`: jesan-api never paginates this one. */
export function expensesReportQuery(
  slug: string,
  businessId: string,
  filters: ExpensesReportFilters,
) {
  const query: Record<string, string> = { groupBy: filters.groupBy };
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  return {
    queryKey: dealershipKeys.list(businessId, 'reportsExpenses', query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<ExpensesReportResponse>(`${base(slug)}/reports/expenses`, { query, signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  };
}

export function useExpensesReport(
  slug: string,
  businessId: string,
  filters: ExpensesReportFilters,
) {
  return useQuery(expensesReportQuery(slug, businessId, filters));
}

/** No filter on the dashboard: an empty `date` is a deliberate request for "today", not stale. */
export function useDailySummary(slug: string, businessId: string) {
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'dailySummary', {}),
    queryFn: ({ signal }) =>
      apiFetch<DailySummaryResponse>(`${base(slug)}/reports/daily-summary`, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
