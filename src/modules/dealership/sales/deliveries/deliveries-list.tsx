'use client';

import { Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { Money, useNameOf } from '../../master-data/shared/display';
import { DetailsLink } from '../../master-data/shared/row-actions';
import { ListEmpty, LoadError } from '../../master-data/shared/states';
import { useDeliveries } from '../api';
import { ListSkeleton } from '../skeletons';
import {
  CustomerFilterPanel,
  CustomerFilterTrigger,
  StatusText,
  dateParam,
  useBusinessDay,
  useCustomerFilterController,
  useSetFilters,
} from '../shared';
import type { DeliveryFilters } from '../types';

function useDeliveryFilters(): DeliveryFilters {
  const p = useSearchParams();
  const status = p.get('status');
  return {
    orderId: p.get('orderId') || undefined,
    customerId: p.get('customerId') || undefined,
    status: status === 'active' || status === 'void' ? status : undefined,
    from: dateParam(p, 'from'),
    to: dateParam(p, 'to'),
    page: parsePageParam(p.get('page')),
  };
}

/** Deliveries, 10 per page, newest first (`delivery.view`; a salesman never sees this page). */
export function DeliveriesList({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.sales.deliveries');
  const tc = useTranslations('dealership.sales.common');
  const tf = useTranslations('dealership.sales.filters');
  const ts = useTranslations('dealership.sales');
  const td = useTranslations('dealership.common');
  const id = useId();
  const format = useFormat();
  const nameOf = useNameOf();
  const day = useBusinessDay();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const setFilters = useSetFilters();
  const filters = useDeliveryFilters();
  const customerFilter = useCustomerFilterController();
  const query = useDeliveries(slug, businessId, filters);
  const base = `/b/${encodeURIComponent(slug)}`;

  const items = query.data?.items ?? [];
  const showAmount = items.some((d) => 'totalAmount' in d);
  const filtered = Boolean(
    filters.status || filters.customerId || filters.orderId || filters.from || filters.to,
  );

  const label = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {text}
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="pb-0.5">
          <CustomerFilterTrigger customerId={filters.customerId} controller={customerFilter} />
        </div>
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

      <CustomerFilterPanel
        slug={slug}
        businessId={businessId}
        customerId={filters.customerId}
        controller={customerFilter}
      />

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <ListEmpty
          filtered={filtered}
          icon={Truck}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          onClear={() =>
            setFilters({
              status: undefined,
              customerId: undefined,
              orderId: undefined,
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
                        {tc('order')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {tc('customer')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {tc('totalQuantity')}
                      </th>
                      {showAmount ? (
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          {tc('totalAmount')}
                        </th>
                      ) : null}
                      <th scope="col" className="px-4 py-3 font-medium">
                        {ts('status.label')}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">{td('details')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((d) => {
                      const href = `${base}/deliveries/${d.id}`;
                      const prefetch = () => router.prefetch(href);
                      return (
                        <tr
                          key={d.id}
                          className="border-b border-border last:border-0 hover:bg-surface-muted"
                          onMouseEnter={prefetch}
                          onFocus={prefetch}
                        >
                          <th
                            scope="row"
                            className="px-4 py-3 font-mono font-medium whitespace-nowrap"
                          >
                            <Link href={href} prefetch={false} className="hover:underline">
                              {d.code}
                            </Link>
                          </th>
                          <td className="px-4 py-3 whitespace-nowrap">{day(d.deliveryDate)}</td>
                          <td className="px-4 py-3 font-mono">
                            <Link
                              href={`${base}/sales/${d.order.id}`}
                              prefetch={false}
                              className="hover:underline"
                            >
                              {d.order.code}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{nameOf(d.customer)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {format.quantity(d.totalQuantity)}
                          </td>
                          {showAmount ? (
                            <td className="px-4 py-3 text-right">
                              {d.totalAmount !== undefined ? <Money value={d.totalAmount} /> : null}
                            </td>
                          ) : null}
                          <td className="px-4 py-3">
                            <StatusText status={d.status} />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <DetailsLink href={href} name={d.code} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((d) => (
                  <li key={d.id} className="rounded-card border border-border bg-surface p-4">
                    <Link
                      href={`${base}/deliveries/${d.id}`}
                      prefetch={false}
                      className="block hover:underline"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-mono font-medium">{d.code}</span>
                        <StatusText status={d.status} />
                      </span>
                      <span className="mt-1 block text-xs text-fg-muted">
                        {day(d.deliveryDate)} · {nameOf(d.customer)} · {d.order.code}
                      </span>
                    </Link>
                    <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
                      <span>
                        <span className="text-fg-muted">{tc('totalQuantity')}: </span>
                        <span className="tabular-nums">{format.quantity(d.totalQuantity)}</span>
                      </span>
                      {d.totalAmount !== undefined ? (
                        <span>
                          <span className="text-fg-muted">{tc('totalAmount')}: </span>
                          <Money value={d.totalAmount} />
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <DetailsLink href={`${base}/deliveries/${d.id}`} name={d.code} />
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
