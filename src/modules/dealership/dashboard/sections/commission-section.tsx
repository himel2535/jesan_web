'use client';

import { useCan } from '@/core/auth/useCan';
import { useCommissionSummary } from '../../commission/api';
import { CardBlock } from '../cards/card-block';
import { KPICard } from '../cards/kpi-card';
import { CardBlockSkeleton } from '../cards/skeletons';

interface CommissionSectionProps {
  slug: string;
  businessId: string;
}

export function CommissionSection({ slug, businessId }: CommissionSectionProps) {
  const canViewCommission = useCan('commission.manage');
  const { data, isLoading } = useCommissionSummary(slug, businessId, new Date().getFullYear());

  if (!canViewCommission) {
    return null;
  }

  if (isLoading) {
    return <CardBlockSkeleton title="Commission" count={3} />;
  }

  return (
    <CardBlock title="Commission (Owner Only)">
      <KPICard
        label="Total Commission"
        value={data?.total}
        isMoney
        isLoading={isLoading}
      />
      <KPICard
        label="Total Received"
        value={data?.received}
        isMoney
        tone="positive"
        isLoading={isLoading}
      />
      <KPICard
        label="Total Pending"
        value={data?.pending}
        isMoney
        tone="muted"
        isLoading={isLoading}
      />
    </CardBlock>
  );
}
