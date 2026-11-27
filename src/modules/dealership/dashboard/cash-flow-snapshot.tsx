'use client';

import { useTranslations } from 'next-intl';
import { Banknote, Info, Landmark, Users } from 'lucide-react';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { useDashboardCashbook } from './api';
import type { DayRange } from './periods';

/**
 * The reference's Cash Flow Snapshot: what is actually in hand, and what is
 * still owed. Cash and a receivable are deliberately the only two figures —
 * money held is not revenue, and money owed is not cash.
 */
export function CashFlowSnapshot({
  slug,
  businessId,
  range,
  customerDue,
}: {
  slug: string;
  businessId: string;
  range: DayRange;
  customerDue: string | undefined;
}) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const cashbook = useDashboardCashbook(slug, businessId, range);
  const forbidden = cashbook.error instanceof ApiError && cashbook.error.status === 403;

  const rows = [
    {
      key: 'cash',
      icon: <Banknote aria-hidden className="size-4" />,
      tone: 'bg-[var(--dash-green-card-bg)]',
      badge: 'bg-[var(--dash-green-icon-bg)] text-[var(--dash-green-accent)]',
      label: t('cashFlow.cashInHand'),
      value: forbidden ? undefined : cashbook.data?.availableCashAndBank,
    },
    {
      key: 'due',
      icon: <Users aria-hidden className="size-4" />,
      tone: 'bg-[var(--dash-blue-card-bg)]',
      badge: 'bg-[var(--dash-blue-icon-bg)] text-[var(--dash-blue-accent)]',
      label: t('cashFlow.customerDue'),
      value: customerDue,
    },
  ];

  return (
    <section
      aria-labelledby="dash-cash-flow"
      className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 shadow-[var(--dash-shadow)] lg:h-full"
    >
      <h2
        id="dash-cash-flow"
        className="flex items-center gap-1.5 text-sm font-bold text-[var(--dash-fg)]"
      >
        <Landmark aria-hidden className="size-4 text-[var(--dash-primary)]" />
        {t('cashFlow.title')}
      </h2>
      <ul className="flex flex-col gap-[5px]">
        {rows
          .filter((row) => row.key !== 'cash' || !forbidden)
          .map((row) => (
            <li
              key={row.key}
              className={cn('flex min-w-0 items-center gap-2 rounded-lg p-2', row.tone)}
            >
              <span
                aria-hidden
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
                  row.badge,
                )}
              >
                {row.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs text-[var(--dash-fg-muted)]">{row.label}</p>
                <p className="truncate text-base font-bold text-[var(--dash-fg)] tabular-nums">
                  {row.value === undefined ? '—' : format.moneyRounded(row.value)}
                </p>
              </div>
            </li>
          ))}
      </ul>
      <p className="mt-auto flex items-start gap-1.5 rounded-lg bg-[var(--dash-blue-card-bg)] p-2 text-[11px] text-[var(--dash-fg-muted)]">
        <Info aria-hidden className="mt-px size-3.5 shrink-0 text-[var(--dash-primary)]" />
        {t('cashFlow.netProfitNote')}
      </p>
    </section>
  );
}
