'use client';

import { ArrowLeftRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useFormat } from '@/core/i18n/use-format';
import { EmptyState } from '@/core/ui/empty-state';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { useStockMovementsReport } from './api';
import { useNameOf } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { useUnitInfo } from '../sales/shared';
import { ListSkeleton } from './skeletons';
import { dateParam, useKindLabel, useSetFilters } from './shared';

/** Net stock movement per product over a date range, with a breakdown by kind (`report.view`). */
export function StockMovementsReport({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.reports');
  const tc = useTranslations('dealership.common');
  const tm = useTranslations('dealership.reports.stockMovements');
  const id = useId();
  const format = useFormat();
  const nameOf = useNameOf();
  const units = useUnitInfo(slug, businessId);
  const kindLabel = useKindLabel();
  const setFilters = useSetFilters();
  const params = useSearchParams();
  const filters = {
    from: dateParam(params, 'from'),
    to: dateParam(params, 'to'),
    page: parsePageParam(params.get('page')),
  };
  const query = useStockMovementsReport(slug, businessId, filters);

  const label = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {text}
    </label>
  );

  if (query.isPending) return <ListSkeleton />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          {label(`${id}-from`, t('common.from'))}
          <input
            id={`${id}-from`}
            type="date"
            value={filters.from ?? ''}
            max={filters.to}
            onChange={(e) => setFilters({ from: e.target.value || undefined })}
            className={inputClass}
          />
        </div>
        <div>
          {label(`${id}-to`, t('common.to'))}
          <input
            id={`${id}-to`}
            type="date"
            value={filters.to ?? ''}
            min={filters.from}
            onChange={(e) => setFilters({ to: e.target.value || undefined })}
            className={inputClass}
          />
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
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
                    {tm('columns.unit')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {tm('columns.net')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const decimals = units.decimalsOf(row.unitKey);
                  return (
                    <tr key={row.productId} className="border-b border-border last:border-0">
                      <th scope="row" className="px-4 py-3 font-mono font-medium whitespace-nowrap">
                        {row.code}
                      </th>
                      <td className="px-4 py-3">
                        {nameOf(row)}
                        {row.byKind.length > 0 ? (
                          <p className="mt-0.5 text-xs text-fg-muted">
                            {row.byKind
                              .map(
                                (k) =>
                                  `${kindLabel(k.kind)}: ${format.quantity(k.quantity, decimals)}`,
                              )
                              .join(', ')}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{units.nameOf(row.unitKey)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {format.quantity(row.net, decimals)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination totalItems={data.total} pageSize={data.pageSize || PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
