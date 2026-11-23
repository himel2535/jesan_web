import { useMemo } from 'react';
import { startOfMonth, startOfYear } from 'date-fns';
import { businessToday } from '@/core/lib/date';

export interface PurchaseDateRange {
  from: string;
  to: string;
}

export interface PurchaseSummaryRanges {
  total: { from?: undefined; to?: undefined };
  today: PurchaseDateRange;
  thisMonth: PurchaseDateRange;
  thisYear: PurchaseDateRange;
}

export function usePurchaseSummaryRanges(): PurchaseSummaryRanges {
  return useMemo(() => {
    const today = businessToday();
    const toStr = (d: Date) => d.toISOString().split('T')[0];

    return {
      total: {},
      today: { from: toStr(today), to: toStr(today) },
      thisMonth: {
        from: toStr(startOfMonth(today)),
        to: toStr(today),
      },
      thisYear: {
        from: toStr(startOfYear(today)),
        to: toStr(today),
      },
    };
  }, []);
}
