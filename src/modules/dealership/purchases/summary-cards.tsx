'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { usePurchasesSummary } from './api';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import type { PurchaseSummaryRanges } from './shared';
import type { PurchaseTotals } from './types';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

export function PurchasesSummaryCardsSkeleton() {
  return (
    <div className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-surface-muted" />
          <div className="h-6 w-24 animate-pulse rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

/**
 * Five KPI cards (`purchase.view`, same as the page itself, so a 403 on all four queries here
 * shouldn't happen in practice). The amount figure is its own, independently permission-gated
 * value (`product.cost.view`): when it's missing from a card's response, only that figure is
 * left out, not the whole card — the quantity and count stay visible.
 */
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
    <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <dt className="text-sm text-fg-muted">{t('totalAmount')}</dt>
        <dd className="font-semibold">{amount(total.data)}</dd>
      </div>
      <div>
        <dt className="text-sm text-fg-muted">{t('totalQuantity')}</dt>
        <dd className="font-semibold tabular-nums">{format.quantity(total.data.totalQuantity)}</dd>
      </div>
      <div>
        <dt className="text-sm text-fg-muted">{t('today')}</dt>
        <dd className="font-semibold">{amount(today.data)}</dd>
      </div>
      <div>
        <dt className="text-sm text-fg-muted">{t('thisMonth')}</dt>
        <dd className="font-semibold">{amount(thisMonth.data)}</dd>
      </div>
      <div>
        <dt className="text-sm text-fg-muted">{t('thisYear')}</dt>
        <dd className="font-semibold">{amount(thisYear.data)}</dd>
      </div>
    </dl>
  );
}
