'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Coins, Info, PiggyBank } from 'lucide-react';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { useDashboardCommissionSeries } from './api';
import { monthKeyOf } from './periods';

function Row({
  icon,
  tone,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  tone: 'green' | 'blue' | 'red';
  label: string;
  value: string | undefined;
  note?: string;
}) {
  const box = {
    green: 'bg-[var(--dash-green-icon-bg)] text-[var(--dash-green-accent)]',
    blue: 'bg-[var(--dash-blue-icon-bg)] text-[var(--dash-blue-accent)]',
    red: 'bg-[var(--dash-danger-soft)] text-[var(--dash-danger)]',
  }[tone];
  const surface = {
    green: 'bg-[var(--dash-green-card-bg)]',
    blue: 'bg-[var(--dash-blue-card-bg)]',
    red: 'bg-[var(--dash-danger-soft)]',
  }[tone];
  return (
    <li className={cn('flex min-w-0 items-center gap-2 rounded-lg p-2', surface)}>
      <span
        aria-hidden
        className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg', box)}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-[var(--dash-fg-muted)]">{label}</p>
        <p className="truncate text-base font-bold text-[var(--dash-fg)] tabular-nums">
          {value ?? '—'}
        </p>
        {note && <p className="truncate text-[11px] text-[var(--dash-fg-muted)]">{note}</p>}
      </div>
    </li>
  );
}

/**
 * The reference's Key Information panel: commission for the year, commission
 * for this month, and what customers owe. Commission is owner-only, so without
 * that permission only the due is shown.
 */
export function KeyInformation({
  slug,
  businessId,
  today,
  customerDue,
  canSeeCommission,
}: {
  slug: string;
  businessId: string;
  today: string;
  customerDue: string | undefined;
  canSeeCommission: boolean;
}) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const year = Number(today.slice(0, 4));
  const commission = useDashboardCommissionSeries(slug, businessId, year, canSeeCommission);
  const forbidden =
    !canSeeCommission || (commission.error instanceof ApiError && commission.error.status === 403);

  const thisMonth = commission.data?.months.find((row) => row.month === monthKeyOf(today));

  return (
    <section
      aria-labelledby="dash-key-info"
      className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 shadow-[var(--dash-shadow)] lg:h-full"
    >
      <h2
        id="dash-key-info"
        className="flex items-center gap-1.5 text-sm font-bold text-[var(--dash-fg)]"
      >
        <Info aria-hidden className="size-4 text-[var(--dash-primary)]" />
        {t('keyInfo.title')}
      </h2>
      <ul className="flex flex-col gap-[5px]">
        {!forbidden && (
          <Row
            icon={<PiggyBank aria-hidden className="size-4" />}
            tone="green"
            label={t('keyInfo.totalCommission')}
            value={commission.data ? format.moneyRounded(commission.data.yearReceived) : undefined}
            note={t('keyInfo.thisYear')}
          />
        )}
        {!forbidden && (
          <Row
            icon={<Coins aria-hidden className="size-4" />}
            tone="blue"
            label={t('keyInfo.monthlyCommission')}
            value={thisMonth ? format.moneyRounded(thisMonth.received) : undefined}
            note={t('keyInfo.thisMonth')}
          />
        )}
        <Row
          icon={<AlertCircle aria-hidden className="size-4" />}
          tone="red"
          label={t('keyInfo.totalDue')}
          value={customerDue === undefined ? undefined : format.moneyRounded(customerDue)}
        />
      </ul>
    </section>
  );
}
