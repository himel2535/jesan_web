'use client';

import { Box, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { usePurchasesSummary } from './api';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { SummaryTile, SummaryTileGrid } from '../dashboard/summary-tile';
import type { PurchaseSummaryRanges } from './shared';
import type { PurchaseTotals } from './types';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

export function PurchasesSummaryCardsSkeleton() {
  return (
    <SummaryTileGrid className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <SummaryTile
          key={i}
          hue="blue"
          icon={<Truck aria-hidden className="size-3.5" />}
          label=""
          value={null}
          loading
        />
      ))}
    </SummaryTileGrid>
  );
}

export function PurchasesSummaryCards({
  slug,
  businessId,
  ranges,
}: {
  slug: string;
  businessId: string;
  ranges: PurchaseSummaryRanges;
}) {
  const t = useTranslations('dealership.purchases.summary');
  const format = useFormat();
  const { total, today, thisMonth, thisYear } = usePurchasesSummary(slug, businessId, ranges);
  const queries = [total, today, thisMonth, thisYear];
  const firstError = queries.find((q) => q.error)?.error;

  if (isForbidden(firstError)) {
    return null;
  }
  if (queries.some((q) => q.isPending)) {
    return <PurchasesSummaryCardsSkeleton />;
  }
  if (firstError) {
    const retry = () => {
      for (const q of queries) void q.refetch();
    };
    return <LoadError error={firstError} onRetry={retry} />;
  }
  if (!total.data || !today.data || !thisMonth.data || !thisYear.data) {
    return null;
  }

  const amount = (data: PurchaseTotals) =>
    data.totalAmount !== undefined ? <Money value={data.totalAmount} /> : null;

  return (
    <SummaryTileGrid className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <SummaryTile
        hue="blue"
        icon={<Truck aria-hidden className="size-3.5" />}
        label={t('totalAmount')}
        value={amount(total.data)}
      />
      <SummaryTile
        hue="green"
        icon={<Box aria-hidden className="size-3.5" />}
        label={t('totalQuantity')}
        value={format.quantity(total.data.totalQuantity)}
      />
      <SummaryTile
        hue="purple"
        icon={<Truck aria-hidden className="size-3.5" />}
        label={t('today')}
        value={amount(today.data)}
      />
      <SummaryTile
        hue="orange"
        icon={<Truck aria-hidden className="size-3.5" />}
        label={t('thisMonth')}
        value={amount(thisMonth.data)}
      />
      <SummaryTile
        hue="blue"
        icon={<Truck aria-hidden className="size-3.5" />}
        label={t('thisYear')}
        value={amount(thisYear.data)}
      />
    </SummaryTileGrid>
  );
}
