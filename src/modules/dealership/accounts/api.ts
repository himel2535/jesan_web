'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
