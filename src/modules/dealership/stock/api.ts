'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { useCan } from '@/core/auth/can';
import { dealershipKeys } from '../master-data/api';
import type { Page } from '../master-data/types';
import type { MovementFilters, MovementsPage, StockFilters, StockRow } from './types';

const base = (slug: string) => `/b/${encodeURIComponent(slug)}/stock`;

function cleanStock(f: StockFilters) {
  const out: Record<string, string | number> = { page: f.page ?? 1 };
  if (f.search) out.search = f.search;
  if (f.categoryId) out.categoryId = f.categoryId;
  if (f.active && f.active !== 'true') out.active = f.active;
  return out;
}

/** Query options for `GET stock`, for composing with `useQueries` (e.g. multi-page totals). */
export function stockQuery(slug: string, businessId: string, filters: StockFilters) {
  const clean = cleanStock(filters);
  return {
    queryKey: dealershipKeys.list(businessId, 'stock', clean),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<Page<StockRow>>(base(slug), { query: clean, signal }),
    placeholderData: keepPreviousData,
  };
}

/** Current stock per product (`stock.view`); `enabled: false` skips the call entirely. */
export function useStock(slug: string, businessId: string, filters: StockFilters, enabled = true) {
  return useQuery({ ...stockQuery(slug, businessId, filters), enabled });
}

export function useMovements(
  slug: string,
  businessId: string,
  productId: string,
  filters: MovementFilters,
  enabled = true,
) {
  const clean: Record<string, string | number> = { page: filters.page };
  for (const key of ['from', 'to', 'kind'] as const) if (filters[key]) clean[key] = filters[key]!;
  return useQuery({
    queryKey: [...dealershipKeys.detail(businessId, 'stock', productId), 'movements', clean],
    queryFn: ({ signal }) =>
      apiFetch<MovementsPage>(`${base(slug)}/${encodeURIComponent(productId)}/movements`, {
        query: clean,
        signal,
      }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Current stock of one product for its detail page (first movements page carries it). */
export function useProductStock(slug: string, businessId: string, productId: string) {
  const canView = useCan('stock.view');
  return useMovements(slug, businessId, productId, { page: 1 }, canView);
}

/** `POST stock/adjustments`: only the stock changes, so only `stock` refreshes. */
export function useAdjustStock(slug: string, businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; quantity: string; reason: string }) =>
      apiFetch<StockRow>(`${base(slug)}/adjustments`, { method: 'POST', body: input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dealershipKeys.entity(businessId, 'stock') }),
  });
}
