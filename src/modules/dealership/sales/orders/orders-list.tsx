'use client';

import { Plus, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useId } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { Money, useNameOf } from '../../master-data/shared/display';
import { DetailsLink } from '../../master-data/shared/row-actions';
import { ListEmpty, LoadError } from '../../master-data/shared/states';
import { useOrders } from '../api';
import { ListSkeleton } from '../skeletons';
import {
  CustomerFilter,
  DeliveryProgress,
  StatusText,
  dateParam,
  useBusinessDay,
  useSetFilters,
} from '../shared';
import { ORDER_STATUS_FILTERS, type OrderFilters, type OrderSummary } from '../types';

const buttonLink =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90';

/** Filters live in the URL (?status=&customerId=&from=&to=&page=). */
function useOrderFilters(): OrderFilters {
  const p = useSearchParams();
  const status = p.get('status');
  return {
    status: ORDER_STATUS_FILTERS.find((s) => s === status),
    customerId: p.get('customerId') || undefined,
    from: dateParam(p, 'from'),
    to: dateParam(p, 'to'),
    page: parsePageParam(p.get('page')),
  };
}

/**
 * Orders, 10 per page, newest first. The total column exists only when the API sends
 * `totalAmount`; otherwise no space is kept for it. Changing a filter or a page keeps the
 * rows on screen (placeholderData) so nothing flickers.
 */
export function OrdersList({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.sales.orders');
  const tc = useTranslations('dealership.sales.common');
  const tf = useTranslations('dealership.sales.filters');
  const ts = useTranslations('dealership.sales');
  const td = useTranslations('dealership.common');
  const id = useId();
  const format = useFormat();
  const nameOf = useNameOf();
  const day = useBusinessDay();
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const setFilters = useSetFilters();
  const canCreate = useCan('sale.create');
  const filters = useOrderFilters();
  const query = useOrders(slug, businessId, filters);
  const base = `/b/${encodeURIComponent(slug)}/sales`;

  // The next page someone is most likely to open, fetched while the browser is idle.
  useEffect(() => {
    if (!canCreate) return;
    const idle =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? window.requestIdleCallback(() => router.prefetch(`${base}/new`))
        : undefined;
    return () => {
      if (idle !== undefined) window.cancelIdleCallback(idle);
    };
  }, [base, canCreate, router]);

  const items = query.data?.items ?? [];
  const showAmount = items.some((o) => 'totalAmount' in o);
  const filtered = Boolean(filters.status || filters.customerId || filters.from || filters.to);

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
          <div>
            {label(`${id}-status`, ts('deliveryStatus.label'))}
            <select
              id={`${id}-status`}
              value={filters.status ?? ''}
              onChange={(e) => setFilters({ status: e.target.value || undefined })}
              className={inputClass}
            >
              <option value="">{ts('deliveryStatus.all')}</option>
              {ORDER_STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === 'void' ? ts('status.void') : ts(`deliveryStatus.${s}`)}
                </option>
              ))}
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
          icon={Receipt}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          onClear={() =>
            setFilters({
              status: undefined,
              customerId: undefined,
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
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {tc('totalQuantity')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('remainingQuantity')}
                      </th>
                      {showAmount ? (
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          {tc('totalAmount')}
                        </th>
                      ) : null}
                      <th scope="col" className="px-4 py-3 font-medium">
                        {ts('deliveryStatus.label')}
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
                    {items.map((o) => (
                      <OrderRow
                        key={o.id}
                        order={o}
                        href={`${base}/${o.id}`}
                        showAmount={showAmount}
                        date={day(o.orderDate)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((o) => (
                  <li key={o.id} className="rounded-card border border-border bg-surface p-4">
                    <Link
                      href={`${base}/${o.id}`}
                      prefetch={false}
                      onMouseEnter={() => router.prefetch(`${base}/${o.id}`)}
                      className="block hover:underline"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-mono font-medium">{o.code}</span>
                        <StatusText status={o.status} />
                      </span>
                      <span className="mt-1 block text-xs text-fg-muted">
                        {day(o.orderDate)} · {nameOf(o.customer)}
                      </span>
                    </Link>
                    <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
                      <span>
                        <span className="text-fg-muted">{tc('totalQuantity')}: </span>
                        <span className="tabular-nums">{format.quantity(o.totalQuantity)}</span>
                      </span>
                      <span>
                        <span className="text-fg-muted">{t('remainingQuantity')}: </span>
                        <span className="tabular-nums">{format.quantity(o.remainingQuantity)}</span>
                      </span>
                      {o.totalAmount !== undefined ? (
                        <span>
                          <span className="text-fg-muted">{tc('totalAmount')}: </span>
                          <Money value={o.totalAmount} />
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <DeliveryProgress status={o.deliveryStatus} />
                      <DetailsLink href={`${base}/${o.id}`} name={o.code} />
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

function OrderRow({
  order: o,
  href,
  showAmount,
  date,
}: {
  order: OrderSummary;
  href: string;
  showAmount: boolean;
  date: string;
}) {
  const format = useFormat();
  const nameOf = useNameOf();
  const router = useRouter();
  // Hover or focus on the row starts the detail page before the click.
  const prefetch = () => router.prefetch(href);
  return (
    <tr
      className="border-b border-border last:border-0 hover:bg-surface-muted"
      onMouseEnter={prefetch}
      onFocus={prefetch}
    >
      <th scope="row" className="px-4 py-3 font-mono font-medium whitespace-nowrap">
        <Link href={href} prefetch={false} className="hover:underline">
          {o.code}
        </Link>
      </th>
      <td className="px-4 py-3 whitespace-nowrap">{date}</td>
      <td className="px-4 py-3">{nameOf(o.customer)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{format.quantity(o.totalQuantity)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{format.quantity(o.remainingQuantity)}</td>
      {showAmount ? (
        <td className="px-4 py-3 text-right">
          {o.totalAmount !== undefined ? <Money value={o.totalAmount} /> : null}
        </td>
      ) : null}
      <td className="px-4 py-3">
        <DeliveryProgress status={o.deliveryStatus} />
      </td>
      <td className="px-4 py-3">
        <StatusText status={o.status} />
      </td>
      <td className="px-4 py-2 text-right">
        <DetailsLink href={href} name={o.code} />
      </td>
    </tr>
  );
}
