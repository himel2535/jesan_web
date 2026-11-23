import { useMemo } from 'react';
import { startOfMonth, addMonths } from 'date-fns';
import { businessToday } from '@/core/lib/date';

export interface ExpenseDateRange {
  from: string;
  to: string;
}

export interface ExpenseSummaryRanges {
  total: { from?: undefined; to?: undefined };
  today: ExpenseDateRange;
  thisMonth: ExpenseDateRange;
  previousMonth: ExpenseDateRange;
}

export function useExpenseSummaryRanges(): ExpenseSummaryRanges {
  return useMemo(() => {
    const today = businessToday();
    const toStr = (d: Date) => d.toISOString().split('T')[0];
    const prevMonth = addMonths(today, -1);

    return {
      total: {},
      today: { from: toStr(today), to: toStr(today) },
      thisMonth: {
        from: toStr(startOfMonth(today)),
        to: toStr(today),
      },
      previousMonth: {
        from: toStr(startOfMonth(prevMonth)),
        to: toStr(prevMonth),
      },
    };
  }, []);
}
