import {
  addMonths,
  endOfMonth,
  endOfYear,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { businessToday } from '@/core/lib/date';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DashboardDateRanges {
  all: null;
  today: DateRange;
  thisMonth: DateRange;
  thisYear: DateRange;
  previousMonth: DateRange;
}

export function useDashboardSummaryRanges(): DashboardDateRanges {
  const today = businessToday();

  return {
    all: null,
    today: {
      from: today,
      to: today,
    },
    thisMonth: {
      from: startOfMonth(today),
      to: today,
    },
    thisYear: {
      from: startOfYear(today),
      to: today,
    },
    previousMonth: {
      from: startOfMonth(addMonths(today, -1)),
      to: endOfMonth(addMonths(today, -1)),
    },
  };
}
