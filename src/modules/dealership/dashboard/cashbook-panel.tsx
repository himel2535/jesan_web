'use client';

import { useTranslations } from 'next-intl';
import { useFormat } from '@/core/i18n/use-format';
import { ApiError } from '@/core/api/errors';
import { useDashboardCashbook } from './api';
import type { DayRange } from './periods';

/**
 * Cash position for a window, from the ledger: what is actually held in cash and in bank, and
 * what actually came in and went out. Receivables and sales are not here: a sale is not cash.
 */
export function CashbookPanel({
  slug,
  businessId,
  range,
}: {
  slug: string;
  businessId: string;
  range: DayRange;
}) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const cashbook = useDashboardCashbook(slug, businessId, range);

  if (cashbook.error instanceof ApiError && cashbook.error.status === 403) return null;

  const body = cashbook.data;
  const rows: { label: string; value: string | undefined; strong?: boolean }[] = [
    { label: t('cashbook.cashInHand'), value: body?.cash.closing },
    { label: t('cashbook.bankBalance'), value: body?.bank.closing },
    { label: t('cashbook.totalCashBank'), value: body?.availableCashAndBank, strong: true },
    { label: t('cashbook.actualCashCollection'), value: body?.cash.collectionsIn },
    { label: t('cashbook.actualBankCollection'), value: body?.bank.collectionsIn },
    { label: t('cashbook.totalCashPayments'), value: body?.cash.out },
    { label: t('cashbook.totalBankPayments'), value: body?.bank.out },
  ];

  return (
    <section
      aria-labelledby="dash-cashbook"
      className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 shadow-[var(--dash-shadow)] lg:h-full"
    >
      <h2 id="dash-cashbook" className="text-sm font-semibold text-[var(--dash-fg)]">
        {t('cashbook.title')}
      </h2>
      {cashbook.isError ? (
        <p className="text-sm text-[var(--dash-danger)]">{t('loadError')}</p>
      ) : cashbook.isPending ? (
        <div className="h-24 animate-pulse rounded bg-[var(--dash-border)]" />
      ) : (
        <dl className="flex flex-col gap-1">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex min-w-0 items-baseline justify-between gap-2 text-sm"
            >
              <dt
                className={
                  row.strong
                    ? 'truncate font-semibold text-[var(--dash-fg)]'
                    : 'truncate text-[var(--dash-fg-muted)]'
                }
              >
                {row.label}
              </dt>
              <dd
                className={
                  row.strong
                    ? 'shrink-0 font-bold text-[var(--dash-fg)] tabular-nums'
                    : 'shrink-0 text-[var(--dash-fg)] tabular-nums'
                }
              >
                {row.value === undefined ? '—' : format.money(row.value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {body && body.unassigned.in !== '0.00' && (
        <p className="text-xs text-[var(--dash-fg-muted)]">
          {t('cashbook.unassignedNote', { amount: format.money(body.unassigned.closing) })}
        </p>
      )}
    </section>
  );
}
