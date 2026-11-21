'use client';

import { useTranslations } from 'next-intl';
import { Balance, Money } from '../master-data/shared/display';
import type { AccountsSummary } from './types';

export function SummaryCardsSkeleton() {
  return (
    <div className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-surface-muted" />
          <div className="h-6 w-28 animate-pulse rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

export function SummaryCards({ summary }: { summary: AccountsSummary }) {
  const t = useTranslations('dealership.accounts.summary');
  return (
    <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <dt className="text-sm text-fg-muted">{t('totalIn')}</dt>
        <dd className="font-semibold text-success">
          <Money value={summary.totalIn} />
        </dd>
      </div>
      <div>
        <dt className="text-sm text-fg-muted">{t('totalOut')}</dt>
        <dd className="font-semibold text-danger">
          <Money value={summary.totalOut} />
        </dd>
      </div>
      <div>
        <dt className="text-sm text-fg-muted">{t('net')}</dt>
        <dd className="text-lg font-bold">
          <Balance value={summary.net} />
        </dd>
      </div>
      <div>
        <dt className="text-sm text-fg-muted">{t('totalDue')}</dt>
        <dd>
          <span className="font-semibold text-warning">
            <Money value={summary.totalDue} />
          </span>
          <p className="mt-1 text-xs text-fg-muted">{t('totalDueNote')}</p>
        </dd>
      </div>
      <div>
        <dt className="text-sm text-fg-muted">{t('totalAdvance')}</dt>
        <dd>
          <span className="font-semibold text-focus">
            <Money value={summary.totalAdvance} />
          </span>
          <p className="mt-1 text-xs text-fg-muted">{t('totalAdvanceNote')}</p>
        </dd>
      </div>
    </dl>
  );
}
