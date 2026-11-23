'use client';

import { useMemo } from 'react';
import { businessToday } from '@/core/i18n/format';
import { LIFETIME_FROM } from '../expenses/shared';

function isoOf(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

export interface DashboardRanges {
  total: { from: string; to: string };
  today: { from: string; to: string };
  thisMonth: { from: string; to: string };
  previousMonth: { from: string; to: string };
}

/**
 * The dashboard's four fixed windows, anchored on the business's "today" (Dhaka time) — the
 * same `isoOf`/lifetime-from pattern every other module's KPI cards already use
 * (accounts/sales/purchases/expenses `shared.tsx`), duplicated here rather than importing one of
 * those modules' hooks so the dashboard never depends on another module's page-specific type.
 */
export function useDashboardRanges(): DashboardRanges {
  const today = useMemo(() => businessToday(), []);
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

/** A genuine (thisMonth vs previousMonth) % change, or `null` when it can't be computed (no prior-month data to compare against — never fabricated as 0%). */
export function monthOverMonthChange(thisMonth: string, previousMonth: string): number | null {
  const prev = Number(previousMonth);
  const curr = Number(thisMonth);
  if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}
