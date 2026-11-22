'use client';

import { BookOpen } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { cn } from '@/core/ui/cn';
import { EmptyState } from '@/core/ui/empty-state';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { LoadError } from '../master-data/shared/states';
import { Money } from '../master-data/shared/display';
import { useAccountsLedger } from './api';
import { useBusinessDay, useMethodLabel, useSetFilters, dateParam } from './shared';
import { LEDGER_ENTRY_TYPES, type LedgerFilters } from './types';

export function LedgerTable({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.accounts');
  const id = useId();
  const day = useBusinessDay();
  const methodLabel = useMethodLabel();
  const setFilters = useSetFilters();
  const params = useSearchParams();

  const filters: LedgerFilters = {
    from: dateParam(params, 'from'),
    to: dateParam(params, 'to'),
    type: params.get('type') || undefined,
    page: parsePageParam(params.get('page')),
  };

  const query = useAccountsLedger(slug, businessId, filters);

  if (query.isError) {
    return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`${id}-type`} className="mb-1.5 block text-sm font-medium text-fg">
            {t('ledger.typeFilter')}
          </label>
          <select
            id={`${id}-type`}
            value={filters.type ?? ''}
            onChange={(e) => setFilters({ type: e.target.value || undefined })}
            className={inputClass}
          >
            <option value="">{t('ledger.allTypes')}</option>
            {LEDGER_ENTRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`ledger.types.${type}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {query.isPending ? (
        <TableSkeleton />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={BookOpen} title={t('ledger.empty')} />
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
                    {t('ledger.col.date')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('ledger.col.type')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('ledger.col.direction')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('ledger.col.method')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t('ledger.col.amount')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('ledger.col.status')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('ledger.col.note')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-b border-border last:border-0',
                      item.status === 'void' && 'line-through opacity-60',
                    )}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{day(item.entryDate)}</td>
                    <td className="px-4 py-3">{t(`ledger.types.${item.type}`)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          item.direction === 'in'
                            ? 'bg-success/10 text-success'
                            : 'bg-danger/10 text-danger',
                        )}
                      >
                        {t(`ledger.direction.${item.direction}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.method ? methodLabel(item.method) : ''}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Money value={item.amount} />
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'void' ? (
                        <span className="inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                          {t('ledger.status.void')}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-48 truncate px-4 py-3 text-fg-muted">{item.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination totalItems={query.data.total} pageSize={query.data.pageSize || PAGE_SIZE} />
        </>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
