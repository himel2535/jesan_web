'use client';

import { ClipboardList, ShoppingCart, Truck, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { SummaryTile, SummaryTileGrid } from '../dashboard/summary-tile';
import { useOrderCounts, useDeliveryCounts, useSalesSummaryAmounts } from './api';
import type { SalesSummaryRanges } from './shared';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

function TileSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SummaryTile
          key={i}
          hue="blue"
          icon={<Wallet aria-hidden className="size-3.5" />}
          label=""
          value={null}
          loading
        />
      ))}
    </>
  );
}

export function SalesSummaryCardsSkeleton() {
  return (
    <SummaryTileGrid className="sm:grid-cols-2 lg:grid-cols-3">
      <TileSkeleton count={3} />
    </SummaryTileGrid>
  );
}

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

  return (
    <SummaryTileGrid className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {salesForbidden ? null : salesPending ? (
        <TileSkeleton count={3} />
      ) : salesError ? (
        <div className="col-span-full">
          <LoadError
            error={salesError}
            onRetry={() => salesQueries.forEach((q) => void q.refetch())}
          />
        </div>
      ) : sales.total.data && sales.today.data && sales.thisMonth.data ? (
        <>
          <SummaryTile
            hue="blue"
            icon={<Wallet aria-hidden className="size-3.5" />}
            label={t('todaySales')}
            value={<Money value={sales.today.data.totalAmount} />}
          />
          <SummaryTile
            hue="green"
            icon={<Wallet aria-hidden className="size-3.5" />}
            label={t('thisMonthSales')}
            value={<Money value={sales.thisMonth.data.totalAmount} />}
          />
          <SummaryTile
            hue="purple"
            icon={<ShoppingCart aria-hidden className="size-3.5" />}
            label={t('totalSales')}
            value={<Money value={sales.total.data.totalAmount} />}
          />
        </>
      ) : null}

      {orderForbidden ? null : orderPending ? (
        <TileSkeleton count={2} />
      ) : orderError ? (
        <div className="col-span-full">
          <LoadError
            error={orderError}
            onRetry={() => orderQueries.forEach((q) => void q.refetch())}
          />
        </div>
      ) : orders.total.data && orders.thisMonth.data ? (
        <>
          <SummaryTile
            hue="orange"
            icon={<ClipboardList aria-hidden className="size-3.5" />}
            label={t('totalOrders')}
            value={format.number(orders.total.data.total)}
          />
          <SummaryTile
            hue="blue"
            icon={<ClipboardList aria-hidden className="size-3.5" />}
            label={t('thisMonthOrders')}
            value={format.number(orders.thisMonth.data.total)}
          />
        </>
      ) : null}

      {deliveryForbidden ? null : deliveryPending ? (
        <TileSkeleton count={2} />
      ) : deliveryError ? (
        <div className="col-span-full">
          <LoadError
            error={deliveryError}
            onRetry={() => deliveryQueries.forEach((q) => void q.refetch())}
          />
        </div>
      ) : deliveries.total.data && deliveries.thisMonth.data ? (
        <>
          <SummaryTile
            hue="green"
            icon={<Truck aria-hidden className="size-3.5" />}
            label={t('totalDeliveries')}
            value={format.number(deliveries.total.data.total)}
          />
          <SummaryTile
            hue="purple"
            icon={<Truck aria-hidden className="size-3.5" />}
            label={t('thisMonthDeliveries')}
            value={format.number(deliveries.thisMonth.data.total)}
          />
        </>
      ) : null}
    </SummaryTileGrid>
  );
}
