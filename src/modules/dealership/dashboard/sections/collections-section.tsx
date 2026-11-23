'use client';

import { useCollectionsSummaryAmounts } from '../../sales/api';
import { useSalesSummaryRanges } from '../../sales/shared';
import { useDailySummary } from '../../reports/api';
import { CardBlock } from '../cards/card-block';
import { KPICard } from '../cards/kpi-card';
import { CardBlockSkeleton } from '../cards/skeletons';

interface CollectionsSectionProps {
  slug: string;
  businessId: string;
}

export function CollectionsSection({ slug, businessId }: CollectionsSectionProps) {
  const ranges = useSalesSummaryRanges();
  const { total, today, thisMonth } = useCollectionsSummaryAmounts(slug, businessId, ranges);
  const dailySummary = useDailySummary(slug, businessId);

  if (total.isLoading) {
    return <CardBlockSkeleton title="Collections" count={3} />;
  }

  return (
    <CardBlock title="Collections">
      <KPICard
        label="Total Collection"
        value={total.data?.sum}
        isMoney
        tone="positive"
        isLoading={total.isLoading}
      />
      <KPICard
        label="Today's Collection"
        value={dailySummary.data?.collectedAmount}
        isMoney
        tone="positive"
        isLoading={dailySummary.isLoading}
      />
      <KPICard
        label="This Month's Collection"
        value={thisMonth.data?.sum}
        isMoney
        tone="positive"
        isLoading={thisMonth.isLoading}
      />
    </CardBlock>
  );
}
