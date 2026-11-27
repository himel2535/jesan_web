import { createModuleKeys } from '@/core/api/query-keys';

/**
 * Query keys: ['dealership', businessId, entity, …]. A change refreshes only what it touches:
 * a product → products; a category → categories and products (rows show category names);
 * a customer → customers. Never the whole cache.
 *
 * Kept in its own module (not `'use client'`) so the server can build the same keys when it
 * prefetches a page's queries.
 */
export const dealershipKeys = createModuleKeys('dealership');
