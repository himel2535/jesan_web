'use client';

import { BookOpen } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { businessToday } from '@/core/i18n/format';
import { cn } from '@/core/ui/cn';
import { EmptyState } from '@/core/ui/empty-state';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { useCashBook } from '../expenses/api';
import {
  LIFETIME_FROM,
  dateParam,
  useBusinessDay,
  useMethodLabel,
  useSetFilters,
} from '../expenses/shared';
import { ListSkeleton } from '../expenses/skeletons';

/**
 * The daily cash book (`cashbook.view`): opening/closing balance, totals by method, and one row
 * per day something happened. Every number is the API's; nothing here is added or subtracted in
 * the browser (docs/API.md §13 — the cash book has no table of its own, it is counted live).
 */
export function CashBookView({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.cashBook');
  const tc = useTranslations('dealership.expenses');
  const id = useId();
  const day = useBusinessDay();
  const methodLabel = useMethodLabel();
  const setFilters = useSetFilters();
  const params = useSearchParams();
  const filters = {
    from: dateParam(params, 'from'),
    to: dateParam(params, 'to'),
    page: parsePageParam(params.get('page')),
  };
  const query = useCashBook(slug, businessId, filters);

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
      <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-sm text-fg-muted">{t('openingBalance')}</dt>
          <dd className="font-semibold">
            <Money value={data.openingBalance} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">{t('totalIn')}</dt>
          <dd className="font-semibold">
            <Money value={data.totals.in} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">{t('totalOut')}</dt>
          <dd className="font-semibold">
            <Money value={data.totals.out} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">{t('closingBalance')}</dt>
          <dd className="text-lg font-bold">
            <Money value={data.closingBalance} />
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          {label(`${id}-from`, t('filters.from'))}
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
          {label(`${id}-to`, t('filters.to'))}
          <input
            id={`${id}-to`}
            type="date"
            value={filters.to ?? ''}
            min={filters.from}
            onChange={(e) => setFilters({ to: e.target.value || undefined })}
            className={inputClass}
          />
        </div>
        <button
          type="button"
          onClick={() => setFilters({ from: LIFETIME_FROM, to: businessToday() })}
          className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-muted"
        >
          {t('filters.lifetime')}
        </button>
      </div>

      {data.byMethod.length > 0 ? (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {tc('method')}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  {t('in')}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  {t('out')}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  {t('net')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.byMethod.map((row) => (
                <tr key={row.method} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium">
                    {methodLabel(row.method)}
                    {row.isCash ? (
                      <span className="ml-2 text-xs font-normal text-fg-muted">({t('cash')})</span>
                    ) : null}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <Money value={row.in} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <Money value={row.out} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <Money value={row.net} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data.days.length === 0 ? (
        <EmptyState icon={BookOpen} title={t('emptyTitle')} description={t('emptyDescription')} />
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
                    {t('date')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t('opening')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t('collections')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t('expenses')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t('purchases')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t('closing')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((row) => (
                  <tr key={row.date} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap">
                      {day(row.date)}
                    </th>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Money value={row.opening} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Money value={row.collections} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Money value={row.expenses} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Money value={row.purchases} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      <Money value={row.closing} />
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
