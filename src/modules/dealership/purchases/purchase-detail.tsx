'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { PageHeader } from '@/core/ui/page-header';
import { DetailList, type DetailRow } from '../master-data/shared/detail-list';
import { Money, useNameOf } from '../master-data/shared/display';
import { DetailSkeleton, LoadError, Notice } from '../master-data/shared/states';
import { usePurchase } from './api';
import { PurchaseActions } from './purchase-actions';
import { PurchaseStatusBadge } from './purchases-list';
import type { Purchase } from './types';

/** `YYYY-MM-DD` (business day) → localized date, read as a Dhaka date. */
export function useBusinessDate() {
  const format = useFormat();
  return (day: string) => format.date(`${day}T00:00:00+06:00`);
}

/**
 * One purchase with its lines. Prices and totals appear only when the API sends them
 * (`product.cost.view`); without them there is no column at all.
 */
export function PurchaseDetail({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership.purchases');
  const format = useFormat();
  const nameOf = useNameOf();
  const day = useBusinessDate();
  const saved = useSearchParams().get('saved');
  const canSeeStock = useCan('stock.view');
  const query = usePurchase(slug, businessId, id);
  const [notice, setNotice] = useState<string | null>(
    saved === 'created' ? t('form.created') : null,
  );
  const base = `/b/${encodeURIComponent(slug)}`;

  if (query.isPending) return <DetailSkeleton lines={6} />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const p: Purchase = query.data;
  const showPrices = p.items.some((i) => 'unitPrice' in i);
  const when = (iso: string) => format.date(iso, { dateStyle: 'medium', timeStyle: 'short' });

  const rows: DetailRow[] = [
    { label: t('code'), value: <span className="font-mono">{p.code}</span> },
    { label: t('date'), value: day(p.purchaseDate) },
    { label: t('supplier'), value: nameOf(p.supplier) },
    { label: t('status.label'), value: <PurchaseStatusBadge status={p.status} /> },
    {
      label: t('totalQuantity'),
      value: <span className="tabular-nums">{format.quantity(p.totalQuantity)}</span>,
    },
    ...(p.totalAmount !== undefined
      ? [{ label: t('totalAmount'), value: <Money value={p.totalAmount} /> }]
      : []),
    { label: t('supplierReference'), value: p.supplierReference ?? '—' },
    { label: t('note'), value: p.note ?? '—' },
    { label: t('createdBy'), value: p.createdBy.name },
    { label: t('createdAt'), value: when(p.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title={t('detail.title', { code: p.code })}
        description={nameOf(p.supplier)}
        actions={
          <PurchaseActions slug={slug} businessId={businessId} purchase={p} onDone={setNotice} />
        }
      />
      <div className="space-y-5">
        <Notice>{notice}</Notice>
        {p.status === 'void' ? (
          <div className="space-y-1 rounded-card border border-danger p-4 text-sm" role="note">
            <p className="font-semibold text-danger">{t('detail.voidedTitle')}</p>
            {p.voidedBy && p.voidedAt ? (
              <p>{t('detail.voidedBy', { name: p.voidedBy.name, date: when(p.voidedAt) })}</p>
            ) : null}
            {p.voidReason ? (
              <p>
                <span className="text-fg-muted">{t('detail.voidReason')}: </span>
                {p.voidReason}
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
                    {t('form.product')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t('form.quantity')}
                  </th>
                  {showPrices ? (
                    <>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('form.unitPrice')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('form.lineTotal')}
                      </th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {p.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium">
                      <span className="font-mono text-xs text-fg-muted">{item.product.code}</span>{' '}
                      {canSeeStock ? (
                        <Link
                          href={`${base}/stock/${item.product.id}`}
                          prefetch={false}
                          aria-label={t('detail.stockHistory', { name: nameOf(item.product) })}
                          className="hover:underline"
                        >
                          {nameOf(item.product)}
                        </Link>
                      ) : (
                        nameOf(item.product)
                      )}
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
          href={`${base}/purchases`}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {t('detail.back')}
        </Link>
      </div>
    </>
  );
}
