'use client';

import { Receipt } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { SummaryTile, SummaryTileGrid } from '../dashboard/summary-tile';
import { useExpensesSummary } from './api';
import type { ExpenseSummaryRanges } from './shared';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

export function ExpensesSummaryCardsSkeleton() {
  return (
    <SummaryTileGrid className="sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <SummaryTile
          key={i}
          hue="blue"
          icon={<Receipt aria-hidden className="size-3.5" />}
          label=""
          value={null}
          loading
        />
      ))}
    </SummaryTileGrid>
  );
}

export function ExpensesSummaryCards({
  slug,
  businessId,
  ranges,
}: {
  slug: string;
  businessId: string;
  ranges: ExpenseSummaryRanges;
}) {
  const t = useTranslations('dealership.expenses.summary');
  const { total, today, thisMonth, previousMonth } = useExpensesSummary(slug, businessId, ranges);
  const queries = [total, today, thisMonth, previousMonth];
  const firstError = queries.find((q) => q.error)?.error;

  if (isForbidden(firstError)) {
    return null;
  }
  if (queries.some((q) => q.isPending)) {
    return <ExpensesSummaryCardsSkeleton />;
  }
  if (firstError) {
    const retry = () => {
      for (const q of queries) void q.refetch();
    };
    return <LoadError error={firstError} onRetry={retry} />;
  }
  if (!total.data || !today.data || !thisMonth.data || !previousMonth.data) {
    return null;
  }

  return (
    <SummaryTileGrid className="sm:grid-cols-2 lg:grid-cols-4">
      <SummaryTile
        hue="blue"
        icon={<Receipt aria-hidden className="size-3.5" />}
        label={t('total')}
        value={<Money value={total.data.totalAmount} />}
      />
      <SummaryTile
        hue="green"
        icon={<Receipt aria-hidden className="size-3.5" />}
        label={t('today')}
        value={<Money value={today.data.totalAmount} />}
      />
      <SummaryTile
        hue="purple"
        icon={<Receipt aria-hidden className="size-3.5" />}
        label={t('thisMonth')}
        value={<Money value={thisMonth.data.totalAmount} />}
      />
      <SummaryTile
        hue="orange"
        icon={<Receipt aria-hidden className="size-3.5" />}
        label={t('previousMonth')}
        value={<Money value={previousMonth.data.totalAmount} />}
      />
    </SummaryTileGrid>
  );
}
