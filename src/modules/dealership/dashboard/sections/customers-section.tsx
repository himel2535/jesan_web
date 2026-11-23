'use client';

import { useCustomerCount } from '../../master-data/api';
import { CardBlock } from '../cards/card-block';
import { KPICard } from '../cards/kpi-card';
import { CardBlockSkeleton } from '../cards/skeletons';

interface CustomersSectionProps {
  slug: string;
  businessId: string;
}

export function CustomersSection({ slug, businessId }: CustomersSectionProps) {
  const { data, isLoading } = useCustomerCount(slug, businessId);

  if (isLoading) {
    return <CardBlockSkeleton title="Customers" count={1} />;
  }

  return (
    <CardBlock title="Customers">
      <KPICard label="Total Customers" value={data?.count} isLoading={isLoading} />
    </CardBlock>
  );
}
