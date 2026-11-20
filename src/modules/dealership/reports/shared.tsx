'use client';

import { useDynamicT } from '@/core/i18n/use-dynamic-t';

export { dateParam, useBusinessDay, useSetFilters } from '../expenses/shared';

/** Reads a validated `groupBy` value from the URL, falling back when it's missing or unknown. */
export function groupByParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = params.get(key);
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * A stock movement's kind: a closed, backend-defined set (not business data like a payment
 * method), so every value gets a real translation — the fallback only covers a kind the backend
 * adds before this page ships one.
 */
export function useKindLabel() {
  const dt = useDynamicT();
  return (kind: string) => dt(`dealership.reports.stockMovements.kind.${kind}`, kind);
}
