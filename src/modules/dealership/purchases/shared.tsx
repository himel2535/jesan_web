'use client';

import { useMemo } from 'react';
import { businessToday } from '@/core/i18n/format';

/** A date well before any real business can have data; "total" uses it as the lifetime window. */
const LIFETIME_FROM = '2000-01-01';

function isoOf(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

export interface PurchaseSummaryRanges {
  total: { from: string; to: string };
  today: { from: string; to: string };
  thisMonth: { from: string; to: string };
  thisYear: { from: string; to: string };
}

/**
 * The four fixed date windows the Purchases KPI cards need, anchored on the business's "today"
 * (Dhaka time). Memoized so the four summary queries don't re-fire every render.
 */
export function usePurchaseSummaryRanges(): PurchaseSummaryRanges {
  const today = useMemo(() => businessToday(), []);
  return useMemo(() => {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    return {
      total: { from: LIFETIME_FROM, to: today },
      today: { from: today, to: today },
      thisMonth: { from: isoOf(y, m - 1, 1), to: today },
      thisYear: { from: isoOf(y, 0, 1), to: today },
    };
  }, [today]);
}
