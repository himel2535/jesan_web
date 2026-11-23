'use client';

import { useCan } from '@/core/auth/useCan';
import {
  useOrderCounts,
  useDeliveryCounts,
  useSalesSummaryAmounts,
  usePendingDeliverySummary,
} from '../../sales/api';
import { useDailySummary } from '../../reports/api';
import { useSalesSummaryRanges } from '../../sales/shared';
import { CardBlock } from '../cards/card-block';
import { KPICard } from '../cards/kpi-card';
import { CardBlockSkeleton } from '../cards/skeletons';

interface SalesSectionProps {
  slug: string;
  businessId: string;
}

export function SalesSection({ slug, businessId }: SalesSectionProps) {
  const ranges = useSalesSummaryRanges();
  const canViewAmounts = useCan('product.cost.view');

  const orderCounts = useOrderCounts(slug, businessId, ranges);
  const deliveryCounts = useDeliveryCounts(slug, businessId, ranges);
  const salesAmounts = useSalesSummaryAmounts(slug, businessId, ranges);
  const dailySummary = useDailySummary(slug, businessId);
  const pending = usePendingDeliverySummary(slug, businessId);

  if (orderCounts[0].isLoading) {
    return <CardBlockSkeleton title="Sales" count={8} />;
  }

  return (
    <CardBlock title="Sales">
      {/* Orders */}
      <KPICard
        label="Total Orders"
        value={orderCounts[0].data?.total}
        isLoading={orderCounts[0].isLoading}
      />
      <KPICard
        label="This Month's Orders"
        value={orderCounts[1].data?.total}
        isLoading={orderCounts[1].isLoading}
      />

      {/* Deliveries */}
      <KPICard
        label="Total Deliveries"
        value={deliveryCounts[0].data?.total}
        isLoading={deliveryCounts[0].isLoading}
      />
      <KPICard
        label="This Month's Deliveries"
        value={deliveryCounts[1].data?.total}
        isLoading={deliveryCounts[1].isLoading}
      />
      <KPICard
        label="Today's Deliveries"
        value={dailySummary.data?.deliveriesCount}
        isLoading={dailySummary.isLoading}
      />

      {/* Sales Amounts (if permitted) */}
      {canViewAmounts && (
        <>
          <KPICard
            label="Total Sales Amount"
            value={salesAmounts.total.data?.sum}
            isMoney
            isLoading={salesAmounts.total.isLoading}
          />
          <KPICard
            label="This Month's Sales"
            value={salesAmounts.thisMonth.data?.sum}
            isMoney
            isLoading={salesAmounts.thisMonth.isLoading}
          />
          <KPICard
            label="Today's Sales"
            value={dailySummary.data?.deliveredAmount}
            isMoney
            isLoading={dailySummary.isLoading}
          />
        </>
      )}

      {/* Pending Deliveries */}
      <KPICard
        label="Pending Deliveries"
        value={pending.data?.count}
        isLoading={pending.isLoading}
      />
      {canViewAmounts && (
        <KPICard
          label="Pending Amount"
          value={pending.data?.amount}
          isMoney
          isLoading={pending.isLoading}
        />
      )}
    </CardBlock>
  );
}
