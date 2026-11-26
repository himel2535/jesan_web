'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, ShoppingCart, Truck, Wallet, type LucideIcon } from 'lucide-react';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { collectionsReportQuery, salesReportQuery } from '../reports/api';
import { purchaseTotalsQuery } from '../purchases/api';
import { useDefaultUnit } from '../commission/shared';
import { Money } from '../master-data/shared/display';
import {
  changePercent,
  dayPeriods,
  monthPeriods,
  type DayRange,
  type DaySelection,
  type MonthSelection,
  type PeriodPair,
} from './periods';
import { KpiTile, type Growth, type TileHue } from './kpi-tile';
import { PeriodSelect } from './period-select';

export type Metric = 'collection' | 'sales' | 'salesQuantity' | 'purchaseQuantity';

interface MetricState {
  value: string | undefined;
  error: unknown;
  loading: boolean;
}

/**
 * The value of one metric over one window. Every metric has exactly one query; the disabled
 * ones never fetch. `range === null` disables the call (used for a window with no comparison).
 */
export function useMetric(
  metric: Metric,
  slug: string,
  businessId: string,
  range: DayRange | null,
): MetricState {
  const enabled = range !== null;
  const window = range ?? { from: '', to: '' };

  const collection = useQuery({
    ...collectionsReportQuery(slug, businessId, { groupBy: 'date', ...window, page: 1 }),
    enabled: enabled && metric === 'collection',
  });
  const sales = useQuery({
    ...salesReportQuery(slug, businessId, { groupBy: 'date', ...window, page: 1 }),
    enabled: enabled && (metric === 'sales' || metric === 'salesQuantity'),
  });
  const purchases = useQuery({
    ...purchaseTotalsQuery(slug, businessId, window),
    enabled: enabled && metric === 'purchaseQuantity',
  });

  if (metric === 'collection') {
    return {
      value: collection.data?.totalAmount,
      error: collection.error,
      loading: enabled && collection.isPending,
    };
  }
  if (metric === 'sales') {
    return {
      value: sales.data?.totalAmount,
      error: sales.error,
      loading: enabled && sales.isPending,
    };
  }
  if (metric === 'salesQuantity') {
    return {
      value: sales.data?.totalQuantity,
      error: sales.error,
      loading: enabled && sales.isPending,
    };
  }
  return {
    value: purchases.data?.totalQuantity,
    error: purchases.error,
    loading: enabled && purchases.isPending,
  };
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

interface CardCommon {
  slug: string;
  businessId: string;
  today: string;
  unitName: string;
}

const METRIC_ICON: Record<Metric, LucideIcon> = {
  collection: Wallet,
  sales: ShoppingCart,
  salesQuantity: Box,
  purchaseQuantity: Truck,
};

const METRIC_HUE: Record<Metric, TileHue> = {
  collection: 'blue',
  sales: 'green',
  salesQuantity: 'purple',
  purchaseQuantity: 'orange',
};

const METRIC_PARENT: Record<Metric, string> = {
  collection: 'collections',
  sales: 'sales',
  salesQuantity: 'reports/sales',
  purchaseQuantity: 'purchases',
};

function windowHref(slug: string, metric: Metric, range: DayRange): string {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  return `/b/${encodeURIComponent(slug)}/${METRIC_PARENT[metric]}?${params.toString()}`;
}

/**
 * One KPI card: a metric, its period selection, its current and comparison values, and the
 * growth between them. Hides itself when the user lacks the permission behind the metric (the
 * API answers 403), so no empty placeholder is left behind.
 */
function MetricCard({
  metric,
  scope,
  initial,
  common,
  title,
}: {
  metric: Metric;
  scope: 'month' | 'day';
  initial: MonthSelection | DaySelection;
  common: CardCommon;
  title: string;
}) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const [selection, setSelection] = useState(initial);
  const [customDate, setCustomDate] = useState(common.today);

  const periods: PeriodPair = useMemo(
    () =>
      scope === 'month'
        ? monthPeriods(common.today, selection as MonthSelection)
        : dayPeriods(common.today, selection as DaySelection, customDate),
    [scope, common.today, selection, customDate],
  );

  const current = useMetric(metric, common.slug, common.businessId, periods.current);
  const previous = useMetric(metric, common.slug, common.businessId, periods.previous);

  if (isForbidden(current.error)) return null;

  const isQuantity = metric === 'salesQuantity' || metric === 'purchaseQuantity';
  const valueNode =
    current.value === undefined ? null : isQuantity ? (
      <>
        {format.quantity(current.value)}{' '}
        <span className="text-sm font-medium text-[var(--dash-fg-muted)]">{common.unitName}</span>
      </>
    ) : (
      <Money value={current.value} />
    );

  const percent =
    previous.value !== undefined && current.value !== undefined
      ? changePercent(Number(current.value), Number(previous.value))
      : null;
  const growth: Growth | null =
    periods.previous === null ? null : { percent, label: comparisonLabel(scope, selection, t) };

  const options: readonly { value: string; label: PeriodKey }[] =
    scope === 'month' ? MONTH_OPTIONS : DAY_OPTIONS;
  const selector = (
    <div className="flex flex-col gap-1.5">
      <PeriodSelect
        label={t('periodFor', { title })}
        value={selection}
        options={options.map((o) => ({ value: o.value, label: t(o.label) }))}
        onChange={(value) => setSelection(value as MonthSelection | DaySelection)}
      />
      {scope === 'day' && selection === 'custom' && (
        <input
          type="date"
          aria-label={t('customDate')}
          value={customDate}
          max={common.today}
          onChange={(event) => {
            if (event.target.value) setCustomDate(event.target.value);
          }}
          className="h-10 w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-surface)] px-2 text-sm text-[var(--dash-fg)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        />
      )}
    </div>
  );

  const Icon = METRIC_ICON[metric];
  return (
    <KpiTile
      hue={METRIC_HUE[metric]}
      icon={<Icon aria-hidden className="size-4" />}
      title={title}
      linkLabel={t('openLabel', { title })}
      href={windowHref(common.slug, metric, periods.current)}
      value={valueNode}
      growth={growth}
      selector={selector}
      loading={current.loading}
      errorText={current.error && !isForbidden(current.error) ? t('loadError') : undefined}
    />
  );
}

type PeriodKey =
  | 'period.thisMonth'
  | 'period.previousMonth'
  | 'period.lifetime'
  | 'period.today'
  | 'period.yesterday'
  | 'period.custom';

const MONTH_OPTIONS: readonly { value: MonthSelection; label: PeriodKey }[] = [
  { value: 'thisMonth', label: 'period.thisMonth' },
  { value: 'previousMonth', label: 'period.previousMonth' },
  { value: 'lifetime', label: 'period.lifetime' },
] as const;

const DAY_OPTIONS: readonly { value: DaySelection; label: PeriodKey }[] = [
  { value: 'today', label: 'period.today' },
  { value: 'yesterday', label: 'period.yesterday' },
  { value: 'custom', label: 'period.custom' },
  { value: 'lifetime', label: 'period.lifetime' },
];

function comparisonLabel(
  scope: 'month' | 'day',
  selection: MonthSelection | DaySelection,
  t: ReturnType<typeof useTranslations<'dealership.dashboard'>>,
): string {
  if (scope === 'month') {
    return selection === 'previousMonth'
      ? t('compare.monthBefore')
      : t('compare.sameDaysLastMonth');
  }
  if (selection === 'yesterday') return t('compare.dayBefore');
  if (selection === 'custom') return t('compare.previousDay');
  return t('compare.yesterday');
}

const MONTHLY_METRICS: Metric[] = ['collection', 'sales', 'salesQuantity', 'purchaseQuantity'];
const DAILY_METRICS: Metric[] = ['collection', 'sales', 'salesQuantity', 'purchaseQuantity'];

const TITLE_KEY = {
  month: {
    collection: 'metric.collection',
    sales: 'metric.sales',
    salesQuantity: 'metric.salesQuantity',
    purchaseQuantity: 'metric.purchaseQuantity',
  },
  day: {
    collection: 'metric.todayCollection',
    sales: 'metric.todaySales',
    salesQuantity: 'metric.todaySalesQuantity',
    purchaseQuantity: 'metric.todayPurchaseQuantity',
  },
} as const;

/** "This Month" section: four cards sharing one selection, set by the section's pills. */
export function MonthlyKpiSection({
  slug,
  businessId,
  today,
}: {
  slug: string;
  businessId: string;
  today: string;
}) {
  const t = useTranslations('dealership.dashboard');
  const unit = useDefaultUnit(slug, businessId);
  const [bulk, setBulk] = useState<MonthSelection>('thisMonth');
  const common = { slug, businessId, today, unitName: unit.name };

  return (
    <section aria-labelledby="dash-monthly-heading" className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="dash-monthly-heading" className="text-base font-semibold text-[var(--dash-fg)]">
          {t('monthly.title')}
        </h2>
        <div role="group" aria-label={t('monthly.filter')} className="flex gap-1">
          {MONTH_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={bulk === option.value}
              onClick={() => setBulk(option.value)}
              className={cn(
                'h-10 rounded-full border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--focus)]',
                bulk === option.value
                  ? 'border-[var(--dash-primary)] bg-[var(--dash-primary-fill)] text-[var(--dash-icon-fg)]'
                  : 'border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-fg-muted)]',
              )}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-[5px] xl:grid-cols-4">
        {MONTHLY_METRICS.map((metric) => (
          <MetricCard
            key={`${metric}-${bulk}`}
            metric={metric}
            scope="month"
            initial={bulk}
            common={common}
            title={t(TITLE_KEY.month[metric])}
          />
        ))}
      </div>
    </section>
  );
}

/** "Today" section: four cards, each with its own Today / Yesterday / Custom / All Time choice. */
export function DailyKpiSection({
  slug,
  businessId,
  today,
}: {
  slug: string;
  businessId: string;
  today: string;
}) {
  const t = useTranslations('dealership.dashboard');
  const unit = useDefaultUnit(slug, businessId);
  const common = { slug, businessId, today, unitName: unit.name };

  return (
    <section aria-labelledby="dash-daily-heading" className="flex min-w-0 flex-col gap-1.5">
      <h2 id="dash-daily-heading" className="text-base font-semibold text-[var(--dash-fg)]">
        {t('daily.title')}
      </h2>
      <div className="grid min-w-0 grid-cols-2 gap-[5px] xl:grid-cols-4">
        {DAILY_METRICS.map((metric) => (
          <MetricCard
            key={metric}
            metric={metric}
            scope="day"
            initial="today"
            common={common}
            title={t(TITLE_KEY.day[metric])}
          />
        ))}
      </div>
    </section>
  );
}
