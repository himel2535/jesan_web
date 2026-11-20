'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFormat } from '@/core/i18n/use-format';
import { PageHeader } from '@/core/ui/page-header';
import { DetailList, type DetailRow } from '../master-data/shared/detail-list';
import { Money, useNameOf } from '../master-data/shared/display';
import { LoadError, Notice } from '../master-data/shared/states';
import { useExpense } from './api';
import { ExpenseActions } from './expense-actions';
import { DetailSkeleton } from './skeletons';
import { StatusText, useBusinessDay, useMethodLabel } from './shared';

/** One expense, with the actions the user may take on it. */
export function ExpenseDetail({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership.expenses');
  const tc = useTranslations('dealership.common');
  const tx = useTranslations('dealership.expenses.common');
  const format = useFormat();
  const nameOf = useNameOf();
  const day = useBusinessDay();
  const methodLabel = useMethodLabel();
  const saved = useSearchParams().get('saved');
  const query = useExpense(slug, businessId, id);
  const [notice, setNotice] = useState<string | null>(
    saved === 'created' ? t('form.created') : null,
  );
  const base = `/b/${encodeURIComponent(slug)}/expenses`;

  if (query.isPending) return <DetailSkeleton lines={1} />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const e = query.data;
  const when = (iso: string) => format.date(iso, { dateStyle: 'medium', timeStyle: 'short' });

  const rows: DetailRow[] = [
    { label: tc('code'), value: <span className="font-mono">{e.code}</span> },
    { label: t('expenseDate'), value: day(e.expenseDate) },
    { label: t('category'), value: nameOf(e.category) },
    { label: t('method'), value: methodLabel(e.method) },
    { label: tx('amount'), value: <Money value={e.amount} /> },
    { label: tx('note'), value: e.note ?? '—' },
    { label: t('proofNote'), value: e.proofNote ?? '—' },
    { label: t('status.label'), value: <StatusText status={e.status} /> },
    { label: tx('createdBy'), value: e.createdBy.name },
    { label: tc('createdAt'), value: when(e.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title={t('detail.title', { code: e.code })}
        description={nameOf(e.category)}
        actions={
          <ExpenseActions slug={slug} businessId={businessId} expense={e} onDone={setNotice} />
        }
      />
      <div className="space-y-5">
        <Notice>{notice}</Notice>
        {e.status === 'void' ? (
          <div className="space-y-1 rounded-card border border-danger p-4 text-sm" role="note">
            <p className="font-semibold text-danger">{tx('voidedTitle')}</p>
            {e.voidedBy && e.voidedAt ? (
              <p>{tx('voidedBy', { name: e.voidedBy.name, date: when(e.voidedAt) })}</p>
            ) : null}
            {e.voidReason ? (
              <p>
                <span className="text-fg-muted">{tx('voidReason')}: </span>
                {e.voidReason}
              </p>
            ) : null}
          </div>
        ) : null}
        <DetailList rows={rows} />
        <Link
          href={base}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {t('detail.back')}
        </Link>
      </div>
    </>
  );
}
