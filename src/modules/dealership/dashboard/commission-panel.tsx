'use client';

import { useTranslations } from 'next-intl';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { changePercent, monthKeyOf, previousMonthKey } from './periods';
import { useDashboardCommissionSeries } from './api';
import type { CommissionSeriesResponse } from './types';
import { Info } from 'lucide-react';

/** Received commission for a `YYYY-MM` key, from whichever year's series holds it. */
function receivedFor(
  key: string,
  thisYear: CommissionSeriesResponse | undefined,
  lastYear: CommissionSeriesResponse | undefined,
): string | undefined {
  const source = Number(key.slice(0, 4)) === thisYear?.year ? thisYear : lastYear;
  return source?.months.find((row) => row.month === key)?.received;
}

/**
 * Commission Overview, owner-only. Received commission (the money Akij actually paid) is shown
 * by month, this year against last year. Calculated commission is a separate figure and never
 * mixed into received totals; receivable = calculated − received over all time.
 */
export function CommissionPanel({
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
  const year = Number(today.slice(0, 4));
  const thisYear = useDashboardCommissionSeries(slug, businessId, year);
  const lastYear = useDashboardCommissionSeries(slug, businessId, year - 1);

  const currentKey = monthKeyOf(today);
  const previousKey = previousMonthKey(currentKey);
  const currentReceived = receivedFor(currentKey, thisYear.data, lastYear.data);
  const previousReceived = receivedFor(previousKey, thisYear.data, lastYear.data);
  const growth = changePercent(
    currentReceived === undefined ? null : Number(currentReceived),
    previousReceived === undefined ? null : Number(previousReceived),
  );

  const chart = (() => {
    const byMonth = (data: CommissionSeriesResponse | undefined) =>
      new Map((data?.months ?? []).map((row) => [row.month, row.received]));
    const current = byMonth(thisYear.data);
    const previous = byMonth(lastYear.data);
    return Array.from({ length: 12 }, (_, index) => {
      const m = index + 1;
      const key = `${String(year)}-${String(m).padStart(2, '0')}`;
      const previousKeyOfMonth = `${String(year - 1)}-${String(m).padStart(2, '0')}`;
      const started = key <= currentKey;
      const label = format.date(`${key}-01`, { month: 'short' });
      return {
        label,
        current: started ? Number(current.get(key) ?? '0') : null,
        previous: Number(previous.get(previousKeyOfMonth) ?? '0'),
      };
    });
  })();

  if (thisYear.error instanceof ApiError && thisYear.error.status === 403) return null;

  const cards: {
    key: string;
    label: string;
    value: string | undefined;
    note?: string | null;
    tone?: 'success' | 'danger' | 'muted';
  }[] = [
    {
      key: 'current',
      label: t('commission.currentMonthReceived'),
      value: currentReceived,
      note:
        growth === null
          ? null
          : `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% ${t('commission.vsPreviousMonth')}`,
      tone: growth === null ? 'muted' : growth >= 0 ? 'success' : 'danger',
    },
    { key: 'previous', label: t('commission.previousMonthReceived'), value: previousReceived },
    {
      key: 'year',
      label: t('commission.yearReceived'),
      value: thisYear.data?.yearReceived,
      note: thisYear.data
        ? t('commission.yearCalculated', { amount: format.money(thisYear.data.yearCalculated) })
        : null,
    },
    {
      key: 'receivable',
      label: t('commission.receivable'),
      value: thisYear.data?.receivable,
      note: t('commission.receivableNote'),
    },
  ];

  return (
    <section
      aria-labelledby="dash-commission"
      className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 shadow-[var(--dash-shadow)] lg:h-full"
    >
      <h2 id="dash-commission" className="text-sm font-semibold text-[var(--dash-fg)]">
        {t('commission.title')}
      </h2>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="min-h-[150px] min-w-0">
          {thisYear.isPending || lastYear.isPending ? (
            <div className="h-full min-h-[150px] animate-pulse rounded bg-[var(--dash-border)]" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--dash-border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={{ fontSize: 11, fill: 'var(--dash-fg-muted)' }}
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
                  formatter={(value, name) => [
                    value === null || value === undefined ? '—' : format.money(String(value)),
                    name === 'current'
                      ? t('commission.thisYearLegend')
                      : t('commission.lastYearLegend'),
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="current"
                  name="current"
                  dot={false}
                  strokeWidth={2}
                  className="stroke-[var(--dash-chart-collection)]"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="previous"
                  name="previous"
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  className="stroke-[var(--dash-chart-purchase)]"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <ul className="grid grid-cols-2 gap-[5px]">
          {cards.map((card) => (
            <li
              key={card.key}
              className="flex min-w-0 flex-col gap-0.5 rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] p-2"
            >
              <p className="truncate text-xs font-medium text-[var(--dash-fg-muted)]">
                {card.label}
              </p>
              <p className="truncate text-base font-bold text-[var(--dash-fg)] tabular-nums">
                {card.value === undefined ? '—' : format.money(card.value)}
              </p>
              {card.note && (
                <p
                  className={
                    card.tone === 'success'
                      ? 'truncate text-xs text-[var(--dash-success)]'
                      : card.tone === 'danger'
                        ? 'truncate text-xs text-[var(--dash-danger)]'
                        : 'truncate text-xs text-[var(--dash-fg-muted)]'
                  }
                >
                  {card.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="flex items-center gap-1 text-xs text-[var(--dash-fg-muted)]">
        <Info aria-hidden className="size-3.5 shrink-0" />
        {t('commission.basisNote')}
      </p>
    </section>
  );
}
