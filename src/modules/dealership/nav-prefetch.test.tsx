import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createModuleKeys } from '@/core/api/query-keys';
import type { ListPrefetch } from '@/core/module-system/types';
import { dealershipManifest } from './manifest';
import { useCustomers, useProducts, useSuppliers } from './master-data/api';
import { usePurchases } from './purchases/api';
import { useCollections, useDeliveries, useOrders } from './sales/api';
import { useStock } from './stock/api';

// Never resolves: the test only wants the key each hook registers, not any data.
vi.mock('@/core/api/client', () => ({ apiFetch: vi.fn(() => new Promise(() => {})) }));

const SLUG = 'example-cement';
const BID = 'b-1';
const keys = createModuleKeys(dealershipManifest.type);

/** Each page's own hook, called the way the page calls it when opened with no filter. */
const pageHooks: Record<string, () => unknown> = {
  products: function useFirstPage() {
    return useProducts(SLUG, BID, { page: 1, active: 'true' });
  },
  customers: function useFirstPage() {
    return useCustomers(SLUG, BID, { page: 1, active: 'true' });
  },
  suppliers: function useFirstPage() {
    return useSuppliers(SLUG, BID, { page: 1, active: 'true' });
  },
  purchases: function useFirstPage() {
    return usePurchases(SLUG, BID, { page: 1 });
  },
  orders: function useFirstPage() {
    return useOrders(SLUG, BID, { page: 1 });
  },
  deliveries: function useFirstPage() {
    return useDeliveries(SLUG, BID, { page: 1 });
  },
  collections: function useFirstPage() {
    return useCollections(SLUG, BID, { page: 1 });
  },
  stock: function useFirstPage() {
    return useStock(SLUG, BID, { page: 1, active: 'true' });
  },
};

/** The key the hook actually registered in the cache. */
function keyUsedBy(hook: () => unknown): readonly unknown[] {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  renderHook(hook, { wrapper });
  const all = queryClient.getQueryCache().getAll();
  expect(all).toHaveLength(1);
  return all[0]!.queryKey;
}

const listEntries = dealershipManifest.nav.flatMap((entry) =>
  'listPrefetch' in entry
    ? [{ key: entry.key, prefetch: entry.prefetch, ...(entry.listPrefetch as ListPrefetch) }]
    : [],
);

/**
 * A hover prefetch only helps if it lands under the key the page then reads. Nothing in the type
 * system ties the manifest's `listPrefetch` to what the hook makes of its filters, so assert it
 * here: an unnoticed mismatch would fetch twice and look like a cache that never works.
 */
describe('manifest listPrefetch keys', () => {
  it('covers every light list page in the sidebar, on hover only', () => {
    expect(listEntries.map((entry) => entry.key)).toEqual([
      'products',
      'customers',
      'suppliers',
      'purchases',
      'sales',
      'deliveries',
      'collections',
      'stock',
    ]);
    // Warming a query is only worth a request when the click usually follows.
    for (const entry of listEntries) expect(entry.prefetch).toBe('hover');
  });

  for (const entry of listEntries) {
    it(`${entry.key}: warms exactly the key its page reads first`, () => {
      const warmed = keys.list(BID, entry.entity, entry.params ?? {});
      expect(keyUsedBy(pageHooks[entry.entity]!)).toEqual(warmed);
    });
  }
});
