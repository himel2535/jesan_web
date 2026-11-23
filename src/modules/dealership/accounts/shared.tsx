'use client';

import { useMemo } from 'react';
import { businessToday } from '@/core/i18n/format';
import { useDynamicT } from '@/core/i18n/use-dynamic-t';

export { dateParam, useBusinessDay, useSetFilters, LIFETIME_FROM } from '../expenses/shared';

export function useMethodLabel() {
  const dt = useDynamicT();
  return (method: string) => dt(`dealership.accounts.methodNames.${method}`, method);
}

const LIFETIME_FROM_DATE = '2000-01-01';

function isoOf(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

export interface AccountsDashboardRanges {
  total: { from: string; to: string };
  today: { from: string; to: string };
  thisMonth: { from: string; to: string };
}

/** The dashboard's three fixed accounts windows, anchored on the business's "today" (Dhaka time). */
export function useAccountsDashboardRanges(): AccountsDashboardRanges {
  const today = useMemo(() => businessToday(), []);
  return useMemo(() => {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    return {
      total: { from: LIFETIME_FROM_DATE, to: today },
      today: { from: today, to: today },
      thisMonth: { from: isoOf(y, m - 1, 1), to: today },
    };
  }, [today]);
}
