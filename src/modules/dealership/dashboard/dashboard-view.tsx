'use client';

import { useTranslations } from 'next-intl';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { useDailySummary } from '../reports/api';
import { ListSkeleton } from '../reports/skeletons';

/**
 * Today's daily summary (`report.view`): four stat cards, plus cash opening/closing/net when the
 * API includes it (`cashbook.view` — omitted server-side otherwise, never hidden here).
 */
export function DashboardView({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.reports.dailySummary');
  const query = useDailySummary(slug, businessId);

  if (query.isPending) return <ListSkeleton />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;

  const stat = (label: string, value: { count: number; amount: string }) => (
    <div>
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="font-semibold">
        {value.count} &middot; <Money value={value.amount} />
      </dd>
    </div>
  );

  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat(t('orders'), data.orders)}
        {stat(t('deliveries'), data.deliveries)}
        {stat(t('collections'), data.collections)}
        {stat(t('expenses'), data.expenses)}
      </dl>
      {data.cash ? (
        <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-fg-muted">{t('cash.openingBalance')}</dt>
            <dd className="font-semibold">
              <Money value={data.cash.openingBalance} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-fg-muted">{t('cash.closingBalance')}</dt>
            <dd className="text-lg font-bold">
              <Money value={data.cash.closingBalance} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-fg-muted">{t('cash.net')}</dt>
            <dd className="font-semibold">
              <Money value={data.cash.net} />
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
