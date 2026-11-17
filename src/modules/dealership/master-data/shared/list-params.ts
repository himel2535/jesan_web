'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { parsePageParam } from '@/core/ui/pagination-logic';
import type { ActiveFilter, ListParams } from '../types';

const ACTIVE: readonly ActiveFilter[] = ['true', 'false', 'all'];

/** List state lives in the URL (?search=&active=&category=&page=): reload and share keep it. */
export function useListParams(): Required<Pick<ListParams, 'page' | 'active'>> & ListParams {
  const params = useSearchParams();
  const active = params.get('active');
  return {
    search: params.get('search')?.slice(0, 100) || undefined,
    active: ACTIVE.includes(active as ActiveFilter) ? (active as ActiveFilter) : 'true',
    categoryId: params.get('category') || undefined,
    page: parsePageParam(params.get('page')),
  };
}

/** Sets or clears URL params; any filter change goes back to page 1. */
export function useSetListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return useCallback(
    (changes: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
}
