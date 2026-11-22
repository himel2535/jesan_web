'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { useCollectionsSummaryAmounts } from '../api';
import { Money } from '../../master-data/shared/display';
import { LoadError } from '../../master-data/shared/states';
import type { SalesSummaryRanges } from '../shared';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

export function CollectionsSummaryCardsSkeleton() {
  return (
    <div className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-surface-muted" />
          <div className="h-6 w-24 animate-pulse rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

/**
 * Three KPI cards (`report.view`). The Collections page itself only needs `collection.view`, so a
 * user without `report.view` gets a 403 on all three queries here — that's a UI-visibility gap,
 * not an error, so the cards simply don't render (same convention as `ExpensesSummaryCards`). Any
 * OTHER failure (network, 500, …) is a real error and must stay visible with a retry.
 */
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
    <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-3">
      <div>
        <dt className="text-sm text-fg-muted">{t('total')}</dt>
        <dd className="font-semibold">
          <Money value={total.data.totalAmount} />
        </dd>
      </div>
      <div>
        <dt className="text-sm text-fg-muted">{t('today')}</dt>
        <dd className="font-semibold">
          <Money value={today.data.totalAmount} />
        </dd>
      </div>
      <div>
        <dt className="text-sm text-fg-muted">{t('thisMonth')}</dt>
        <dd className="font-semibold">
          <Money value={thisMonth.data.totalAmount} />
        </dd>
      </div>
    </dl>
  );
}
