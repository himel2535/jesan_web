'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { businessToday } from '@/core/i18n/format';
import { useDynamicT } from '@/core/i18n/use-dynamic-t';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import type { DocumentStatus } from './types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reports endpoints no longer cap the range width, so this anchors "total" at a date well before
 * any real business can have data — the window is effectively the business's full lifetime.
 */
export const LIFETIME_FROM = '2000-01-01';

function isoOf(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

export interface ExpenseSummaryRanges {
  total: { from: string; to: string };
  today: { from: string; to: string };
  thisMonth: { from: string; to: string };
  previousMonth: { from: string; to: string };
}

/**
 * The four fixed date windows the Expenses KPI cards need, anchored on the business's "today"
 * (Dhaka time). Memoized so the four report queries below don't re-fire every render.
 */
export function useExpenseSummaryRanges(): ExpenseSummaryRanges {
  const today = useBusinessTodayIso();
  return useMemo(() => {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    return {
      total: { from: LIFETIME_FROM, to: today },
      today: { from: today, to: today },
      thisMonth: { from: isoOf(y, m - 1, 1), to: today },
      previousMonth: { from: isoOf(y, m - 2, 1), to: isoOf(y, m - 1, 0) },
    };
  }, [today]);
}

function useBusinessTodayIso(): string {
  return useMemo(() => businessToday(), []);
}

/** A `YYYY-MM-DD` business day from the API → a localized date. */
export function useBusinessDay() {
  const format = useFormat();
  return (day: string) => format.date(`${day}T00:00:00+06:00`);
}

/** Reads a date from the URL, ignoring anything that is not YYYY-MM-DD. */
export function dateParam(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value && DATE.test(value) ? value : undefined;
}

/** Writes filters to the URL and always returns to page 1. */
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

/**
 * An expense method's label. The list of methods is the business's own (`GET expense-methods`),
 * so a key with no translation yet shows as itself instead of breaking the page.
 */
export function useMethodLabel() {
  const dt = useDynamicT();
  return (method: string) => dt(`dealership.expenses.methodNames.${method}`, method);
}

export function StatusText({ status }: { status: DocumentStatus }) {
  const t = useTranslations('dealership.expenses.status');
  return (
    <span className={cn('text-sm font-medium', status === 'void' ? 'text-danger' : 'text-success')}>
      {t(status)}
    </span>
  );
}
