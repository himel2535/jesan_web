'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useCan } from '@/core/auth/can';
import { businessToday } from '@/core/i18n/format';
import { Button } from '@/core/ui/button';
import { inputClass } from '@/core/ui/text-field';
import { LoadError, Notice } from '../master-data/shared/states';
import { useAccountsSummary } from './api';
import { LedgerTable } from './ledger-table';
import { ManualEntryDialog } from './manual-entry-dialog';
import { dateParam, useSetFilters } from './shared';
import { SummaryCards, SummaryCardsSkeleton } from './summary-cards';
import { SupplierPaymentDialog } from './supplier-payment-dialog';

type DialogMode = 'manual' | 'payment' | null;

function firstOfMonth(): string {
  const today = businessToday();
  return today.slice(0, 8) + '01';
}

export function AccountsView({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.accounts.page');
  const id = useId();
  const setFilters = useSetFilters();
  const params = useSearchParams();
  const canEntry = useCan('ledger.entry.create');
  const canPayment = useCan('payment.create');

  const from = dateParam(params, 'from') ?? firstOfMonth();
  const to = dateParam(params, 'to') ?? businessToday();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const summary = useAccountsSummary(slug, businessId, { from, to });

  const label = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {text}
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            {label(`${id}-from`, t('dateFrom'))}
            <input
              id={`${id}-from`}
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFilters({ from: e.target.value || undefined })}
              className={inputClass}
            />
          </div>
          <div>
            {label(`${id}-to`, t('dateTo'))}
            <input
              id={`${id}-to`}
              type="date"
              value={to}
              min={from}
              onChange={(e) => setFilters({ to: e.target.value || undefined })}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEntry ? (
            <Button variant="secondary" onClick={() => setDialog('manual')}>
              {t('addEntry')}
            </Button>
          ) : null}
          {canPayment ? (
            <Button variant="secondary" onClick={() => setDialog('payment')}>
              {t('addPayment')}
            </Button>
          ) : null}
        </div>
      </div>

      <Notice>{notice}</Notice>

      {summary.isPending ? (
        <SummaryCardsSkeleton />
      ) : summary.isError ? (
        <LoadError error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <SummaryCards summary={summary.data} />
      )}

      <LedgerTable slug={slug} businessId={businessId} />

      {dialog === 'manual' ? (
        <ManualEntryDialog
          slug={slug}
          businessId={businessId}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            setNotice(message);
          }}
        />
      ) : null}
      {dialog === 'payment' ? (
        <SupplierPaymentDialog
          slug={slug}
          businessId={businessId}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            setNotice(message);
          }}
        />
      ) : null}
    </div>
  );
}
