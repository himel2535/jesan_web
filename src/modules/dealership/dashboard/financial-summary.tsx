'use client';

import { useTranslations } from 'next-intl';
import { LayoutGrid, TrendingUp } from 'lucide-react';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { useDashboardFinanceSummary } from './api';
import { changePercent, monthYearPeriods } from './periods';
import { MonthFilter, useMonthFilter } from './month-filter';

const DOT: Record<string, string> = {
  sales: 'bg-[var(--dash-chart-collection)]',
  collection: 'bg-[var(--dash-chart-sales)]',
  due: 'bg-[var(--dash-orange-accent)]',
  cogs: 'bg-[var(--dash-chart-purchase)]',
  expense: 'bg-[var(--dash-danger)]',
  commission: 'bg-[var(--dash-purple-accent)]',
};

/**
 * The reference's Financial Summary: the figures that make up the month on the
 * left, the net profit beside them.
 *
 * Only four of these rows are part of the profit — sales, the cost of what was
 * sold, expenses and commission received — and they add up to the figure shown.
 * Collection and customer due are money moving and money owed; they are listed
 * because the reference lists them, but they are kept below a divider and
 * carry no sign, so they can never be mistaken for part of the sum.
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
  const format = useFormat();
  const filter = useMonthFilter(today);
  const periods = monthYearPeriods(today, filter.selection);
  const current = useDashboardFinanceSummary(slug, businessId, periods.current);
  const previous = useDashboardFinanceSummary(
    slug,
    businessId,
    periods.previous ?? periods.current,
  );

  const data = current.data;
  const hasProfit = data?.netProfit !== undefined;
  const growth =
    periods.previous === null || !hasProfit || previous.data?.netProfit === undefined
      ? null
      : changePercent(Number(data.netProfit), Number(previous.data.netProfit));
  const up = (growth ?? 0) >= 0;

  const profitRows = [
    { key: 'sales', label: t('summary.totalSales'), value: data?.sales, sign: '+' as const },
    { key: 'cogs', label: t('summary.cogs'), value: data?.cogs, sign: '−' as const },
    {
      key: 'expense',
      label: t('summary.partialExpense'),
      value: data?.expenses,
      sign: '−' as const,
    },
    {
      key: 'commission',
      label: t('summary.commission'),
      value: data?.commissionReceived,
      sign: '+' as const,
    },
  ].filter((row) => row.value !== undefined);

  const infoRows = [
    { key: 'collection', label: t('summary.collection'), value: data?.collection },
    { key: 'due', label: t('summary.due'), value: data?.customerDue },
  ];

  return (
    <section
      aria-labelledby="dash-financial"
      className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 shadow-[var(--dash-shadow)] lg:h-full"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="dash-financial"
          className="flex items-center gap-1.5 text-sm font-bold text-[var(--dash-fg)]"
        >
          <LayoutGrid aria-hidden className="size-4 text-[var(--dash-primary)]" />
          {t('summary.title')}
        </h2>
        <MonthFilter title={t('summary.title')} filter={filter} tone="panel" />
      </header>

      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,185px)]">
        <ul className="flex min-w-0 flex-col gap-1">
          {profitRows.map((row) => (
            <li key={row.key} className="flex min-w-0 items-baseline justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', DOT[row.key])} />
                <span className="truncate text-[var(--dash-fg-muted)]">{row.label}</span>
              </span>
              <span
                className={cn(
                  'shrink-0 font-semibold tabular-nums',
                  row.sign === '+' ? 'text-[var(--dash-success)]' : 'text-[var(--dash-danger)]',
                )}
              >
                {row.sign} {format.moneyRounded(row.value ?? '0')}
              </span>
            </li>
          ))}
          <li className="mt-1 border-t border-[var(--dash-border)] pt-1">
            <ul className="flex flex-col gap-1">
              {infoRows.map((row) => (
                <li
                  key={row.key}
                  className="flex min-w-0 items-baseline justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden
                      className={cn('size-2 shrink-0 rounded-full', DOT[row.key])}
                    />
                    <span className="truncate text-[var(--dash-fg-muted)]">{row.label}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-[var(--dash-fg)] tabular-nums">
                    {row.value === undefined ? '—' : format.moneyRounded(row.value)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        </ul>

        {hasProfit && (
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg bg-[var(--dash-green-card-bg)] p-3 text-center">
            <span
              aria-hidden
              className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--dash-green-icon-bg)] text-[var(--dash-green-accent)]"
            >
              <TrendingUp className="size-4" />
            </span>
            <p className="text-xs font-semibold text-[var(--dash-fg)]">{t('summary.netProfit')}</p>
            <p className="text-xl font-bold text-[var(--dash-fg)] tabular-nums">
              {format.moneyRounded(data.netProfit ?? '0')}
            </p>
            {growth !== null && (
              <p
                className={cn(
                  'text-[11px] font-semibold',
                  up ? 'text-[var(--dash-success)]' : 'text-[var(--dash-danger)]',
                )}
              >
                <span aria-hidden>{up ? '▲' : '▼'}</span> {up ? '+' : ''}
                {growth.toFixed(1)}%{' '}
                <span className="font-normal text-[var(--dash-fg-muted)]">
                  {t('compare.vsLastMonth')}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
