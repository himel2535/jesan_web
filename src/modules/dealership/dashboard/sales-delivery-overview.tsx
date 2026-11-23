'use client';

import { useQueries } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { LoadError } from '../master-data/shared/states';
import { ordersQuery, deliveriesQuery } from '../sales/api';
import { salesReportQuery, useDailySummary } from '../reports/api';
import { useDashboardRanges } from './shared';

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Pending Orders, Today's Deliveries, Completed Deliveries (this month), Today's Sold Bags.
 * "Pending Deliveries" is deliberately not shown as a separate stat — a delivery row always
 * represents a completed delivery event, so it would just duplicate Pending Orders (see
 * DECISIONS.md "Sales & Delivery Overview").
 */
export function SalesDeliveryOverview({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard.salesDelivery');
  const format = useFormat();
  const canView = useCan({ anyOf: ['sale.view.all', 'sale.view.own'] });
  const dashRanges = useDashboardRanges();
  const dailySummary = useDailySummary(slug, businessId);

  const [pendingOrders, completedDeliveries, todaysSoldBags] = useQueries({
    queries: [
      { ...ordersQuery(slug, businessId, { status: 'open', page: 1 }), enabled: canView },
      {
        ...deliveriesQuery(slug, businessId, { ...dashRanges.thisMonth, page: 1 }),
        enabled: canView,
      },
      {
        ...salesReportQuery(slug, businessId, { groupBy: 'date', ...dashRanges.today, page: 1 }),
        enabled: canView,
      },
    ],
  });

  if (!canView) return null;

  const error = pendingOrders.error ?? completedDeliveries.error ?? todaysSoldBags.error;
  if (isForbidden(error)) return null;

  const isPending =
    pendingOrders.isPending ||
    completedDeliveries.isPending ||
    todaysSoldBags.isPending ||
    dailySummary.isPending;

  const stats = [
    { key: 'pendingOrders', value: pendingOrders.data?.total },
    { key: 'todaysDeliveries', value: dailySummary.data?.deliveries.count },
    { key: 'completedDeliveries', value: completedDeliveries.data?.total },
    {
      key: 'todaysSoldBags',
      value: todaysSoldBags.data ? Number(todaysSoldBags.data.totalQuantity) : undefined,
    },
  ] as const;

  return (
    <div className="flex h-full flex-col rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
      <h2 className="mb-4 text-base font-semibold text-[var(--dash-fg)]">{t('title')}</h2>

      {error && !isForbidden(error) ? (
        <LoadError
          error={error}
          onRetry={() => {
            void pendingOrders.refetch();
            void completedDeliveries.refetch();
            void todaysSoldBags.refetch();
            void dailySummary.refetch();
          }}
        />
      ) : isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-5 w-full animate-pulse rounded bg-[var(--dash-bg)]" />
          ))}
        </div>
      ) : (
        <dl className="flex flex-1 flex-col justify-between gap-2 text-sm">
          {stats.map((stat) => (
            <div key={stat.key} className="flex items-center justify-between">
              <dt className="text-[var(--dash-fg-muted)]">{t(stat.key)}</dt>
              <dd className="font-medium text-[var(--dash-fg)] tabular-nums">
                {stat.value !== undefined ? format.number(stat.value) : '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
