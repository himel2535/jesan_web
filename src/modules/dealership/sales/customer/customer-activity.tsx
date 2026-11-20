'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { Money } from '../../master-data/shared/display';
import { LoadError } from '../../master-data/shared/states';
import { useDeliveries, useOrders } from '../api';
import { ListSkeleton } from '../skeletons';
import { DeliveryProgress, StatusText, dateParam, useBusinessDay, useSetFilters } from '../shared';

/**
 * One customer's orders and deliveries, with one date filter over both. Orders page with
 * `?page=`; the deliveries below always show their newest ten (a second page parameter on one
 * screen would be confusing), each with its own link.
 */
export function CustomerActivity({
  slug,
  businessId,
  customerId,
}: {
  slug: string;
  businessId: string;
  customerId: string;
}) {
  const t = useTranslations('dealership.sales.ledger.activity');
  const tc = useTranslations('dealership.sales.common');
  const tf = useTranslations('dealership.sales.filters');
  const ts = useTranslations('dealership.sales');
  const to = useTranslations('dealership.sales.orders');
  const id = useId();
  const format = useFormat();
  const day = useBusinessDay();
  const params = useSearchParams();
  const setFilters = useSetFilters();
  const canSeeOrders = useCan({ anyOf: ['sale.view.all', 'sale.view.own'] });
  const canSeeDeliveries = useCan('delivery.view');
  const from = dateParam(params, 'from');
  const dateTo = dateParam(params, 'to');
  const page = parsePageParam(params.get('page'));
  const orders = useOrders(slug, businessId, { customerId, from, to: dateTo, page }, canSeeOrders);
  const deliveries = useDeliveries(
    slug,
    businessId,
    { customerId, from, to: dateTo, page: 1 },
    canSeeDeliveries,
  );
  const base = `/b/${encodeURIComponent(slug)}`;
  // One skeleton for the page, not one per section: two at once would change shape twice.
  const loading = (canSeeOrders && orders.isPending) || (canSeeDeliveries && deliveries.isPending);

  const label = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {text}
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          {label(`${id}-from`, tf('from'))}
          <input
            id={`${id}-from`}
            type="date"
            value={from ?? ''}
            max={dateTo}
            onChange={(e) => setFilters({ from: e.target.value || undefined })}
            className={inputClass}
          />
        </div>
        <div>
          {label(`${id}-to`, tf('to'))}
          <input
            id={`${id}-to`}
            type="date"
            value={dateTo ?? ''}
            min={from}
            onChange={(e) => setFilters({ to: e.target.value || undefined })}
            className={inputClass}
          />
        </div>
      </div>

      {loading ? <ListSkeleton /> : null}

      {!loading && canSeeOrders ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('orders')}</h2>
          {orders.isPending ? null : orders.isError ? (
            <LoadError error={orders.error} onRetry={() => void orders.refetch()} />
          ) : orders.data.items.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('noOrders')}</p>
          ) : (
            <>
              <ul
                className={cn('space-y-2', orders.isPlaceholderData && 'opacity-60')}
                aria-busy={orders.isFetching}
              >
                {orders.data.items.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3 text-sm"
                  >
                    <Link
                      href={`${base}/sales/${o.id}`}
                      prefetch={false}
                      className="font-mono font-medium hover:underline"
                    >
                      {o.code}
                    </Link>
                    <span>{day(o.orderDate)}</span>
                    <span className="tabular-nums">
                      {format.quantity(o.totalQuantity)}{' '}
                      <span className="text-fg-muted">
                        ({to('remainingQuantity')} {format.quantity(o.remainingQuantity)})
                      </span>
                    </span>
                    {o.totalAmount !== undefined ? <Money value={o.totalAmount} /> : null}
                    <DeliveryProgress status={o.deliveryStatus} />
                    <StatusText status={o.status} />
                  </li>
                ))}
              </ul>
              <Pagination
                totalItems={orders.data.total}
                pageSize={orders.data.pageSize || PAGE_SIZE}
              />
            </>
          )}
        </section>
      ) : null}

      {!loading && canSeeDeliveries ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('deliveries')}</h2>
          {deliveries.isPending ? null : deliveries.isError ? (
            <LoadError error={deliveries.error} onRetry={() => void deliveries.refetch()} />
          ) : deliveries.data.items.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('noDeliveries')}</p>
          ) : (
            <ul
              className={cn('space-y-2', deliveries.isPlaceholderData && 'opacity-60')}
              aria-busy={deliveries.isFetching}
            >
              {deliveries.data.items.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3 text-sm"
                >
                  <Link
                    href={`${base}/deliveries/${d.id}`}
                    prefetch={false}
                    className="font-mono font-medium hover:underline"
                  >
                    {d.code}
                  </Link>
                  <span>{day(d.deliveryDate)}</span>
                  <Link
                    href={`${base}/sales/${d.order.id}`}
                    prefetch={false}
                    className="font-mono hover:underline"
                  >
                    {d.order.code}
                  </Link>
                  <span className="tabular-nums">{format.quantity(d.totalQuantity)}</span>
                  {d.totalAmount !== undefined ? <Money value={d.totalAmount} /> : null}
                  <StatusText status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <span className="sr-only">{`${tc('customer')} ${ts('status.label')}`}</span>
    </div>
  );
}
