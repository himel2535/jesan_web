'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, CalendarDays, ShoppingCart, Sun, Truck, Wallet, type LucideIcon } from 'lucide-react';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { collectionsReportQuery, salesReportQuery } from '../reports/api';
import { purchaseTotalsQuery } from '../purchases/api';
import { useDefaultUnit } from '../commission/shared';
import {
  changePercent,
  dayPeriods,
  monthYearPeriods,
  type DayRange,
  type DaySelection,
} from './periods';
import { KpiTile, type Growth, type TileHue } from './kpi-tile';
import { PeriodPills } from './period-pills';
import { MonthFilter, useMonthFilter } from './month-filter';
import { PillSelect } from './pill-select';

export type Metric = 'collection' | 'sales' | 'salesQuantity' | 'purchaseQuantity';

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

const TITLE = {
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

const METRICS: readonly Metric[] = ['collection', 'sales', 'salesQuantity', 'purchaseQuantity'];

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** One metric over one window; the disabled windows never fetch. */
function useMetric(metric: Metric, slug: string, businessId: string, range: DayRange | null) {
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

function MetricCard({
  metric,
  scope,
  slug,
  businessId,
  today,
  unitName,
}: {
  metric: Metric;
  scope: 'month' | 'day';
  slug: string;
  businessId: string;
  today: string;
  unitName: string;
}) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const month = useMonthFilter(today);
  const [day, setDay] = useState<DaySelection>('today');
  // The day dropdown keeps showing the last chosen day while "All Time" is on.
  const [lastDay, setLastDay] = useState<'today' | 'yesterday'>('today');

  const periods =
    scope === 'month' ? monthYearPeriods(today, month.selection) : dayPeriods(today, day);
  const current = useMetric(metric, slug, businessId, periods.current);
  const previous = useMetric(metric, slug, businessId, periods.previous);

  if (isForbidden(current.error)) return null;

  const title = t(TITLE[scope][metric]);
  const isQuantity = metric === 'salesQuantity' || metric === 'purchaseQuantity';
  const value =
    current.value === undefined ? null : isQuantity ? (
      <>
        {format.quantity(current.value)}{' '}
        <span className="text-sm font-semibold text-[var(--dash-fg-muted)]">{unitName}</span>
      </>
    ) : (
      format.moneyRounded(current.value)
    );

  const growth: Growth | null =
    periods.previous === null
      ? null
      : {
          percent:
            previous.value !== undefined && current.value !== undefined
              ? changePercent(Number(current.value), Number(previous.value))
              : null,
          label: scope === 'month' ? t('compare.vsLastMonth') : t('compare.vsYesterday'),
        };

  const params = new URLSearchParams({ from: periods.current.from, to: periods.current.to });
  const href = `/b/${encodeURIComponent(slug)}/${METRIC_PARENT[metric]}?${params.toString()}`;
  const Icon = METRIC_ICON[metric];
  const hue = METRIC_HUE[metric];

  return (
    <KpiTile
      hue={hue}
      icon={<Icon aria-hidden className="size-4" />}
      title={title}
      linkLabel={t('openLabel', { title })}
      href={href}
      value={value}
      growth={growth}
      loading={current.loading}
      errorText={current.error && !isForbidden(current.error) ? t('loadError') : undefined}
      pills={
        scope === 'month' ? (
          <MonthFilter title={title} filter={month} hue={hue} />
        ) : (
          <div className="flex flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
            <PillSelect
              label={t('periodFor', { title })}
              value={lastDay}
              options={[
                { value: 'today' as const, label: t('period.today') },
                { value: 'yesterday' as const, label: t('period.yesterday') },
              ]}
              onChange={(value) => {
                setLastDay(value);
                setDay(value);
              }}
            />
            <PeriodPills
              label={t('periodFor', { title })}
              value={day === 'lifetime' ? 'lifetime' : ''}
              hue={hue}
              options={[{ value: 'lifetime', label: t('period.allTime') }]}
              onChange={() => {
                setDay(day === 'lifetime' ? lastDay : 'lifetime');
              }}
            />
          </div>
        )
      }
    />
  );
}

function Row({
  scope,
  heading,
  icon: Icon,
  slug,
  businessId,
  today,
  unitName,
}: {
  scope: 'month' | 'day';
  heading: string;
  icon: LucideIcon;
  slug: string;
  businessId: string;
  today: string;
  unitName: string;
}) {
  const id = `dash-${scope}-heading`;
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1">
      <h2 id={id} className="flex items-center gap-1.5 text-sm font-bold text-[var(--dash-fg)]">
        <Icon aria-hidden className="size-4 text-[var(--dash-primary)]" />
        {heading}
      </h2>
      <div className="grid min-w-0 grid-cols-2 gap-[5px] xl:grid-cols-4">
        {METRICS.map((metric) => (
          <MetricCard
            key={metric}
            metric={metric}
            scope={scope}
            slug={slug}
            businessId={businessId}
            today={today}
            unitName={unitName}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * The reference's two KPI rows, "This Month" and "Today", inside one white
 * panel. Each card carries its own period pills; there is no section-wide
 * control, which is what crowded the figures before.
 */
export function KpiSections({
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

  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-2 shadow-[var(--dash-shadow)]">
      <Row
        scope="month"
        heading={t('monthly.title')}
        icon={CalendarDays}
        slug={slug}
        businessId={businessId}
        today={today}
        unitName={unit.name}
      />
      <Row
        scope="day"
        heading={t('daily.title')}
        icon={Sun}
        slug={slug}
        businessId={businessId}
        today={today}
        unitName={unit.name}
      />
    </div>
  );
}
