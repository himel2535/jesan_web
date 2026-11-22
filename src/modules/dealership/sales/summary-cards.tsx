'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { useOrderCounts, useDeliveryCounts, useSalesSummaryAmounts } from './api';
import type { SalesSummaryRanges } from './shared';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

function CardSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-surface-muted" />
          <div className="h-6 w-24 animate-pulse rounded bg-surface-muted" />
        </div>
      ))}
    </>
  );
}

function Card({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div>
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="font-semibold">
        {value}
        {note ? <p className="mt-1 text-xs font-normal text-fg-muted">{note}</p> : null}
      </dd>
    </div>
  );
}

export function SalesSummaryCardsSkeleton() {
  return (
    <div className="space-y-4 rounded-card border border-border bg-surface p-4">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <CardSkeleton count={3} />
      </dl>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <CardSkeleton count={4} />
      </dl>
    </div>
  );
}

/**
 * Seven KPI cards, built from three independently-gated query groups (sales amounts need
 * `report.view`, delivery counts need `delivery.view`, order counts need only the page's own
 * `sale.view.all`/`sale.view.own`). Each group hides its own cards on a 403 — a user missing
 * just one extra permission still sees the others — but any other failure (network, 500, …)
 * stays visible with a retry for that group, so a genuine bug never looks like "no access".
 */
export function SalesSummaryCards({
  slug,
  businessId,
  ranges,
}: {
  slug: string;
  businessId: string;
  ranges: SalesSummaryRanges;
}) {
  const t = useTranslations('dealership.sales.summary');
  const format = useFormat();
  const sales = useSalesSummaryAmounts(slug, businessId, ranges);
  const orders = useOrderCounts(slug, businessId, ranges);
  const deliveries = useDeliveryCounts(slug, businessId, ranges);

  const salesQueries = [sales.total, sales.today, sales.thisMonth];
  const salesError = salesQueries.find((q) => q.error)?.error;
  const salesForbidden = isForbidden(salesError);
  const salesPending = salesQueries.some((q) => q.isPending);

  const orderQueries = [orders.total, orders.thisMonth];
  const orderError = orderQueries.find((q) => q.error)?.error;
  const orderForbidden = isForbidden(orderError);
  const orderPending = orderQueries.some((q) => q.isPending);

  const deliveryQueries = [deliveries.total, deliveries.thisMonth];
  const deliveryError = deliveryQueries.find((q) => q.error)?.error;
  const deliveryForbidden = isForbidden(deliveryError);
  const deliveryPending = deliveryQueries.some((q) => q.isPending);

  const nothingToShow =
    (salesForbidden || !sales.total.data) &&
    (orderForbidden || !orders.total.data) &&
    (deliveryForbidden || !deliveries.total.data);
  if (nothingToShow && !salesPending && !orderPending && !deliveryPending) {
    return null;
  }

  const showOrdersRow = !orderForbidden || !deliveryForbidden;

  return (
    <div className="space-y-4 rounded-card border border-border bg-surface p-4">
      {salesForbidden ? null : (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
          {salesPending ? (
            <CardSkeleton count={3} />
          ) : salesError ? (
            <div className="col-span-full">
              <LoadError
                error={salesError}
                onRetry={() => salesQueries.forEach((q) => void q.refetch())}
              />
            </div>
          ) : sales.total.data && sales.today.data && sales.thisMonth.data ? (
            <>
              <Card
                label={t('todaySales')}
                value={<Money value={sales.today.data.totalAmount} />}
              />
              <Card
                label={t('thisMonthSales')}
                value={<Money value={sales.thisMonth.data.totalAmount} />}
              />
              <Card
                label={t('totalSales')}
                value={<Money value={sales.total.data.totalAmount} />}
              />
            </>
          ) : null}
        </dl>
      )}

      {showOrdersRow ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {orderForbidden ? null : orderPending ? (
            <CardSkeleton count={2} />
          ) : orderError ? (
            <div className="col-span-full">
              <LoadError
                error={orderError}
                onRetry={() => orderQueries.forEach((q) => void q.refetch())}
              />
            </div>
          ) : orders.total.data && orders.thisMonth.data ? (
            <>
              <Card label={t('totalOrders')} value={format.number(orders.total.data.total)} />
              <Card
                label={t('thisMonthOrders')}
                value={format.number(orders.thisMonth.data.total)}
              />
            </>
          ) : null}

          {deliveryForbidden ? null : deliveryPending ? (
            <CardSkeleton count={2} />
          ) : deliveryError ? (
            <div className="col-span-full">
              <LoadError
                error={deliveryError}
                onRetry={() => deliveryQueries.forEach((q) => void q.refetch())}
              />
            </div>
          ) : deliveries.total.data && deliveries.thisMonth.data ? (
            <>
              <Card
                label={t('totalDeliveries')}
                value={format.number(deliveries.total.data.total)}
              />
              <Card
                label={t('thisMonthDeliveries')}
                value={format.number(deliveries.thisMonth.data.total)}
              />
            </>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
