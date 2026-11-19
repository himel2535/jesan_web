'use client';

import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { absoluteMoney, isNegativeMoney } from '@/core/lib/money';
import { cn } from '@/core/ui/cn';
import { EmptyState } from '@/core/ui/empty-state';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { Balance, Money } from '../../master-data/shared/display';
import { LoadError } from '../../master-data/shared/states';
import { useCustomerLedger } from '../api';
import { ListSkeleton } from '../skeletons';
import { dateParam, useBusinessDay, useSetFilters } from '../shared';
import type { LedgerEntry } from '../types';

/**
 * One customer's ledger (`customer.due.view`): every change of the balance, newest first.
 *
 * Every number comes from the API. There is no running-balance column: the API stores no
 * `balance_after`, because correcting the opening balance would make old numbers wrong
 * (docs/plans/step-5b.md decision 2). The summary carries today's balance instead.
 */
export function CustomerLedger({
  slug,
  businessId,
  customerId,
}: {
  slug: string;
  businessId: string;
  customerId: string;
}) {
  const t = useTranslations('dealership.sales.ledger');
  const tc = useTranslations('dealership.sales.common');
  const tf = useTranslations('dealership.sales.filters');
  const id = useId();
  const day = useBusinessDay();
  const setFilters = useSetFilters();
  const params = useSearchParams();
  const canSeeDeliveries = useCan('delivery.view');
  const canSeeCollections = useCan('collection.view');
  const filters = {
    from: dateParam(params, 'from'),
    to: dateParam(params, 'to'),
    page: parsePageParam(params.get('page')),
  };
  const query = useCustomerLedger(slug, businessId, customerId, filters);
  const base = `/b/${encodeURIComponent(slug)}`;

  const label = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {text}
    </label>
  );

  if (query.isPending) return <ListSkeleton />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const { customer, items } = query.data;

  const canOpen = (kind: LedgerEntry['source']['type']) =>
    kind === 'delivery' ? canSeeDeliveries : canSeeCollections;
  const hrefOf = (entry: LedgerEntry) =>
    `${base}/${entry.source.type === 'delivery' ? 'deliveries' : 'collections'}/${entry.source.id}`;

  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-sm text-fg-muted">{t('openingBalance')}</dt>
          <dd className="font-semibold">
            <Balance value={customer.openingBalance} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">{t('deliveredAmount')}</dt>
          <dd className="font-semibold">
            <Money value={customer.deliveredAmount} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">{t('collectedAmount')}</dt>
          <dd className="font-semibold">
            <Money value={customer.collectedAmount} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">{t('currentBalance')}</dt>
          <dd className="text-lg font-bold">
            <Balance value={customer.currentBalance} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">{t('creditLimit')}</dt>
          <dd className="font-semibold">
            {customer.creditLimit === null ? (
              <span className="text-fg-muted">{t('noLimit')}</span>
            ) : (
              <Money value={customer.creditLimit} />
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          {label(`${id}-from`, tf('from'))}
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
          {label(`${id}-to`, tf('to'))}
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

      {items.length === 0 ? (
        <EmptyState icon={BookOpen} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          <p className="text-sm text-fg-muted">{t('amountHint')}</p>
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
                    {t('entryDate')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('kind')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('source')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {tc('amount')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('reason')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {tc('createdBy')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{day(entry.entryDate)}</td>
                    <td className="px-4 py-3">{t(`kinds.${entry.kind}`)}</td>
                    <th scope="row" className="px-4 py-3 font-mono font-medium">
                      {canOpen(entry.source.type) ? (
                        <Link href={hrefOf(entry)} prefetch={false} className="hover:underline">
                          {entry.source.code}
                        </Link>
                      ) : (
                        entry.source.code
                      )}
                    </th>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      <SignedAmount value={entry.amount} />
                    </td>
                    <td className="px-4 py-3">{entry.reason ?? '—'}</td>
                    <td className="px-4 py-3 text-fg-muted">{entry.createdBy.name}</td>
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

/** A signed ledger amount: the sign is kept, the number is formatted, nothing is calculated. */
function SignedAmount({ value }: { value: string }) {
  const format = useFormat();
  const negative = isNegativeMoney(value);
  return (
    <span>
      {negative ? '−' : '+'}
      {format.money(absoluteMoney(value))}
    </span>
  );
}
