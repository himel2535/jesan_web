'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/core/ui/page-header';
import { DetailList, type DetailRow } from '../master-data/shared/detail-list';
import { Money } from '../master-data/shared/display';
import { LoadError, Notice } from '../master-data/shared/states';
import { useCommissionEntry, useCommissionScheme } from './api';
import { EntryForm } from './entry-form';
import { ReceiptForm } from './receipt-form';
import { ReceiptVoucher } from './receipt-voucher';
import { useDefaultUnit } from './shared';
import { DetailSkeleton } from './skeletons';
import type { CommissionReceipt } from './types';

/** One commission entry with its receipts (`commission.view`, owner-only). */
export function EntryDetail({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership.commission.entry');
  const tr = useTranslations('dealership.commission.receipt');
  const tc = useTranslations('dealership.common');
  const format = useFormat();
  const canManage = useCan('commission.manage');
  const unit = useDefaultUnit(slug, businessId);
  const scheme = useCommissionScheme(slug, businessId);
  const query = useCommissionEntry(slug, businessId, id);
  const [editing, setEditing] = useState(false);
  const [receiptDialog, setReceiptDialog] = useState<CommissionReceipt | 'new' | null>(null);
  const [voucherReceipt, setVoucherReceipt] = useState<CommissionReceipt | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const base = `/b/${encodeURIComponent(slug)}/commission`;
  const when = (iso: string) => format.date(`${iso}T00:00:00+06:00`);

  if (query.isPending) return <DetailSkeleton lines={3} />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const entry = query.data;

  const rows: DetailRow[] = [
    {
      label: `${t('fromDate')} – ${t('toDate')}`,
      value: `${when(entry.fromDate)} – ${when(entry.toDate)}`,
    },
    { label: t('quantity', { unit: unit.name }), value: format.quantity(entry.quantity) },
    { label: t('calculatedAmount'), value: <Money value={entry.calculatedAmount} /> },
    { label: t('receivedAmount'), value: <Money value={entry.receivedAmount} /> },
    { label: t('pendingAmount'), value: <Money value={entry.pendingAmount} /> },
    { label: t('note'), value: entry.note ?? '—' },
  ];

  return (
    <>
      <PageHeader
        title={t('detailTitle', { fromDate: when(entry.fromDate), toDate: when(entry.toDate) })}
        actions={
          canManage ? (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {tc('edit')}
            </Button>
          ) : null
        }
      />
      <div className="space-y-5">
        <Notice>{notice}</Notice>
        <DetailList rows={rows} />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{tr('title')}</h2>
            {canManage ? (
              <Button onClick={() => setReceiptDialog('new')}>{tr('new')}</Button>
            ) : null}
          </div>
          {entry.receipts.length === 0 ? (
            <p className="text-sm text-fg-muted">{tr('emptyDescription')}</p>
          ) : (
            <ul className="space-y-2">
              {entry.receipts.map((receipt) => (
                <li
                  key={receipt.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      <span className="tabular-nums">{when(receipt.receivedDate)}</span>{' '}
                      <span className="tabular-nums">
                        <Money value={receipt.amount} />
                      </span>
                    </p>
                    <p className="text-sm text-fg-muted">
                      {receipt.reference ?? '—'}
                      {receipt.note ? ` · ${receipt.note}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setVoucherReceipt(receipt)}
                      aria-label={tr('print')}
                    >
                      {tr('print')}
                    </Button>
                    {canManage ? (
                      <Button variant="secondary" onClick={() => setReceiptDialog(receipt)}>
                        {tc('edit')}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          href={base}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {tc('back')}
        </Link>
      </div>

      {editing ? (
        <EntryForm
          entry={entry}
          scheme={scheme.data ?? null}
          unitName={unit.name}
          slug={slug}
          businessId={businessId}
          onClose={() => setEditing(false)}
          onSaved={(message) => (setEditing(false), setNotice(message))}
        />
      ) : null}
      {receiptDialog ? (
        <ReceiptForm
          entryId={entry.id}
          receipt={receiptDialog === 'new' ? null : receiptDialog}
          slug={slug}
          businessId={businessId}
          onClose={() => setReceiptDialog(null)}
          onSaved={(message) => (setReceiptDialog(null), setNotice(message))}
        />
      ) : null}
      {voucherReceipt ? (
        <ReceiptVoucher
          entry={entry}
          receipt={voucherReceipt}
          supplierName="Akij Cement"
          onClose={() => setVoucherReceipt(null)}
        />
      ) : null}
    </>
  );
}
