'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { useDashboardCommissionSeries } from './api';
import { ApiError } from '@/core/api/errors';
import { dayPeriods, monthPeriods, type DaySelection, type MonthSelection } from './periods';
import { ledgerAmount, usePeriodSources, type PeriodSources } from './period-sources';
import { PendingRow, SummaryRow } from './summary-rows';
import { PeriodSelect } from './period-select';

const MONTH_OPTIONS = [
  { value: 'thisMonth', label: 'period.thisMonth' },
  { value: 'previousMonth', label: 'period.previousMonth' },
  { value: 'lifetime', label: 'period.lifetime' },
] as const;

const DAY_OPTIONS = [
  { value: 'today', label: 'period.today' },
  { value: 'yesterday', label: 'period.yesterday' },
  { value: 'custom', label: 'period.custom' },
] as const;

/** One summary block: the same money rows for any window, all from the period sources. */
function SummaryBlock({
  title,
  sources,
  commissionReceived,
  showCommission,
  customerDue,
  canSeePurchaseCost,
  headerControl,
}: {
  title: string;
  sources: PeriodSources;
  commissionReceived: string | undefined;
  showCommission: boolean;
  customerDue: string | undefined;
  canSeePurchaseCost: boolean;
  headerControl: ReactNode;
}) {
  const t = useTranslations('dealership.dashboard');
  const accounts = sources.accounts.data;
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] p-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--dash-fg)]">{title}</h3>
        {headerControl}
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        <SummaryRow
          label={t('summary.collection')}
          value={ledgerAmount(accounts, 'collection', 'in')}
          sign="none"
        />
        <SummaryRow
          label={t('summary.sales')}
          value={sources.sales.data?.totalAmount}
          sign="none"
        />
        {canSeePurchaseCost && (
          <SummaryRow
            label={t('summary.purchase')}
            value={sources.purchases.data?.totalAmount}
            sign="none"
          />
        )}
        <SummaryRow
          label={t('summary.expenses')}
          value={ledgerAmount(accounts, 'expense', 'out')}
          sign="none"
        />
        {showCommission && (
          <SummaryRow
            label={t('summary.commissionReceived')}
            value={commissionReceived}
            sign="none"
          />
        )}
        <SummaryRow
          label={t('summary.customerDue')}
          value={customerDue}
          sign="none"
          hint={t('summary.asOfToday')}
        />
        <PendingRow label={t('summary.netProfit')} reason={t('summary.awaitingApproval')} />
      </ul>
    </div>
  );
}

/**
 * Monthly / Daily Summary: the running month and today, side by side. Every figure is the same
 * one the KPI cards and the financial summary use for the same window.
 */
export function MonthlyDailySummary({
  slug,
  businessId,
  today,
  canSeePurchaseCost,
}: {
  slug: string;
  businessId: string;
  today: string;
  canSeePurchaseCost: boolean;
}) {
  const t = useTranslations('dealership.dashboard');
  const [monthSelection, setMonthSelection] = useState<MonthSelection>('thisMonth');
  const [daySelection, setDaySelection] = useState<DaySelection>('today');
  const [customDate, setCustomDate] = useState(today);

  const monthRange = monthPeriods(today, monthSelection).current;
  const dayRange = dayPeriods(today, daySelection, customDate).current;
  const monthSources = usePeriodSources(slug, businessId, monthRange);
  const daySources = usePeriodSources(slug, businessId, dayRange);
  const canCommission = useCan('commission.view');
  const commission = useDashboardCommissionSeries(
    slug,
    businessId,
    Number(today.slice(0, 4)),
    canCommission,
  );
  const commissionForbidden =
    !canCommission || (commission.error instanceof ApiError && commission.error.status === 403);

  /** Commission is owner-only: without its permission the row is left out, not zeroed. */
  const commissionFor = (sources: PeriodSources) =>
    commissionForbidden
      ? undefined
      : ledgerAmount(sources.accounts.data, 'commission_receipt', 'in');

  return (
    <section
      aria-labelledby="dash-monthly-daily"
      className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 shadow-[var(--dash-shadow)] lg:h-full"
    >
      <h2 id="dash-monthly-daily" className="text-sm font-semibold text-[var(--dash-fg)]">
        {t('summary.monthlyDailyTitle')}
      </h2>
      <SummaryBlock
        title={t('summary.runningMonth')}
        sources={monthSources}
        commissionReceived={commissionFor(monthSources)}
        showCommission={!commissionForbidden}
        customerDue={monthSources.accounts.data?.totalDue}
        canSeePurchaseCost={canSeePurchaseCost}
        headerControl={
          <PeriodSelect
            label={t('summary.runningMonthFilter')}
            value={monthSelection}
            options={MONTH_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
            onChange={setMonthSelection}
          />
        }
      />
      <SummaryBlock
        title={t('summary.today')}
        sources={daySources}
        commissionReceived={commissionFor(daySources)}
        showCommission={!commissionForbidden}
        customerDue={daySources.accounts.data?.totalDue}
        canSeePurchaseCost={canSeePurchaseCost}
        headerControl={
          <div className="flex flex-col gap-1">
            <PeriodSelect
              label={t('summary.todayFilter')}
              value={daySelection}
              options={DAY_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
              onChange={setDaySelection}
            />
            {daySelection === 'custom' && (
              <input
                type="date"
                aria-label={t('customDate')}
                value={customDate}
                max={today}
                onChange={(event) => {
                  if (event.target.value) setCustomDate(event.target.value);
                }}
                className="h-10 rounded-md border border-[var(--dash-border)] bg-[var(--dash-surface)] px-2 text-sm text-[var(--dash-fg)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
              />
            )}
          </div>
        }
      />
    </section>
  );
}
