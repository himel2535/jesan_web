'use client';

import { Boxes } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/core/i18n/use-format';
import { EmptyState } from '@/core/ui/empty-state';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { useStockReport } from './api';
import { useNameOf } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { useUnitInfo } from '../sales/shared';
import { ListSkeleton } from './skeletons';

/** Current stock of every active product (`report.view`). */
export function StockReport({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.reports');
  const tc = useTranslations('dealership.common');
  const ts = useTranslations('dealership.reports.stock');
  const format = useFormat();
  const nameOf = useNameOf();
  const units = useUnitInfo(slug, businessId);
  const params = useSearchParams();
  const filters = { page: parsePageParam(params.get('page')) };
  const query = useStockReport(slug, businessId, filters);

  if (query.isPending) return <ListSkeleton />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;

  return (
    <div className="space-y-4">
      {data.items.length === 0 ? (
        <EmptyState
          icon={Boxes}
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
                  <th scope="col" className="px-4 py-3 font-medium">
                    {ts('columns.unit')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {ts('columns.currentStock')}
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
                    <td className="px-4 py-3">{units.nameOf(row.unitKey)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {format.quantity(row.currentStock, units.decimalsOf(row.unitKey))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination totalItems={data.total} pageSize={data.pageSize || PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
