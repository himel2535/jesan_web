'use client';

import { Receipt } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/core/ui/empty-state';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { useDuesReport } from './api';
import { Money, useNameOf } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { ListSkeleton } from './skeletons';

/** Active customers with a non-zero balance, newest-due-first aging (`report.view`). */
export function DuesReport({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.reports');
  const tc = useTranslations('dealership.common');
  const td = useTranslations('dealership.reports.dues');
  const nameOf = useNameOf();
  const params = useSearchParams();
  const filters = { page: parsePageParam(params.get('page')) };
  const query = useDuesReport(slug, businessId, filters);

  if (query.isPending) return <ListSkeleton />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;

  return (
    <div className="space-y-4">
      {data.items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t('common.emptyTitle')}
          description={t('common.emptyDescription')}
        />
      ) : (
        <>
          <div
            className={cn(
              'overflow-x-auto rounded-card border border-border bg-surface',
              query.isPlaceholderData && 'opacity-60',
            )}
            aria-busy={query.isFetching}
          >
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-fg-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {tc('code')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {tc('name')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {td('columns.currentBalance')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {td('columns.dueAmount')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {td('columns.advanceAmount')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {td('aging.d0To7')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {td('aging.d8To30')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {td('aging.d30Plus')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 font-mono font-medium whitespace-nowrap">
                      {row.code}
                    </th>
                    <td className="px-4 py-3">{nameOf(row)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Money value={row.currentBalance} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Money value={row.dueAmount} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Money value={row.advanceAmount} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Money value={row.aging.d0To7} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Money value={row.aging.d8To30} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Money value={row.aging.d30Plus} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <th scope="row" className="px-4 py-3" colSpan={3}>
                    {t('common.total')}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <Money value={data.totalDue} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <Money value={data.totalAdvance} />
                  </td>
                  <td className="px-4 py-3" colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
          <Pagination totalItems={data.total} pageSize={data.pageSize || PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
