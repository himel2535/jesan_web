'use client';

import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { dealershipKeys } from '../master-data/api';
import type { Page } from '../master-data/types';
import type {
  Purchase,
  PurchaseFilters,
  PurchaseInput,
  PurchasePatch,
  PurchaseSummary,
  PurchaseTotals,
  PurchaseTotalsFilters,
} from './types';
import type { PurchaseSummaryRanges } from './shared';

const base = (slug: string) => `/b/${encodeURIComponent(slug)}/purchases`;

/** A purchase changes stock and the products' last purchase price: refresh exactly those. */
export const PURCHASE_REFRESH = ['purchases', 'purchasesSummary', 'stock', 'products'] as const;

export function useRefreshAfterPurchase(businessId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      PURCHASE_REFRESH.map((entity) =>
        queryClient.invalidateQueries({ queryKey: dealershipKeys.entity(businessId, entity) }),
      ),
    );
}

function cleanFilters(f: PurchaseFilters) {
  const out: Record<string, string | number> = { page: f.page };
  for (const key of ['from', 'to', 'supplierId', 'productId', 'status'] as const) {
    const v = f[key];
    if (v) out[key] = v;
  }
  return out;
}

export function usePurchases(slug: string, businessId: string, filters: PurchaseFilters) {
  const clean = cleanFilters(filters);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'purchases', clean),
    queryFn: ({ signal }) => apiFetch<Page<PurchaseSummary>>(base(slug), { query: clean, signal }),
    placeholderData: keepPreviousData,
  });
}

export function usePurchase(slug: string, businessId: string, id: string) {
  return useQuery({
    queryKey: dealershipKeys.detail(businessId, 'purchases', id),
    queryFn: ({ signal }) =>
      apiFetch<Purchase>(`${base(slug)}/${encodeURIComponent(id)}`, { signal }),
  });
}

/** `POST purchases` with one Idempotency-Key per open form (double click / retry safe). */
export function useCreatePurchase(slug: string, businessId: string) {
  const refresh = useRefreshAfterPurchase(businessId);
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: PurchaseInput; idempotencyKey: string }) =>
      apiFetch<Purchase>(base(slug), {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => refresh(),
  });
}

export function useCorrectPurchase(slug: string, businessId: string) {
  const refresh = useRefreshAfterPurchase(businessId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PurchasePatch }) =>
      apiFetch<Purchase>(`${base(slug)}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => refresh(),
  });
}

export function useVoidPurchase(slug: string, businessId: string) {
  const refresh = useRefreshAfterPurchase(businessId);
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<Purchase>(`${base(slug)}/${encodeURIComponent(id)}/void`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => refresh(),
  });
}

/** Exported so a one-off range (e.g. the dashboard's "previous month" trend) can reuse it. */
export function purchaseTotalsQuery(
  slug: string,
  businessId: string,
  filters: PurchaseTotalsFilters,
) {
  const query = { from: filters.from, to: filters.to };
  return {
    queryKey: dealershipKeys.list(businessId, 'purchasesSummary', query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<PurchaseTotals>(`${base(slug)}/summary`, { query, signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  };
}

/** The KPI cards' four fixed date windows (`total`/`today`/`thisMonth`/`thisYear`), fetched together. */
export function usePurchasesSummary(
  slug: string,
  businessId: string,
  ranges: PurchaseSummaryRanges,
) {
  const [total, today, thisMonth, thisYear] = useQueries({
    queries: [
      purchaseTotalsQuery(slug, businessId, ranges.total),
      purchaseTotalsQuery(slug, businessId, ranges.today),
      purchaseTotalsQuery(slug, businessId, ranges.thisMonth),
      purchaseTotalsQuery(slug, businessId, ranges.thisYear),
    ],
  });
  return { total, today, thisMonth, thisYear };
}
