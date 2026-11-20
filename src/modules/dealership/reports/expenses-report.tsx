'use client';

import { Receipt } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { EmptyState } from '@/core/ui/empty-state';
import { cn } from '@/core/ui/cn';
import { inputClass } from '@/core/ui/text-field';
import { useExpensesReport } from './api';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { ListSkeleton } from './skeletons';
import { dateParam, groupByParam, useSetFilters } from './shared';
import { EXPENSES_REPORT_GROUP_BY, type ExpensesReportGroupBy } from './types';

/** Active expenses by category or month — no pagination, jesan-api never paginates this one. */
export function ExpensesReport({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.reports');
  const te = useTranslations('dealership.reports.expenses');
  const id = useId();
  const setFilters = useSetFilters();
  const params = useSearchParams();
  const filters = {
    groupBy: groupByParam(
      params,
      'groupBy',
      EXPENSES_REPORT_GROUP_BY,
      'category' as ExpensesReportGroupBy,
    ),
    from: dateParam(params, 'from'),
    to: dateParam(params, 'to'),
  };
  const query = useExpensesReport(slug, businessId, filters);

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
          {label(`${id}-groupBy`, t('common.groupBy'))}
          <select
            id={`${id}-groupBy`}
            value={filters.groupBy}
            onChange={(e) => setFilters({ groupBy: e.target.value })}
            className={inputClass}
          >
            {EXPENSES_REPORT_GROUP_BY.map((g) => (
              <option key={g} value={g}>
                {te(`groupBy.${g}`)}
              </option>
            ))}
          </select>
        </div>
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
          icon={Receipt}
          title={t('common.emptyTitle')}
          description={t('common.emptyDescription')}
        />
      ) : (
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
                  {te('columns.group')}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  {te('columns.count')}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  {te('columns.amount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium">
                    {row.label}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums">{row.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <Money value={row.amount} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <th scope="row" className="px-4 py-3">
                  {t('common.total')}
                </th>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular-nums">
                  <Money value={data.totalAmount} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
