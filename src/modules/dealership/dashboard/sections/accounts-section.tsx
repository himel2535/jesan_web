'use client';

import { useCan } from '@/core/auth/useCan';
import { useAccountsSummaryRanges } from '../../accounts/api';
import { useDashboardSummaryRanges } from '../shared';
import { CardBlock } from '../cards/card-block';
import { KPICard } from '../cards/kpi-card';
import { CardBlockSkeleton } from '../cards/skeletons';

interface AccountsSectionProps {
  slug: string;
  businessId: string;
}

export function AccountsSection({ slug, businessId }: AccountsSectionProps) {
  const ranges = useDashboardSummaryRanges();
  const [allQuery, todayQuery, thisMonthQuery] = useAccountsSummaryRanges(slug, businessId, ranges);
  const canViewProfit = useCan('profit.view');

  if (allQuery.isLoading) {
    return <CardBlockSkeleton title="Accounts" count={7} />;
  }

  if (allQuery.isError || !allQuery.data) {
    return null;
  }

  return (
    <CardBlock title="Accounts" columns={7}>
      {/* Row 1: Total values */}
      <KPICard
        label="Total In"
        value={allQuery.data?.totalIn}
        isMoney
        tone="positive"
        isLoading={allQuery.isLoading}
      />
      <KPICard
        label="Total Out"
        value={allQuery.data?.totalOut}
        isMoney
        tone="negative"
        isLoading={allQuery.isLoading}
      />
      <KPICard
        label="Net"
        value={
          canViewProfit && allQuery.data?.net
            ? allQuery.data.net
            : allQuery.data
              ? String(parseFloat(allQuery.data.totalIn || '0') - parseFloat(allQuery.data.totalOut || '0'))
              : undefined
        }
        isMoney
        tone={
          allQuery.data && parseFloat(allQuery.data.totalIn || '0') - parseFloat(allQuery.data.totalOut || '0') >= 0
            ? 'positive'
            : 'negative'
        }
        isLoading={allQuery.isLoading}
      />
      <KPICard
        label="Total Due"
        value={allQuery.data?.totalDue}
        isMoney
        isLoading={allQuery.isLoading}
      />
      <KPICard
        label="Total Advance"
        value={allQuery.data?.totalAdvance}
        isMoney
        isLoading={allQuery.isLoading}
      />
      <KPICard
        label="Total Expense"
        value={allQuery.data?.totalExpense}
        isMoney
        isLoading={allQuery.isLoading}
      />
      <KPICard
        label="Total Income"
        value={allQuery.data?.totalIncome}
        isMoney
        isLoading={allQuery.isLoading}
      />

      {/* Row 2: Today's values */}
      <KPICard
        label="Today's In"
        value={todayQuery.data?.totalIn}
        isMoney
        tone="positive"
        isLoading={todayQuery.isLoading}
      />
      <KPICard
        label="Today's Out"
        value={todayQuery.data?.totalOut}
        isMoney
        tone="negative"
        isLoading={todayQuery.isLoading}
      />
      <KPICard
        label="Today's Net"
        value={
          canViewProfit && todayQuery.data?.net
            ? todayQuery.data.net
            : todayQuery.data
              ? String(parseFloat(todayQuery.data.totalIn || '0') - parseFloat(todayQuery.data.totalOut || '0'))
              : undefined
        }
        isMoney
        tone={
          todayQuery.data && parseFloat(todayQuery.data.totalIn || '0') - parseFloat(todayQuery.data.totalOut || '0') >= 0
            ? 'positive'
            : 'negative'
        }
        isLoading={todayQuery.isLoading}
      />
      <KPICard
        label="Today's Due"
        value={todayQuery.data?.totalDue}
        isMoney
        isLoading={todayQuery.isLoading}
      />
      <KPICard
        label="Today's Advance"
        value={todayQuery.data?.totalAdvance}
        isMoney
        isLoading={todayQuery.isLoading}
      />
      <KPICard
        label="Today's Expense"
        value={todayQuery.data?.totalExpense}
        isMoney
        isLoading={todayQuery.isLoading}
      />
      <KPICard
        label="Today's Income"
        value={todayQuery.data?.totalIncome}
        isMoney
        isLoading={todayQuery.isLoading}
      />

      {/* Row 3: This Month's values */}
      <KPICard
        label="This Month's In"
        value={thisMonthQuery.data?.totalIn}
        isMoney
        tone="positive"
        isLoading={thisMonthQuery.isLoading}
      />
      <KPICard
        label="This Month's Out"
        value={thisMonthQuery.data?.totalOut}
        isMoney
        tone="negative"
        isLoading={thisMonthQuery.isLoading}
      />
      <KPICard
        label="This Month's Net"
        value={
          canViewProfit && thisMonthQuery.data?.net
            ? thisMonthQuery.data.net
            : thisMonthQuery.data
              ? String(
                  parseFloat(thisMonthQuery.data.totalIn || '0') - parseFloat(thisMonthQuery.data.totalOut || '0'),
                )
              : undefined
        }
        isMoney
        tone={
          thisMonthQuery.data &&
          parseFloat(thisMonthQuery.data.totalIn || '0') - parseFloat(thisMonthQuery.data.totalOut || '0') >= 0
            ? 'positive'
            : 'negative'
        }
        isLoading={thisMonthQuery.isLoading}
      />
      <KPICard
        label="This Month's Due"
        value={thisMonthQuery.data?.totalDue}
        isMoney
        isLoading={thisMonthQuery.isLoading}
      />
      <KPICard
        label="This Month's Advance"
        value={thisMonthQuery.data?.totalAdvance}
        isMoney
        isLoading={thisMonthQuery.isLoading}
      />
      <KPICard
        label="This Month's Expense"
        value={thisMonthQuery.data?.totalExpense}
        isMoney
        isLoading={thisMonthQuery.isLoading}
      />
      <KPICard
        label="This Month's Income"
        value={thisMonthQuery.data?.totalIncome}
        isMoney
        isLoading={thisMonthQuery.isLoading}
      />
    </CardBlock>
  );
}
