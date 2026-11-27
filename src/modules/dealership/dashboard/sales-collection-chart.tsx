'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { useCan } from '@/core/auth/can';
import { PillSelect } from './pill-select';
import { useDashboardMonthlySeries } from './api';
import type { MonthlySeriesRow } from './types';
import { monthKey } from './periods';

type Range = 'last12' | 'thisYear';

interface Point {
  key: string;
  label: string;
  /** Real value, or `null` for a month that has not started yet (no bar is drawn). */
  collection: number | null;
  sales: number | null;
  purchase: number | null;
  raw: { collection: string | null; sales: string | null; purchase: string | null };
}

const SERIES = [
  {
    key: 'collection',
    label: 'chart.collection',
    className: 'fill-[var(--dash-chart-collection)]',
    dot: 'bg-[var(--dash-chart-collection)]',
  },
  {
    key: 'sales',
    label: 'chart.sales',
    className: 'fill-[var(--dash-chart-sales)]',
    dot: 'bg-[var(--dash-chart-sales)]',
  },
  {
    key: 'purchase',
    label: 'chart.purchase',
    className: 'fill-[var(--dash-chart-purchase)]',
    dot: 'bg-[var(--dash-chart-purchase)]',
  },
] as const;

/** Builds the twelve (or last-twelve) points from one or two years of monthly rows. */
function buildPoints(
  range: Range,
  today: string,
  rowsByKey: Map<string, MonthlySeriesRow>,
  monthLabel: (key: string) => string,
  hasPurchase: boolean,
): Point[] {
  const currentKey = today.slice(0, 7);
  const currentYear = Number(currentKey.slice(0, 4));
  const currentMonth = Number(currentKey.slice(5, 7));
  const keys: string[] = [];
  if (range === 'thisYear') {
    for (let m = 1; m <= 12; m += 1) keys.push(monthKey(currentYear, m));
  } else {
    for (let back = 11; back >= 0; back -= 1) {
      const index = currentYear * 12 + (currentMonth - 1) - back;
      keys.push(monthKey(Math.floor(index / 12), (index % 12) + 1));
    }
  }
  return keys.map((key) => {
    const started = key <= currentKey;
    const row = started ? rowsByKey.get(key) : undefined;
    const amount = (value: string | undefined) => (row && value !== undefined ? value : null);
    const raw = {
      collection: amount(row?.collection),
      sales: amount(row?.sales),
      purchase: hasPurchase ? amount(row?.purchaseAmount) : null,
    };
    return {
      key,
      label: monthLabel(key),
      collection: raw.collection === null ? null : Number(raw.collection),
      sales: raw.sales === null ? null : Number(raw.sales),
      purchase: raw.purchase === null ? null : Number(raw.purchase),
      raw,
    };
  });
}

/**
 * Sales & Collection Overview: twelve months of collection, sales and purchase (cost), from the
 * monthly-series endpoint. Future months are empty, never zero-filled. Purchase is drawn only
 * when the server returned it (`product.cost.view`).
 */
export function SalesCollectionChart({
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
  const [range, setRange] = useState<Range>('last12');
  const currentYear = Number(today.slice(0, 4));
  const thisYear = useDashboardMonthlySeries(slug, businessId, currentYear);
  const lastYear = useDashboardMonthlySeries(slug, businessId, currentYear - 1);
  const needsLastYear = range === 'last12';

  // Purchase is the third series for anyone who may see cost: the permission decides, so the
  // legend and bars are there from the first paint, not only once a year's data has arrived.
  const canCost = useCan('product.cost.view');
  const hasPurchase =
    canCost ||
    (thisYear.data?.months.some((row) => row.purchaseAmount !== undefined) ?? false) ||
    (lastYear.data?.months.some((row) => row.purchaseAmount !== undefined) ?? false);

  const points = useMemo(() => {
    const rows = new Map<string, MonthlySeriesRow>();
    for (const row of lastYear.data?.months ?? []) if (needsLastYear) rows.set(row.month, row);
    for (const row of thisYear.data?.months ?? []) rows.set(row.month, row);
    const monthLabel = (key: string) => format.date(`${key}-01`, { month: 'short' });
    return buildPoints(range, today, rows, monthLabel, hasPurchase);
  }, [range, today, thisYear.data, lastYear.data, needsLastYear, hasPurchase, format]);

  const loading = thisYear.isPending || (needsLastYear && lastYear.isPending);
  const failed = thisYear.isError || (needsLastYear && lastYear.isError);

  return (
    <section
      aria-labelledby="dash-sales-chart"
      className="flex min-h-0 min-w-0 flex-col gap-2 rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 shadow-[var(--dash-shadow)] lg:h-full"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 id="dash-sales-chart" className="truncate text-sm font-semibold text-[var(--dash-fg)]">
          {t('chart.salesCollectionTitle')}
        </h2>
        <PillSelect
          label={t('chart.range')}
          value={range}
          tone="panel"
          options={[
            { value: 'last12' as const, label: t('chart.last12') },
            { value: 'thisYear' as const, label: t('chart.thisYear') },
          ]}
          onChange={setRange}
        />
      </header>

      <ul className="flex flex-wrap gap-3 text-xs text-[var(--dash-fg-muted)]">
        {SERIES.filter((s) => s.key !== 'purchase' || hasPurchase).map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn('inline-block size-2.5 rounded-full', s.dot)} />
            {t(s.label)}
          </li>
        ))}
      </ul>

      <div className="h-[220px] min-w-0 lg:h-auto lg:min-h-0 lg:flex-1">
        {failed ? (
          <p className="text-sm text-[var(--dash-danger)]">{t('loadError')}</p>
        ) : loading ? (
          <div className="h-full animate-pulse rounded bg-[var(--dash-border)]" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              barGap={2}
              barCategoryGap="22%"
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--dash-border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--dash-fg-muted)' }}
                interval="preserveStartEnd"
                minTickGap={6}
              />
              <YAxis
                width={44}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--dash-fg-muted)' }}
                tickFormatter={(value: number) =>
                  format.number(value, { notation: 'compact', maximumFractionDigits: 1 })
                }
              />
              <Tooltip
                cursor={{ fill: 'var(--dash-border)', opacity: 0.4 }}
                formatter={(value, name) => {
                  const label = SERIES.find((s) => s.key === name);
                  return [
                    value === null || value === undefined ? '—' : format.money(String(value)),
                    label ? t(label.label) : String(name),
                  ];
                }}
              />
              {SERIES.filter((s) => s.key !== 'purchase' || hasPurchase).map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.key}
                  className={s.className}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
