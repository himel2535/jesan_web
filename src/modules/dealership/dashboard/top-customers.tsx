'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { salesReportQuery } from '../reports/api';
import { LIFETIME_FROM } from '../expenses/shared';

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** Top 5 customers by bags sold (lifetime), from `reports/sales?groupBy=customer&sort=quantity`. */
export function TopCustomers({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard.topCustomers');
  const format = useFormat();

  const query = useQuery(
    salesReportQuery(slug, businessId, {
      groupBy: 'customer',
      sort: 'quantity',
      from: LIFETIME_FROM,
      page: 1,
    }),
  );

  const top5 = useMemo(() => query.data?.items.slice(0, 5) ?? [], [query.data]);

  if (isForbidden(query.error)) return null;

  return (
    <div className="flex h-full flex-col rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
      <h2 className="mb-4 text-base font-semibold text-[var(--dash-fg)]">{t('title')}</h2>

      {query.error && !isForbidden(query.error) ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-[var(--dash-bg)]" />
          ))}
        </div>
      ) : top5.length === 0 ? (
        <p className="text-sm text-[var(--dash-fg-muted)]">{t('empty')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--dash-border)] text-left text-xs text-[var(--dash-fg-muted)]">
              <th className="w-8 pb-2 font-medium">{t('rank')}</th>
              <th className="pb-2 font-medium">{t('customer')}</th>
              <th className="pb-2 text-right font-medium">{t('totalBags')}</th>
              <th className="pb-2 text-right font-medium">{t('totalSales')}</th>
            </tr>
          </thead>
          <tbody>
            {top5.map((row, index) => (
              <tr key={row.key} className="border-b border-[var(--dash-border)] last:border-0">
                <td className="py-2.5 text-[var(--dash-fg-muted)]">{index + 1}</td>
                <td className="py-2.5 font-medium text-[var(--dash-fg)]">{row.label}</td>
                <td className="py-2.5 text-right text-[var(--dash-fg)] tabular-nums">
                  {format.quantity(row.quantity)}
                </td>
                <td className="py-2.5 text-right text-[var(--dash-fg)]">
                  <Money value={row.amount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
