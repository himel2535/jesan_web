'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { ApiError } from '@/core/api/errors';
import { useDashboardCommissionSeries } from './api';
import { monthPeriods, type MonthSelection } from './periods';
import { ledgerAmount, usePeriodSources } from './period-sources';
import { PendingRow, SummaryRow } from './summary-rows';

const OPTIONS: MonthSelection[] = ['thisMonth', 'previousMonth', 'lifetime'];
const LABEL = {
  thisMonth: 'period.thisMonth',
  previousMonth: 'period.previousMonth',
  lifetime: 'period.lifetime',
} as const;

/**
 * Financial Summary. Profit lines (sales revenue, commission received, expenses) are one group;
 * balances (collection, cash and bank, customer due, commission receivable) are another. They are
 * never added to each other. COGS and Net Profit need the costing decision, so they show "pending"
 * rather than a number.
 */
export function FinancialSummary({
  slug,
  businessId,
  today,
}: {
  slug: string;
  businessId: string;
  today: string;
}) {
  const t = useTranslations('dealership.dashboard');
  const [selection, setSelection] = useState<MonthSelection>('thisMonth');
  const range = monthPeriods(today, selection).current;
  const sources = usePeriodSources(slug, businessId, range);
  const canCommission = useCan('commission.view');
  const commission = useDashboardCommissionSeries(
    slug,
    businessId,
    Number(today.slice(0, 4)),
    canCommission,
  );

  const commissionForbidden =
    !canCommission || (commission.error instanceof ApiError && commission.error.status === 403);
  const accounts = sources.accounts.data;
  const salesAmount = sources.sales.data?.totalAmount;
  const commissionReceived = ledgerAmount(accounts, 'commission_receipt', 'in');
  const expenses = ledgerAmount(accounts, 'expense', 'out');
  const collection = ledgerAmount(accounts, 'collection', 'in');

  return (
    <section
      aria-labelledby="dash-financial"
      className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 shadow-[var(--dash-shadow)] lg:h-full"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dash-financial" className="text-sm font-semibold text-[var(--dash-fg)]">
          {t('summary.title')}
        </h2>
        <div role="group" aria-label={t('summary.filter')} className="flex gap-1">
          {OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={selection === option}
              onClick={() => setSelection(option)}
              className={
                selection === option
                  ? 'h-10 rounded-md border border-[var(--dash-primary)] px-2 text-xs font-medium text-[var(--dash-primary)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]'
                  : 'h-10 rounded-md border border-[var(--dash-border)] px-2 text-xs font-medium text-[var(--dash-fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]'
              }
            >
              {t(LABEL[option])}
            </button>
          ))}
        </div>
      </header>

      <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
        <div className="flex min-w-0 flex-col gap-2">
          <div>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-[var(--dash-fg-muted)] uppercase">
              {t('summary.profitGroup')}
            </h3>
            <ul className="flex flex-col gap-1">
              <SummaryRow label={t('summary.salesRevenue')} value={salesAmount} sign="plus" />
              {!commissionForbidden && (
                <SummaryRow
                  label={t('summary.commissionReceived')}
                  value={commissionReceived}
                  sign="plus"
                />
              )}
              <SummaryRow label={t('summary.expenses')} value={expenses} sign="minus" />
              <PendingRow label={t('summary.cogs')} reason={t('summary.awaitingApproval')} />
              <PendingRow label={t('summary.grossProfit')} reason={t('summary.awaitingApproval')} />
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-[var(--dash-fg-muted)] uppercase">
              {t('summary.balanceGroup')}
            </h3>
            <ul className="flex flex-col gap-1">
              <SummaryRow label={t('summary.collection')} value={collection} sign="none" />
              <SummaryRow
                label={t('summary.customerDue')}
                value={accounts?.totalDue}
                sign="none"
                hint={t('summary.asOfToday')}
              />
              {!commissionForbidden && (
                <SummaryRow
                  label={t('summary.commissionReceivable')}
                  value={commission.data?.receivable}
                  sign="none"
                  hint={t('summary.asOfToday')}
                />
              )}
              <PendingRow label={t('summary.supplierPayable')} reason={t('summary.notTracked')} />
              <PendingRow label={t('summary.expensePayable')} reason={t('summary.notTracked')} />
            </ul>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3">
          <p className="text-xs font-semibold tracking-wide text-[var(--dash-fg-muted)] uppercase">
            {t('summary.netProfit')}
          </p>
          <p className="text-sm font-semibold text-[var(--dash-fg)]">
            {t('summary.netProfitPending')}
          </p>
          <p className="text-xs text-[var(--dash-fg-muted)]">{t('summary.netProfitNote')}</p>
        </div>
      </div>
    </section>
  );
}
