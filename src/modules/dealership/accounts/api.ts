'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { dealershipKeys } from '../master-data/api';
import type {
  AccountsSummary,
  LedgerFilters,
  LedgerItem,
  LedgerResponse,
  ManualEntryInput,
  SupplierPaymentInput,
} from './types';

const base = (slug: string) => `/b/${encodeURIComponent(slug)}`;

export const ACCOUNTS_REFRESH = ['accountsSummary', 'accountsLedger'] as const;

function useInvalidate(businessId: string) {
  const queryClient = useQueryClient();
  return (entities: readonly string[]) =>
    Promise.all(
      entities.map((entity) =>
        queryClient.invalidateQueries({ queryKey: dealershipKeys.entity(businessId, entity) }),
      ),
    );
}

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

// ---- Collection methods (for dialogs) ----

export function useCollectionMethods(slug: string, businessId: string, enabled = true) {
  return useQuery({
    queryKey: dealershipKeys.entity(businessId, 'collection-methods'),
    queryFn: ({ signal }) =>
      apiFetch<{ items: string[] }>(`${base(slug)}/collection-methods`, { signal }).then(
        (r) => r.items,
      ),
    staleTime: 5 * 60_000,
    enabled,
  });
}

// ---- Manual entry ----

export function useCreateManualEntry(slug: string, businessId: string) {
  const invalidate = useInvalidate(businessId);
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: ManualEntryInput; idempotencyKey: string }) =>
      apiFetch<LedgerItem>(`${base(slug)}/accounts/entries`, {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => invalidate(ACCOUNTS_REFRESH),
  });
}

// ---- Supplier payment ----

export function useCreateSupplierPayment(slug: string, businessId: string) {
  const invalidate = useInvalidate(businessId);
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: SupplierPaymentInput;
      idempotencyKey: string;
    }) =>
      apiFetch<LedgerItem>(`${base(slug)}/accounts/payments`, {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => invalidate(ACCOUNTS_REFRESH),
  });
}
