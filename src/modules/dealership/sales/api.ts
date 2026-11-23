'use client';

import { formatISO } from 'date-fns';
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
import { collectionsReportQuery, salesReportQuery } from '../reports/api';
import type { SalesSummaryRanges } from './shared';
import type {
  Collection,
  CollectionFilters,
  CollectionInput,
  CollectionPatch,
  Delivery,
  DeliveryFilters,
  DeliveryInput,
  DeliveryPatch,
  LedgerFilters,
  LedgerPage,
  Order,
  OrderFilters,
  OrderInput,
  OrderPatch,
  OrderSummary,
  DeliverySummary,
} from './types';

const base = (slug: string) => `/b/${encodeURIComponent(slug)}`;

/**
 * What each change touches (docs/API.md §11), so a mutation invalidates exactly these keys:
 * - an order holds prices, so correcting one re-prices delivered lines → deliveries, balances
 * - a delivery moves stock and the ledger
 * - a collection only moves the balance and the ledger
 */
export const ORDER_CREATE_REFRESH = ['orders', 'customers'] as const;
export const ORDER_REFRESH = [
  'orders',
  'deliveries',
  'customers',
  'ledger',
  'accountsSummary',
  'reportsSales',
] as const;
export const DELIVERY_REFRESH = [
  'deliveries',
  'orders',
  'stock',
  'customers',
  'ledger',
  'accountsSummary',
  'reportsSales',
] as const;
export const COLLECTION_REFRESH = [
  'collections',
  'customers',
  'ledger',
  'accountsSummary',
  'accountsLedger',
] as const;

export function useRefreshEntities(businessId: string) {
  const queryClient = useQueryClient();
  return (entities: readonly string[]) =>
    Promise.all(
      entities.map((entity) =>
        queryClient.invalidateQueries({ queryKey: dealershipKeys.entity(businessId, entity) }),
      ),
    );
}

/** Only set filters reach the key and the query string. */
function clean<T extends { page: number }>(filters: T, keys: readonly (keyof T)[]) {
  const out: Record<string, string | number> = { page: filters.page };
  for (const key of keys) {
    const value = filters[key];
    if (typeof value === 'string' && value) out[String(key)] = value;
  }
  return out;
}

// ---- Orders ----

const ORDER_FILTER_KEYS = ['status', 'customerId', 'from', 'to'] as const;

function ordersQuery(slug: string, businessId: string, filters: OrderFilters) {
  const query = clean(filters, ORDER_FILTER_KEYS);
  return {
    queryKey: dealershipKeys.list(businessId, 'orders', query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<Page<OrderSummary>>(`${base(slug)}/orders`, { query, signal }),
    placeholderData: keepPreviousData,
  };
}

export function useOrders(slug: string, businessId: string, filters: OrderFilters, enabled = true) {
  return useQuery({ ...ordersQuery(slug, businessId, filters), enabled });
}

export function useOrder(slug: string, businessId: string, id: string) {
  return useQuery({
    queryKey: dealershipKeys.detail(businessId, 'orders', id),
    queryFn: ({ signal }) =>
      apiFetch<Order>(`${base(slug)}/orders/${encodeURIComponent(id)}`, { signal }),
  });
}

/** `POST orders` with one Idempotency-Key per open form (double click / retry safe). */
export function useCreateOrder(slug: string, businessId: string) {
  const refresh = useRefreshEntities(businessId);
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: OrderInput; idempotencyKey: string }) =>
      apiFetch<Order>(`${base(slug)}/orders`, {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => refresh(ORDER_CREATE_REFRESH),
  });
}

export function useCorrectOrder(slug: string, businessId: string) {
  const refresh = useRefreshEntities(businessId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: OrderPatch }) =>
      apiFetch<Order>(`${base(slug)}/orders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => refresh(ORDER_REFRESH),
  });
}

export function useVoidOrder(slug: string, businessId: string) {
  const refresh = useRefreshEntities(businessId);
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<Order>(`${base(slug)}/orders/${encodeURIComponent(id)}/void`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => refresh(ORDER_REFRESH),
  });
}

// ---- Deliveries ----

const DELIVERY_FILTER_KEYS = ['orderId', 'customerId', 'status', 'from', 'to'] as const;

function deliveriesQuery(slug: string, businessId: string, filters: DeliveryFilters) {
  const query = clean(filters, DELIVERY_FILTER_KEYS);
  return {
    queryKey: dealershipKeys.list(businessId, 'deliveries', query),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<Page<DeliverySummary>>(`${base(slug)}/deliveries`, { query, signal }),
    placeholderData: keepPreviousData,
  };
}

export function useDeliveries(
  slug: string,
  businessId: string,
  filters: DeliveryFilters,
  enabled = true,
) {
  return useQuery({ ...deliveriesQuery(slug, businessId, filters), enabled });
}

export function useDelivery(slug: string, businessId: string, id: string) {
  return useQuery({
    queryKey: dealershipKeys.detail(businessId, 'deliveries', id),
    queryFn: ({ signal }) =>
      apiFetch<Delivery>(`${base(slug)}/deliveries/${encodeURIComponent(id)}`, { signal }),
  });
}

export function useCreateDelivery(slug: string, businessId: string) {
  const refresh = useRefreshEntities(businessId);
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: DeliveryInput; idempotencyKey: string }) =>
      apiFetch<Delivery>(`${base(slug)}/deliveries`, {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => refresh(DELIVERY_REFRESH),
  });
}

export function useCorrectDelivery(slug: string, businessId: string) {
  const refresh = useRefreshEntities(businessId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DeliveryPatch }) =>
      apiFetch<Delivery>(`${base(slug)}/deliveries/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => refresh(DELIVERY_REFRESH),
  });
}

export function useVoidDelivery(slug: string, businessId: string) {
  const refresh = useRefreshEntities(businessId);
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<Delivery>(`${base(slug)}/deliveries/${encodeURIComponent(id)}/void`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => refresh(DELIVERY_REFRESH),
  });
}

// ---- Collections ----

const COLLECTION_FILTER_KEYS = ['customerId', 'orderId', 'method', 'status', 'from', 'to'] as const;

export function useCollections(
  slug: string,
  businessId: string,
  filters: CollectionFilters,
  enabled = true,
) {
  const query = clean(filters, COLLECTION_FILTER_KEYS);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'collections', query),
    queryFn: ({ signal }) =>
      apiFetch<Page<Collection>>(`${base(slug)}/collections`, { query, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCollection(slug: string, businessId: string, id: string) {
  return useQuery({
    queryKey: dealershipKeys.detail(businessId, 'collections', id),
    queryFn: ({ signal }) =>
      apiFetch<Collection>(`${base(slug)}/collections/${encodeURIComponent(id)}`, { signal }),
  });
}

/** The business's own payment methods; no method name ever lives in code. */
export function useCollectionMethods(slug: string, businessId: string, enabled = true) {
  return useQuery({
    queryKey: dealershipKeys.entity(businessId, 'collection-methods'),
    queryFn: ({ signal }) =>
      apiFetch<{ items: string[] }>(`${base(slug)}/collection-methods`, { signal }).then(
        (r) => r.items,
      ),
    staleTime: 5 * 60_000, // business settings: rarely change
    enabled,
  });
}

export function useCreateCollection(slug: string, businessId: string) {
  const refresh = useRefreshEntities(businessId);
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CollectionInput; idempotencyKey: string }) =>
      apiFetch<Collection>(`${base(slug)}/collections`, {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => refresh(COLLECTION_REFRESH),
  });
}

export function useCorrectCollection(slug: string, businessId: string) {
  const refresh = useRefreshEntities(businessId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CollectionPatch }) =>
      apiFetch<Collection>(`${base(slug)}/collections/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => refresh(COLLECTION_REFRESH),
  });
}

export function useVoidCollection(slug: string, businessId: string) {
  const refresh = useRefreshEntities(businessId);
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<Collection>(`${base(slug)}/collections/${encodeURIComponent(id)}/void`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => refresh(COLLECTION_REFRESH),
  });
}

/**
 * The sales KPI cards' amount group (`report.view`, `reports/sales` is delivery-based). A user
 * without `report.view` gets a 403 on all three, and the cards hide rather than erroring (see
 * `SalesSummaryCards`). `total` is a true lifetime total (`reports/sales` has no range cap).
 */
export function useSalesSummaryAmounts(
  slug: string,
  businessId: string,
  ranges: SalesSummaryRanges,
) {
  const [total, today, thisMonth] = useQueries({
    queries: [
      salesReportQuery(slug, businessId, { groupBy: 'date', ...ranges.total, page: 1 }),
      salesReportQuery(slug, businessId, { groupBy: 'date', ...ranges.today, page: 1 }),
      salesReportQuery(slug, businessId, { groupBy: 'date', ...ranges.thisMonth, page: 1 }),
    ],
  });
  return { total, today, thisMonth };
}

/**
 * The sales KPI cards' order-count group. Same `sale.view.all`/`sale.view.own` permission as the
 * page itself, so it never 403s here; `GET orders` has no date-range cap, so "total" is truly
 * all orders ever.
 */
export function useOrderCounts(slug: string, businessId: string, ranges: SalesSummaryRanges) {
  const [total, thisMonth] = useQueries({
    queries: [
      { ...ordersQuery(slug, businessId, { page: 1 }), staleTime: 60_000 },
      {
        ...ordersQuery(slug, businessId, {
          from: ranges.thisMonth.from,
          to: ranges.thisMonth.to,
          page: 1,
        }),
        staleTime: 60_000,
      },
    ],
  });
  return { total, thisMonth };
}

/**
 * The sales KPI cards' delivery-count group. `delivery.view` is separate from the page's own
 * `sale.view.*`, so a salesman without it gets a 403 here and the cards hide (see
 * `SalesSummaryCards`). `GET deliveries` has no date-range cap either.
 */
export function useDeliveryCounts(slug: string, businessId: string, ranges: SalesSummaryRanges) {
  const [total, thisMonth] = useQueries({
    queries: [
      { ...deliveriesQuery(slug, businessId, { page: 1 }), staleTime: 60_000 },
      {
        ...deliveriesQuery(slug, businessId, {
          from: ranges.thisMonth.from,
          to: ranges.thisMonth.to,
          page: 1,
        }),
        staleTime: 60_000,
      },
    ],
  });
  return { total, thisMonth };
}

/**
 * The collections KPI cards' amount group (`report.view`, `reports/collections`). A user
 * without `report.view` gets a 403 on all three, and the cards hide rather than erroring (see
 * `CollectionsSummaryCards`). `total` is a true lifetime total (`reports/collections` has no
 * range cap).
 */
export function useCollectionsSummaryAmounts(
  slug: string,
  businessId: string,
  ranges: SalesSummaryRanges,
) {
  const [total, today, thisMonth] = useQueries({
    queries: [
      collectionsReportQuery(slug, businessId, { groupBy: 'date', ...ranges.total, page: 1 }),
      collectionsReportQuery(slug, businessId, { groupBy: 'date', ...ranges.today, page: 1 }),
      collectionsReportQuery(slug, businessId, {
        groupBy: 'date',
        ...ranges.thisMonth,
        page: 1,
      }),
    ],
  });
  return { total, today, thisMonth };
}

// ---- Pending Deliveries Summary ----

interface PendingDeliverySummary {
  count: number;
  amount: string;
}

export function usePendingDeliverySummary(slug: string, businessId: string) {
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'pendingDeliverySummary', {}),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiFetch<Page<DeliverySummary>>(`${base(slug)}/deliveries`, {
        query: { status: 'pending', page: 1 },
        signal,
      }).then((data) => ({
        count: data.total,
        amount: (data.items ?? [])
          .reduce((sum, item) => sum + parseFloat(item.total || '0'), 0)
          .toFixed(2),
      })),
    staleTime: 60_000,
  });
}

// ---- Customer ledger ----

export function useCustomerLedger(
  slug: string,
  businessId: string,
  customerId: string,
  filters: LedgerFilters,
) {
  const query = clean(filters, ['from', 'to'] as const);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'ledger', { customerId, ...query }),
    queryFn: ({ signal }) =>
      apiFetch<LedgerPage>(`${base(slug)}/customers/${encodeURIComponent(customerId)}/ledger`, {
        query,
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}
