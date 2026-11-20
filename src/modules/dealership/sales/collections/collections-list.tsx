'use client';

import { Plus, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useCan } from '@/core/auth/can';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { useCustomer } from '../../master-data/api';
import { Balance, Money, useNameOf } from '../../master-data/shared/display';
import { DetailsLink } from '../../master-data/shared/row-actions';
import { ListEmpty, LoadError } from '../../master-data/shared/states';
import { useCollectionMethods, useCollections } from '../api';
import { ListSkeleton } from '../skeletons';
import {
  CustomerFilter,
  StatusText,
  dateParam,
  useBusinessDay,
  useMethodLabel,
  useSetFilters,
} from '../shared';
import type { CollectionFilters } from '../types';

const buttonLink =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90';

/**
 * A collection only embeds a bare customer ref (docs/API.md §11), never the balance — so the
 * due column fetches each row's customer. Bounded to 10 rows/page; React Query dedupes repeats.
 */
function CustomerDue({
  slug,
  businessId,
  customerId,
}: {
  slug: string;
  businessId: string;
  customerId: string;
}) {
  const query = useCustomer(slug, businessId, customerId);
  if (query.data?.currentBalance === undefined) return null;
  return <Balance value={query.data.currentBalance} className="font-semibold" />;
}

function useCollectionFilters(): CollectionFilters {
  const p = useSearchParams();
  const status = p.get('status');
  return {
    customerId: p.get('customerId') || undefined,
    orderId: p.get('orderId') || undefined,
    method: p.get('method') || undefined,
    status: status === 'active' || status === 'void' ? status : undefined,
    from: dateParam(p, 'from'),
    to: dateParam(p, 'to'),
    page: parsePageParam(p.get('page')),
  };
}

/** Collections, 10 per page, newest first (`collection.view`). */
export function CollectionsList({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.sales.collections');
  const tc = useTranslations('dealership.sales.common');
  const tf = useTranslations('dealership.sales.filters');
  const ts = useTranslations('dealership.sales');
  const td = useTranslations('dealership.common');
  const tcust = useTranslations('dealership.customers');
  const id = useId();
  const nameOf = useNameOf();
  const day = useBusinessDay();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const methodLabel = useMethodLabel();
  const setFilters = useSetFilters();
  const canCreate = useCan('collection.create');
  const canSeeDue = useCan('customer.due.view');
  const filters = useCollectionFilters();
  const query = useCollections(slug, businessId, filters);
  const methods = useCollectionMethods(slug, businessId, canCreate);
  const base = `/b/${encodeURIComponent(slug)}/collections`;

  const items = query.data?.items ?? [];
  const filtered = Boolean(
    filters.status || filters.customerId || filters.method || filters.from || filters.to,
  );

  const label = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {text}
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
          {methods.data && methods.data.length > 0 ? (
            <div>
              {label(`${id}-method`, t('method'))}
              <select
                id={`${id}-method`}
                value={filters.method ?? ''}
                onChange={(e) => setFilters({ method: e.target.value || undefined })}
                className={inputClass}
              >
                <option value="">{t('methodAll')}</option>
                {methods.data.map((m) => (
                  <option key={m} value={m}>
                    {methodLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            {label(`${id}-status`, ts('status.label'))}
            <select
              id={`${id}-status`}
              value={filters.status ?? ''}
              onChange={(e) => setFilters({ status: e.target.value || undefined })}
              className={inputClass}
            >
              <option value="">{ts('status.all')}</option>
              <option value="active">{ts('status.active')}</option>
              <option value="void">{ts('status.void')}</option>
            </select>
          </div>
        </div>
        {canCreate ? (
          <Link href={`${base}/new`} prefetch={false} className={buttonLink}>
            <Plus aria-hidden className="size-4" />
            {t('new')}
          </Link>
        ) : null}
      </div>

      <CustomerFilter slug={slug} businessId={businessId} customerId={filters.customerId} />

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <ListEmpty
          filtered={filtered}
          icon={Wallet}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          onClear={() =>
            setFilters({
              status: undefined,
              customerId: undefined,
              method: undefined,
              from: undefined,
              to: undefined,
            })
          }
        />
      ) : (
        <>
          <div className={cn(query.isPlaceholderData && 'opacity-60')} aria-busy={query.isFetching}>
            {isDesktop ? (
              <div className="overflow-x-auto rounded-card border border-border bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-fg-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {tc('code')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {tc('date')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {tc('customer')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('method')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {tc('amount')}
                      </th>
                      {canSeeDue ? (
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          {tcust('currentBalance')}
                        </th>
                      ) : null}
                      <th scope="col" className="px-4 py-3 font-medium">
                        {tc('order')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {ts('status.label')}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">{td('details')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => {
                      const href = `${base}/${c.id}`;
                      const prefetch = () => router.prefetch(href);
                      return (
                        <tr
                          key={c.id}
                          className="border-b border-border last:border-0 hover:bg-surface-muted"
                          onMouseEnter={prefetch}
                          onFocus={prefetch}
                        >
                          <th
                            scope="row"
                            className="px-4 py-3 font-mono font-medium whitespace-nowrap"
                          >
                            <Link href={href} prefetch={false} className="hover:underline">
                              {c.code}
                            </Link>
                          </th>
                          <td className="px-4 py-3 whitespace-nowrap">{day(c.collectionDate)}</td>
                          <td className="px-4 py-3">{nameOf(c.customer)}</td>
                          <td className="px-4 py-3">{methodLabel(c.method)}</td>
                          <td className="px-4 py-3 text-right">
                            <Money value={c.amount} className="font-semibold" />
                          </td>
                          {canSeeDue ? (
                            <td className="px-4 py-3 text-right">
                              <CustomerDue
                                slug={slug}
                                businessId={businessId}
                                customerId={c.customer.id}
                              />
                            </td>
                          ) : null}
                          <td className="px-4 py-3 font-mono">{c.order?.code ?? '—'}</td>
                          <td className="px-4 py-3">
                            <StatusText status={c.status} />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <DetailsLink href={href} name={c.code} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((c) => (
                  <li key={c.id} className="rounded-card border border-border bg-surface p-4">
                    <Link
                      href={`${base}/${c.id}`}
                      prefetch={false}
                      className="block hover:underline"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-mono font-medium">{c.code}</span>
                        <StatusText status={c.status} />
                      </span>
                      <span className="mt-1 block text-xs text-fg-muted">
                        {day(c.collectionDate)} · {nameOf(c.customer)} · {methodLabel(c.method)}
                      </span>
                    </Link>
                    <p className="mt-2 text-sm">
                      <span className="text-fg-muted">{tc('amount')}: </span>
                      <Money value={c.amount} className="font-semibold" />
                    </p>
                    {canSeeDue ? (
                      <p className="mt-1 text-sm">
                        <span className="text-fg-muted">{tcust('currentBalance')}: </span>
                        <CustomerDue
                          slug={slug}
                          businessId={businessId}
                          customerId={c.customer.id}
                        />
                      </p>
                    ) : null}
                    <div className="mt-3 flex justify-end">
                      <DetailsLink href={`${base}/${c.id}`} name={c.code} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Pagination totalItems={query.data.total} pageSize={query.data.pageSize || PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
