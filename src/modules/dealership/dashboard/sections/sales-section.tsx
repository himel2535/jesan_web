'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { Money } from '../../master-data/shared/display';
import { useOrders } from '../../sales/api';
import { SalesSummaryCards, SalesSummaryCardsSkeleton } from '../../sales/summary-cards';
import { useSalesSummaryRanges } from '../../sales/shared';
import type { DailySummaryResponse } from '../../reports/types';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Reuses the Sales page's own `SalesSummaryCards` (orders, deliveries, amounts across
 * total/today/this-month) and adds two dashboard-only cards: today's delivery count (from the
 * daily summary already fetched for the cash section) and open-order count (`sale.view.*`,
 * `GET orders?status=open`, correct via `Page.total` regardless of page size). A pending-amount
 * aggregate would need a new backend endpoint — noted in DECISIONS.md rather than guessed here.
 */
export function SalesSection({
  slug,
  businessId,
  dailySummary,
}: {
  slug: string;
  businessId: string;
  dailySummary: DailySummaryResponse;
}) {
  const t = useTranslations('dealership');
  const format = useFormat();
  const ranges = useSalesSummaryRanges();
  const pendingOrders = useOrders(slug, businessId, { status: 'open', page: 1 });

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-fg">{t('nav.sales')}</h2>
      <SalesSummaryCards slug={slug} businessId={businessId} ranges={ranges} />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-4">
        <div className="text-center">
          <dt className="text-sm text-fg-muted">{t('sales.summary.todayDeliveries')}</dt>
          <dd className="font-semibold">
            {dailySummary.deliveries.count} &middot;{' '}
            <Money value={dailySummary.deliveries.amount} />
          </dd>
        </div>
        {isForbidden(pendingOrders.error) ? null : pendingOrders.isPending ? (
          <div className="text-center">
            <div className="mx-auto h-4 w-28 animate-pulse rounded bg-surface-muted" />
            <div className="mx-auto mt-2 h-6 w-16 animate-pulse rounded bg-surface-muted" />
          </div>
        ) : pendingOrders.data ? (
          <div className="text-center">
            <dt className="text-sm text-fg-muted">{t('sales.summary.pendingOrders')}</dt>
            <dd className="font-semibold">{format.number(pendingOrders.data.total)}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

export function SalesSectionSkeleton() {
  return <SalesSummaryCardsSkeleton />;
}
