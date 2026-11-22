'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { businessToday } from '@/core/i18n/format';
import { inputClass } from '@/core/ui/text-field';
import { LoadError } from '../master-data/shared/states';
import { useAccountsSummary } from './api';
import { LedgerTable } from './ledger-table';
import { LIFETIME_FROM, dateParam, useSetFilters } from './shared';
import { SummaryCards, SummaryCardsSkeleton } from './summary-cards';

function firstOfMonth(): string {
  const today = businessToday();
  return today.slice(0, 8) + '01';
}

export function AccountsView({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.accounts.page');
  const id = useId();
  const setFilters = useSetFilters();
  const params = useSearchParams();

  const from = dateParam(params, 'from') ?? firstOfMonth();
  const to = dateParam(params, 'to') ?? businessToday();

  const summary = useAccountsSummary(slug, businessId, { from, to });

  const label = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {text}
    </label>
  );

  return (
    <div className="space-y-4">
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
        <button
          type="button"
          onClick={() => setFilters({ from: LIFETIME_FROM, to: businessToday() })}
          className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-muted"
        >
          {t('lifetime')}
        </button>
      </div>

      {summary.isPending ? (
        <SummaryCardsSkeleton />
      ) : summary.isError ? (
        <LoadError error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <SummaryCards summary={summary.data} />
      )}

      <LedgerTable slug={slug} businessId={businessId} />
    </div>
  );
}
