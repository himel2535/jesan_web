import { useMemo } from 'react';
import { startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { businessToday } from '@/core/lib/date';

export interface DateRange {
  from: string;
  to: string;
}

export interface SalesSummaryRanges {
  total: { from?: undefined; to?: undefined; page: number };
  today: DateRange & { page: number };
  thisMonth: DateRange & { page: number };
}

export function useSalesSummaryRanges(): SalesSummaryRanges {
  return useMemo(() => {
    const today = businessToday();
    const toStr = (d: Date) => d.toISOString().split('T')[0];

    return {
      total: { page: 1 },
      today: { from: toStr(today), to: toStr(today), page: 1 },
      thisMonth: {
        from: toStr(startOfMonth(today)),
        to: toStr(today),
        page: 1,
      },
    };
  }, []);
}
