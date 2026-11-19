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
import { useCollection } from '../api';
import { DetailSkeleton } from '../skeletons';
import { StatusText, useBusinessDay, useMethodLabel } from '../shared';
import { CollectionActions } from './collection-actions';

/** One collection, with the actions the user may take on it. */
export function CollectionDetail({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership.sales.collections');
  const tc = useTranslations('dealership.sales.common');
  const ts = useTranslations('dealership.sales');
  const format = useFormat();
  const nameOf = useNameOf();
  const day = useBusinessDay();
  const methodLabel = useMethodLabel();
  const saved = useSearchParams().get('saved');
  const query = useCollection(slug, businessId, id);
  const [notice, setNotice] = useState<string | null>(
    saved === 'created' ? t('form.created') : null,
  );
  const base = `/b/${encodeURIComponent(slug)}`;

  if (query.isPending) return <DetailSkeleton lines={1} />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const c = query.data;
  const when = (iso: string) => format.date(iso, { dateStyle: 'medium', timeStyle: 'short' });

  const rows: DetailRow[] = [
    { label: tc('code'), value: <span className="font-mono">{c.code}</span> },
    { label: t('collectionDate'), value: day(c.collectionDate) },
    {
      label: tc('customer'),
      value: (
        <Link href={`${base}/customers/${c.customer.id}`} prefetch={false} className="underline">
          {nameOf(c.customer)}
        </Link>
      ),
    },
    { label: t('method'), value: methodLabel(c.method) },
    { label: tc('amount'), value: <Money value={c.amount} /> },
    {
      label: tc('order'),
      value: c.order ? (
        <Link href={`${base}/sales/${c.order.id}`} prefetch={false} className="font-mono underline">
          {c.order.code}
        </Link>
      ) : (
        t('againstOrderNone')
      ),
    },
    { label: t('reference'), value: c.reference ?? '—' },
    { label: ts('status.label'), value: <StatusText status={c.status} /> },
    { label: tc('note'), value: c.note ?? '—' },
    { label: tc('createdBy'), value: c.createdBy.name },
    { label: tc('createdAt'), value: when(c.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title={t('detail.title', { code: c.code })}
        description={nameOf(c.customer)}
        actions={
          <CollectionActions
            slug={slug}
            businessId={businessId}
            collection={c}
            onDone={setNotice}
          />
        }
      />
      <div className="space-y-5">
        <Notice>{notice}</Notice>
        {c.status === 'void' ? (
          <div className="space-y-1 rounded-card border border-danger p-4 text-sm" role="note">
            <p className="font-semibold text-danger">{tc('voidedTitle')}</p>
            {c.voidedBy && c.voidedAt ? (
              <p>{tc('voidedBy', { name: c.voidedBy.name, date: when(c.voidedAt) })}</p>
            ) : null}
            {c.voidReason ? (
              <p>
                <span className="text-fg-muted">{tc('voidReason')}: </span>
                {c.voidReason}
              </p>
            ) : null}
          </div>
        ) : null}
        <DetailList rows={rows} />
        <Link
          href={`${base}/collections`}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {t('detail.back')}
        </Link>
      </div>
    </>
  );
}
