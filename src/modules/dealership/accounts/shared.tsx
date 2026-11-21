'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDynamicT } from '@/core/i18n/use-dynamic-t';
import { useFormat } from '@/core/i18n/use-format';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function useBusinessDay() {
  const format = useFormat();
  return (day: string) => format.date(`${day}T00:00:00+06:00`);
}

export function dateParam(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value && DATE.test(value) ? value : undefined;
}

export function useSetFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('page');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
}

export function useMethodLabel() {
  const dt = useDynamicT();
  return (method: string) => dt(`dealership.accounts.methodNames.${method}`, method);
}
