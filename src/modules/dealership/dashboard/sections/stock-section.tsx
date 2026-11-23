'use client';

import { useProductCount } from '../../master-data/api';
import { CardBlock } from '../cards/card-block';
import { KPICard } from '../cards/kpi-card';
import { CardBlockSkeleton } from '../cards/skeletons';

interface StockSectionProps {
  slug: string;
  businessId: string;
}

export function StockSection({ slug, businessId }: StockSectionProps) {
  const { data, isLoading } = useProductCount(slug, businessId);

  if (isLoading) {
    return <CardBlockSkeleton title="Stock" count={1} />;
  }

  return (
    <CardBlock title="Stock">
      <KPICard label="Total Products" value={data?.count} isLoading={isLoading} />
    </CardBlock>
  );
}
