'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { useExpensesSummary } from './api';
import type { ExpenseSummaryRanges } from './shared';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

export function ExpensesSummaryCardsSkeleton() {
  return (
    <div className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-surface-muted" />
          <div className="h-6 w-24 animate-pulse rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

/**
 * Four KPI cards (`report.view`). The Expenses page itself only needs `expense.view`, so a user
 * without `report.view` gets a 403 on all four queries here — that's a UI-visibility gap, not an
 * error, so the cards simply don't render (same convention as the dashboard's cash stats, which
 * disappear instead of showing an error when their own extra permission is missing). Any OTHER
 * failure (network, 500, …) is a real error and must stay visible with a retry, not disappear
 * silently — that would hide a genuine bug behind "the cards just aren't there".
 */
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
    <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
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
      <div>
        <dt className="text-sm text-fg-muted">{t('previousMonth')}</dt>
        <dd className="font-semibold">
          <Money value={previousMonth.data.totalAmount} />
        </dd>
      </div>
    </dl>
  );
}
