'use client';

import { usePurchasesSummary } from '../../purchases/api';
import { usePurchaseSummaryRanges } from '../../purchases/shared';
import { CardBlock } from '../cards/card-block';
import { KPICard } from '../cards/kpi-card';
import { CardBlockSkeleton } from '../cards/skeletons';

interface PurchasesSectionProps {
  slug: string;
  businessId: string;
}

export function PurchasesSection({ slug, businessId }: PurchasesSectionProps) {
  const ranges = usePurchaseSummaryRanges();
  const { total, today, thisMonth, thisYear } = usePurchasesSummary(slug, businessId, ranges);

  if (total.isLoading) {
    return <CardBlockSkeleton title="Purchases" count={6} />;
  }

  return (
    <CardBlock title="Purchases">
      {/* Total */}
      <KPICard
        label="Total Purchase Amount"
        value={total.data?.cost}
        isMoney
        isLoading={total.isLoading}
      />
      <KPICard
        label="Total Purchase Quantity"
        value={total.data?.quantity}
        isLoading={total.isLoading}
      />

      {/* Today */}
      <KPICard
        label="Today's Purchases"
        value={today.data?.cost}
        isMoney
        isLoading={today.isLoading}
      />

      {/* This Month */}
      <KPICard
        label="This Month's Purchases"
        value={thisMonth.data?.cost}
        isMoney
        isLoading={thisMonth.isLoading}
      />

      {/* This Year */}
      <KPICard
        label="This Year's Purchases"
        value={thisYear.data?.cost}
        isMoney
        isLoading={thisYear.isLoading}
      />
    </CardBlock>
  );
}
