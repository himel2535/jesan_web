'use client';

import { formatISO, isToday } from 'date-fns';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { dealershipKeys } from '../master-data/api';
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

export function accountsSummaryQuery(
  slug: string,
  businessId: string,
  filters: { from?: string | Date | null; to?: string | Date | null },
) {
  const query: Record<string, string> = {};
  if (filters.from && filters.from !== null) {
    query.from = typeof filters.from === 'string' ? filters.from : formatISO(filters.from, { representation: 'date' });
  }
  if (filters.to && filters.to !== null) {
    query.to = typeof filters.to === 'string' ? filters.to : formatISO(filters.to, { representation: 'date' });
  }
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
  return useQuery(accountsSummaryQuery(slug, businessId, filters));
}

export function useAccountsSummaryRanges(
  slug: string,
  businessId: string,
  ranges: { all: null; today: { from: Date; to: Date }; thisMonth: { from: Date; to: Date } },
) {
  return useQueries({
    queries: [
      accountsSummaryQuery(slug, businessId, { from: null, to: null }),
      accountsSummaryQuery(slug, businessId, ranges.today),
      accountsSummaryQuery(slug, businessId, ranges.thisMonth),
    ],
  });
}

// ---- Ledger ----

const LEDGER_FILTER_KEYS = ['from', 'to', 'type'] as const;

export function useAccountsLedger(slug: string, businessId: string, filters: LedgerFilters) {
  const query = clean(filters, LEDGER_FILTER_KEYS);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'accountsLedger', query),
    queryFn: ({ signal }) =>
      apiFetch<LedgerResponse>(`${base(slug)}/accounts/ledger`, { query, signal }),
    placeholderData: keepPreviousData,
  });
}
