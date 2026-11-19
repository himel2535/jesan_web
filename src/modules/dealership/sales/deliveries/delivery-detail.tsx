'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFormat } from '@/core/i18n/use-format';
import { PageHeader } from '@/core/ui/page-header';
import { DetailList, type DetailRow } from '../../master-data/shared/detail-list';
import { Money, useNameOf } from '../../master-data/shared/display';
import { LoadError, Notice } from '../../master-data/shared/states';
import { useDelivery } from '../api';
import { DetailSkeleton } from '../skeletons';
import { ProductName, StatusText, useBusinessDay, useUnitInfo } from '../shared';
import { DeliveryActions } from './delivery-actions';

/** One delivery with its lines; prices only when the API sends them. */
export function DeliveryDetail({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership.sales.deliveries');
  const tc = useTranslations('dealership.sales.common');
  const ts = useTranslations('dealership.sales');
  const format = useFormat();
  const nameOf = useNameOf();
  const day = useBusinessDay();
  const units = useUnitInfo(slug, businessId);
  const saved = useSearchParams().get('saved');
  const query = useDelivery(slug, businessId, id);
  const [notice, setNotice] = useState<string | null>(
    saved === 'created' ? t('form.created') : null,
  );
  const base = `/b/${encodeURIComponent(slug)}`;

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const d = query.data;
  const showPrices = d.items.some((i) => 'unitPrice' in i);
  const when = (iso: string) => format.date(iso, { dateStyle: 'medium', timeStyle: 'short' });

  const rows: DetailRow[] = [
    { label: tc('code'), value: <span className="font-mono">{d.code}</span> },
    { label: t('deliveryDate'), value: day(d.deliveryDate) },
    {
      label: tc('order'),
      value: (
        <Link href={`${base}/sales/${d.order.id}`} prefetch={false} className="font-mono underline">
          {d.order.code}
        </Link>
      ),
    },
    {
      label: tc('customer'),
      value: (
        <Link href={`${base}/customers/${d.customer.id}`} prefetch={false} className="underline">
          {nameOf(d.customer)}
        </Link>
      ),
    },
    { label: ts('status.label'), value: <StatusText status={d.status} /> },
    {
      label: tc('totalQuantity'),
      value: <span className="tabular-nums">{format.quantity(d.totalQuantity)}</span>,
    },
    ...(d.totalAmount !== undefined
      ? [{ label: tc('totalAmount'), value: <Money value={d.totalAmount} /> }]
      : []),
    { label: t('transportReference'), value: d.transportReference ?? '—' },
    { label: tc('note'), value: d.note ?? '—' },
    { label: tc('createdBy'), value: d.createdBy.name },
    { label: tc('createdAt'), value: when(d.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title={t('detail.title', { code: d.code })}
        description={nameOf(d.customer)}
        actions={
          <DeliveryActions slug={slug} businessId={businessId} delivery={d} onDone={setNotice} />
        }
      />
      <div className="space-y-5">
        <Notice>{notice}</Notice>
        {/* Only sent with customer.due.view; in warn mode the delivery still happened. */}
        {d.creditLimitExceeded ? (
          <p role="note" className="rounded-lg border border-warning px-3 py-2 text-sm">
            {t('creditWarning')}
          </p>
        ) : null}
        {d.status === 'void' ? (
          <div className="space-y-1 rounded-card border border-danger p-4 text-sm" role="note">
            <p className="font-semibold text-danger">{tc('voidedTitle')}</p>
            {d.voidedBy && d.voidedAt ? (
              <p>{tc('voidedBy', { name: d.voidedBy.name, date: when(d.voidedAt) })}</p>
            ) : null}
            {d.voidReason ? (
              <p>
                <span className="text-fg-muted">{tc('voidReason')}: </span>
                {d.voidReason}
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
                {d.items.map((item) => (
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

        <Link
          href={`${base}/deliveries`}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {t('detail.back')}
        </Link>
      </div>
    </>
  );
}
