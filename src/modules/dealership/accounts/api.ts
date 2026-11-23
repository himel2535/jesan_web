'use client';

import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { dealershipKeys } from '../master-data/api';
import type { AccountsDashboardRanges } from './shared';
import type { AccountsSummary, LedgerFilters, LedgerResponse } from './types';

const base = (slug: string) => `/b/${encodeURIComponent(slug)}`;

function clean<T extends { page: number }>(filters: T, keys: readonly (keyof T)[]) {
  const out: Record<string, string | number> = { page: filters.page };
  for (const key of keys) {
    const value = filters[key];
    if (typeof value === 'string' && value) out[String(key)] = value;
  }
  return out;
}

// ---- Summary ----

function accountsSummaryQuery(
  slug: string,
  businessId: string,
  filters: { from: string; to: string },
) {
  const query = { from: filters.from, to: filters.to };
  return {
    queryKey: dealershipKeys.list(businessId, 'accountsSummary', query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<AccountsSummary>(`${base(slug)}/accounts/summary`, { query, signal }),
    staleTime: 60_000,
  };
}

export function useAccountsSummary(
  slug: string,
  businessId: string,
  filters: { from?: string; to?: string },
) {
  const query: Record<string, string> = {};
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'accountsSummary', query),
    queryFn: ({ signal }) =>
      apiFetch<AccountsSummary>(`${base(slug)}/accounts/summary`, { query, signal }),
    staleTime: 60_000,
  });
}

/**
 * The dashboard's three accounts KPI windows (`ledger.view`). `totalDue`/`totalAdvance` are
 * date-range independent (docs/API.md §accounts/summary), so only one of the three is used for
 * those two fields — the dashboard section shows them once, not per window.
 */
export function useAccountsSummaryRanges(
  slug: string,
  businessId: string,
  ranges: AccountsDashboardRanges,
) {
  const [total, today, thisMonth] = useQueries({
    queries: [
      accountsSummaryQuery(slug, businessId, ranges.total),
      accountsSummaryQuery(slug, businessId, ranges.today),
      accountsSummaryQuery(slug, businessId, ranges.thisMonth),
    ],
  });
  return { total, today, thisMonth };
}

// ---- Ledger ----

const LEDGER_FILTER_KEYS = ['from', 'to', 'type'] as const;

export function useAccountsLedger(
  slug: string,
  businessId: string,
  filters: LedgerFilters,
  enabled = true,
) {
  const query = clean(filters, LEDGER_FILTER_KEYS);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'accountsLedger', query),
    queryFn: ({ signal }) =>
      apiFetch<LedgerResponse>(`${base(slug)}/accounts/ledger`, { query, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
