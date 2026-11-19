'use client';

import { Truck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { PageHeader } from '@/core/ui/page-header';
import { DetailList, type DetailRow } from '../../master-data/shared/detail-list';
import { Money, useNameOf } from '../../master-data/shared/display';
import { LoadError, Notice } from '../../master-data/shared/states';
import { useCollections, useOrder } from '../api';
import { DetailSkeleton } from '../skeletons';
import {
  DeliveryProgress,
  ProductName,
  StatusText,
  useBusinessDay,
  useMethodLabel,
  useUnitInfo,
} from '../shared';
import { OrderActions } from './order-actions';
import type { Order } from '../types';

const buttonLink =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90';

/**
 * One order: its lines, how much of it has been delivered, the collections against it, and the
 * actions the user may take. Prices and totals appear only when the API sends them.
 */
export function OrderDetail({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership.sales.orders');
  const tc = useTranslations('dealership.sales.common');
  const ts = useTranslations('dealership.sales');
  const td = useTranslations('dealership.common');
  const format = useFormat();
  const nameOf = useNameOf();
  const day = useBusinessDay();
  const units = useUnitInfo(slug, businessId);
  const methodLabel = useMethodLabel();
  const params = useSearchParams();
  const saved = params.get('saved');
  const failedAdvance = params.get('reason');
  const canSeeDeliveries = useCan('delivery.view');
  const canDeliver = useCan('delivery.create');
  const canSeeCollections = useCan('collection.view');
  const query = useOrder(slug, businessId, id);
  const collections = useCollections(slug, businessId, { orderId: id, page: 1 }, canSeeCollections);
  const [notice, setNotice] = useState<string | null>(
    saved === 'created' ? t('form.created') : null,
  );
  const base = `/b/${encodeURIComponent(slug)}`;

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const o: Order = query.data;
  const showPrices = o.items.some((i) => 'unitPrice' in i);
  const when = (iso: string) => format.date(iso, { dateStyle: 'medium', timeStyle: 'short' });

  const rows: DetailRow[] = [
    { label: tc('code'), value: <span className="font-mono">{o.code}</span> },
    { label: t('orderDate'), value: day(o.orderDate) },
    {
      label: tc('customer'),
      value: (
        <Link href={`${base}/customers/${o.customer.id}`} prefetch={false} className="underline">
          {nameOf(o.customer)}
        </Link>
      ),
    },
    { label: ts('window.label'), value: ts(`window.${o.deliveryWindow}`) },
    { label: t('deliverBy'), value: o.deliverBy ? day(o.deliverBy) : '—' },
    { label: ts('deliveryStatus.label'), value: <DeliveryProgress status={o.deliveryStatus} /> },
    { label: ts('status.label'), value: <StatusText status={o.status} /> },
    {
      label: tc('totalQuantity'),
      value: <span className="tabular-nums">{format.quantity(o.totalQuantity)}</span>,
    },
    {
      label: t('remainingQuantity'),
      value: <span className="tabular-nums">{format.quantity(o.remainingQuantity)}</span>,
    },
    ...(o.totalAmount !== undefined
      ? [{ label: tc('totalAmount'), value: <Money value={o.totalAmount} /> }]
      : []),
    { label: tc('note'), value: o.note ?? '—' },
    { label: tc('createdBy'), value: o.createdBy.name },
    { label: tc('createdAt'), value: when(o.createdAt) },
  ];

  const deliverable = o.status === 'active' && o.remainingQuantity !== '0';

  return (
    <>
      <PageHeader
        title={t('detail.title', { code: o.code })}
        description={nameOf(o.customer)}
        actions={
          <>
            {canDeliver && deliverable ? (
              <Link
                href={`${base}/deliveries/new?orderId=${encodeURIComponent(o.id)}`}
                prefetch={false}
                className={buttonLink}
              >
                <Truck aria-hidden className="size-4" />
                {t('detail.deliver')}
              </Link>
            ) : null}
            <OrderActions slug={slug} businessId={businessId} order={o} onDone={setNotice} />
          </>
        }
      />
      <div className="space-y-5">
        <Notice>{notice}</Notice>
        {saved === 'created-no-advance' && failedAdvance ? (
          <div
            role="alert"
            className="space-y-2 rounded-lg border border-warning px-3 py-2 text-sm"
          >
            <p>{t('form.createdNoAdvance', { reason: failedAdvance })}</p>
            <Link
              href={`${base}/collections/new?customerId=${encodeURIComponent(
                o.customer.id,
              )}&orderId=${encodeURIComponent(o.id)}`}
              prefetch={false}
              className="font-medium underline"
            >
              {t('form.takeCollection')}
            </Link>
          </div>
        ) : null}
        {o.status === 'void' ? (
          <div className="space-y-1 rounded-card border border-danger p-4 text-sm" role="note">
            <p className="font-semibold text-danger">{tc('voidedTitle')}</p>
            {o.voidedBy && o.voidedAt ? (
              <p>{tc('voidedBy', { name: o.voidedBy.name, date: when(o.voidedAt) })}</p>
            ) : null}
            {o.voidReason ? (
              <p>
                <span className="text-fg-muted">{tc('voidReason')}: </span>
                {o.voidReason}
              </p>
            ) : null}
          </div>
        ) : null}
        <DetailList rows={rows} />

        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('detail.items')}</h2>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-fg-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {tc('product')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {tc('quantity')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t('deliveredQuantity')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t('remainingQuantity')}
                  </th>
                  {showPrices ? (
                    <>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {tc('unitPrice')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {tc('lineTotal')}
                      </th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {o.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium">
                      <ProductName product={item.product} name={nameOf(item.product)} />{' '}
                      <span className="text-xs text-fg-muted">
                        ({units.nameOf(item.product.unitKey)})
                      </span>
                    </th>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {format.quantity(item.quantity)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {format.quantity(item.deliveredQuantity)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {format.quantity(item.remainingQuantity)}
                    </td>
                    {showPrices ? (
                      <>
                        <td className="px-4 py-3 text-right">
                          {item.unitPrice !== undefined ? <Money value={item.unitPrice} /> : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.lineTotal !== undefined ? <Money value={item.lineTotal} /> : null}
                        </td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('detail.deliveries')}</h2>
          {o.deliveries.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('detail.noDeliveries')}</p>
          ) : (
            <ul className="space-y-2">
              {o.deliveries.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3 text-sm"
                >
                  <span className="font-mono font-medium">
                    {canSeeDeliveries ? (
                      <Link
                        href={`${base}/deliveries/${d.id}`}
                        prefetch={false}
                        className="underline"
                      >
                        {d.code}
                      </Link>
                    ) : (
                      d.code
                    )}
                  </span>
                  <span>{day(d.deliveryDate)}</span>
                  <span className="tabular-nums">{format.quantity(d.totalQuantity)}</span>
                  {d.totalAmount !== undefined ? <Money value={d.totalAmount} /> : null}
                  <StatusText status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {canSeeCollections ? (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t('detail.collections')}</h2>
            {collections.data && collections.data.items.length > 0 ? (
              <ul className="space-y-2">
                {collections.data.items.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3 text-sm"
                  >
                    <span className="font-mono font-medium">
                      <Link
                        href={`${base}/collections/${c.id}`}
                        prefetch={false}
                        className="underline"
                      >
                        {c.code}
                      </Link>
                    </span>
                    <span>{day(c.collectionDate)}</span>
                    <span>{methodLabel(c.method)}</span>
                    <Money value={c.amount} />
                    <StatusText status={c.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">{t('detail.noCollections')}</p>
            )}
          </section>
        ) : null}

        <Link
          href={`${base}/sales`}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {t('detail.back')}
        </Link>
        <span className="sr-only">{td('details')}</span>
      </div>
    </>
  );
}
