'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { ApiError } from '@/core/api/errors';
import { dealershipKeys } from '../keys';
import type {
  ActiveFilter,
  Category,
  Customer,
  ListParams,
  Page,
  Product,
  Supplier,
  UnitsResponse,
} from './types';

export { dealershipKeys };

const base = (slug: string) => `/b/${encodeURIComponent(slug)}`;

/** Only set filters go into the key and the URL (`page` defaults to 1, `active` to true). */
function cleanParams(params: ListParams) {
  const out: Record<string, string | number> = {};
  if (params.search) out.search = params.search;
  if (params.categoryId) out.categoryId = params.categoryId;
  if (params.active && params.active !== 'true') out.active = params.active;
  out.page = params.page ?? 1;
  return out;
}

// ---- Units & categories ----

export function useUnits(slug: string, businessId: string) {
  return useQuery({
    queryKey: dealershipKeys.entity(businessId, 'units'),
    queryFn: ({ signal }) => apiFetch<UnitsResponse>(`${base(slug)}/product-units`, { signal }),
    staleTime: 5 * 60_000, // business settings: rarely change
  });
}

export function useCategories(slug: string, businessId: string, active: ActiveFilter = 'true') {
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'categories', { active }),
    queryFn: ({ signal }) =>
      apiFetch<{ items: Category[] }>(`${base(slug)}/product-categories`, {
        query: { active },
        signal,
      }).then((r) => r.items),
    staleTime: 5 * 60_000, // business settings: rarely change, wanted by four pages
  });
}

function useInvalidate(businessId: string) {
  const queryClient = useQueryClient();
  return (...entities: string[]) =>
    Promise.all(
      entities.map((entity) =>
        queryClient.invalidateQueries({ queryKey: dealershipKeys.entity(businessId, entity) }),
      ),
    );
}

/** A 404 means the list on screen is stale: refresh that entity too. */
const refreshOn404 = (refresh: () => Promise<unknown>) => (error: unknown) =>
  error instanceof ApiError && error.status === 404 ? refresh() : undefined;

export type CategoryInput = { nameEn?: string; nameBn?: string; sortOrder?: number };
export type CategoryPatch = CategoryInput & { isActive?: boolean; reason?: string };

export function useSaveCategory(slug: string, businessId: string) {
  const invalidate = useInvalidate(businessId);
  const refresh = () => invalidate('categories', 'products');
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: CategoryPatch }) =>
      id
        ? apiFetch<Category>(`${base(slug)}/product-categories/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body,
          })
        : apiFetch<Category>(`${base(slug)}/product-categories`, { method: 'POST', body }),
    onSuccess: refresh,
    onError: refreshOn404(refresh),
  });
}

// ---- Products ----

export function useProducts(slug: string, businessId: string, params: ListParams) {
  const clean = cleanParams(params);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'products', clean),
    queryFn: ({ signal }) =>
      apiFetch<Page<Product>>(`${base(slug)}/products`, { query: clean, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(slug: string, businessId: string, id: string) {
  return useQuery({
    queryKey: dealershipKeys.detail(businessId, 'products', id),
    queryFn: ({ signal }) =>
      apiFetch<Product>(`${base(slug)}/products/${encodeURIComponent(id)}`, { signal }),
  });
}

export type ProductInput = {
  categoryId?: string;
  nameEn?: string;
  nameBn?: string;
  unitKey?: string;
  isActive?: boolean;
  reason?: string;
};

export function useSaveProduct(slug: string, businessId: string) {
  const invalidate = useInvalidate(businessId);
  const refresh = () => invalidate('products');
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: ProductInput }) =>
      id
        ? apiFetch<Product>(`${base(slug)}/products/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body,
          })
        : apiFetch<Product>(`${base(slug)}/products`, { method: 'POST', body }),
    onSuccess: refresh,
    onError: refreshOn404(refresh),
  });
}

// ---- Customers ----

export function useCustomers(slug: string, businessId: string, params: ListParams) {
  const clean = cleanParams(params);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'customers', clean),
    queryFn: ({ signal }) =>
      apiFetch<Page<Customer>>(`${base(slug)}/customers`, { query: clean, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(slug: string, businessId: string, id: string, enabled = true) {
  return useQuery({
    queryKey: dealershipKeys.detail(businessId, 'customers', id),
    queryFn: ({ signal }) =>
      apiFetch<Customer>(`${base(slug)}/customers/${encodeURIComponent(id)}`, { signal }),
    enabled: enabled && Boolean(id),
  });
}

export type CustomerInput = {
  nameEn?: string;
  nameBn?: string | null;
  phone?: string;
  address?: string | null;
  area?: string | null;
  openingBalance?: string;
  creditLimit?: string | null;
  isActive?: boolean;
  reason?: string;
};

export function useSaveCustomer(slug: string, businessId: string) {
  const invalidate = useInvalidate(businessId);
  const refresh = () => invalidate('customers');
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: CustomerInput }) =>
      id
        ? apiFetch<Customer>(`${base(slug)}/customers/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body,
          })
        : apiFetch<Customer>(`${base(slug)}/customers`, { method: 'POST', body }),
    onSuccess: refresh,
    onError: refreshOn404(refresh),
  });
}

// ---- Suppliers (read only) ----

export function useSuppliers(slug: string, businessId: string, params: ListParams) {
  const clean = cleanParams(params);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'suppliers', clean),
    queryFn: ({ signal }) =>
      apiFetch<Page<Supplier>>(`${base(slug)}/suppliers`, { query: clean, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useSupplier(slug: string, businessId: string, id: string) {
  return useQuery({
    queryKey: dealershipKeys.detail(businessId, 'suppliers', id),
    queryFn: ({ signal }) =>
      apiFetch<Supplier>(`${base(slug)}/suppliers/${encodeURIComponent(id)}`, { signal }),
  });
}
