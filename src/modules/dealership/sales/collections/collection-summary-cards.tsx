'use client';

import { Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { useCollectionsSummaryAmounts } from '../api';
import { Money } from '../../master-data/shared/display';
import { LoadError } from '../../master-data/shared/states';
import { SummaryTile, SummaryTileGrid } from '../../dashboard/summary-tile';
import type { SalesSummaryRanges } from '../shared';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

export function CollectionsSummaryCardsSkeleton() {
  return (
    <SummaryTileGrid className="sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <SummaryTile
          key={i}
          hue="blue"
          icon={<Wallet aria-hidden className="size-3.5" />}
          label=""
          value={null}
          loading
        />
      ))}
    </SummaryTileGrid>
  );
}

export function CollectionsSummaryCards({
  slug,
  businessId,
  ranges,
}: {
  slug: string;
  businessId: string;
  ranges: SalesSummaryRanges;
}) {
  const t = useTranslations('dealership.sales.collections.summary');
  const { total, today, thisMonth } = useCollectionsSummaryAmounts(slug, businessId, ranges);
  const queries = [total, today, thisMonth];
  const firstError = queries.find((q) => q.error)?.error;

  if (isForbidden(firstError)) {
    return null;
  }
  if (queries.some((q) => q.isPending)) {
    return <CollectionsSummaryCardsSkeleton />;
  }
  if (firstError) {
    const retry = () => {
      for (const q of queries) void q.refetch();
    };
    return <LoadError error={firstError} onRetry={retry} />;
  }
  if (!total.data || !today.data || !thisMonth.data) {
    return null;
  }

  return (
    <SummaryTileGrid className="sm:grid-cols-2 lg:grid-cols-3">
      <SummaryTile
        hue="blue"
        icon={<Wallet aria-hidden className="size-3.5" />}
        label={t('total')}
        value={<Money value={total.data.totalAmount} />}
      />
      <SummaryTile
        hue="green"
        icon={<Wallet aria-hidden className="size-3.5" />}
        label={t('today')}
        value={<Money value={today.data.totalAmount} />}
      />
      <SummaryTile
        hue="purple"
        icon={<Wallet aria-hidden className="size-3.5" />}
        label={t('thisMonth')}
        value={<Money value={thisMonth.data.totalAmount} />}
      />
    </SummaryTileGrid>
  );
}
