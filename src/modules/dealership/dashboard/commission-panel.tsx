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
import { monthKeyOf } from './periods';
import { useDashboardCommissionSeries } from './api';
import type { CommissionSeriesResponse } from './types';
import { Info } from 'lucide-react';

/**
 * Commission Overview, owner-only. Commission received (what the owner recorded) is shown by
 * month, this year against last year.
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

  return (
    <section
      aria-labelledby="dash-commission"
      className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 shadow-[var(--dash-shadow)] lg:h-full"
    >
      <h2 id="dash-commission" className="text-sm font-semibold text-[var(--dash-fg)]">
        {t('commission.title')}
      </h2>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="min-h-0 min-w-0 flex-1">
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
      </div>
      <p className="mt-auto flex shrink-0 items-center gap-1 text-[11px] text-[var(--dash-fg-muted)]">
        <Info aria-hidden className="size-3.5 shrink-0" />
        {t('commission.basisNote')}
      </p>
    </section>
  );
}
