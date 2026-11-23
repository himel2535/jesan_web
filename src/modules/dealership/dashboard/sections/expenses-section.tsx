'use client';

import { useExpensesSummary } from '../../expenses/api';
import { useExpenseSummaryRanges } from '../../expenses/shared';
import { useDailySummary } from '../../reports/api';
import { CardBlock } from '../cards/card-block';
import { KPICard } from '../cards/kpi-card';
import { CardBlockSkeleton } from '../cards/skeletons';

interface ExpensesSectionProps {
  slug: string;
  businessId: string;
}

export function ExpensesSection({ slug, businessId }: ExpensesSectionProps) {
  const ranges = useExpenseSummaryRanges();
  const { total, today, thisMonth, previousMonth } = useExpensesSummary(slug, businessId, ranges);
  const dailySummary = useDailySummary(slug, businessId);

  if (total.isLoading) {
    return <CardBlockSkeleton title="Expenses" count={4} />;
  }

  return (
    <CardBlock title="Expenses">
      <KPICard
        label="Total Expenses"
        value={total.data?.sum}
        isMoney
        tone="negative"
        isLoading={total.isLoading}
      />
      <KPICard
        label="Today's Expenses"
        value={dailySummary.data?.expenseAmount}
        isMoney
        tone="negative"
        isLoading={dailySummary.isLoading}
      />
      <KPICard
        label="This Month's Expenses"
        value={thisMonth.data?.sum}
        isMoney
        tone="negative"
        isLoading={thisMonth.isLoading}
      />
      <KPICard
        label="Previous Month's Expenses"
        value={previousMonth.data?.sum}
        isMoney
        tone="negative"
        isLoading={previousMonth.isLoading}
      />
    </CardBlock>
  );
}
