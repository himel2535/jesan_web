'use client';

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { salesReportQuery } from '../reports/api';

function isoOf(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

const COLORS = ['var(--dash-primary)', 'var(--dash-green-icon-bg)', 'var(--dash-purple-icon-bg)'];

export function SalesSummaryDonut({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard.salesSummary');
  const format = useFormat();
  const today = useMemo(() => businessToday(), []);

  const ranges = useMemo(() => {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    return {
      thisMonth: { from: isoOf(y, m - 1, 1), to: today },
      lastMonth: { from: isoOf(y, m - 2, 1), to: isoOf(y, m - 1, 0) },
      thisYear: { from: isoOf(y, 0, 1), to: today },
    };
  }, [today]);

  const [thisMonth, lastMonth, thisYear] = useQueries({
    queries: [
      salesReportQuery(slug, businessId, { groupBy: 'date', ...ranges.thisMonth, page: 1 }),
      salesReportQuery(slug, businessId, { groupBy: 'date', ...ranges.lastMonth, page: 1 }),
      salesReportQuery(slug, businessId, { groupBy: 'date', ...ranges.thisYear, page: 1 }),
    ],
  });

  const isPending = thisMonth.isPending || lastMonth.isPending || thisYear.isPending;
  const error = thisMonth.error ?? lastMonth.error ?? thisYear.error;
  if (isForbidden(error)) return null;

  const segments = [
    { key: 'thisMonth', label: t('thisMonthSales'), amount: thisMonth.data?.totalAmount ?? '0' },
    { key: 'lastMonth', label: t('lastMonthSales'), amount: lastMonth.data?.totalAmount ?? '0' },
    { key: 'thisYear', label: t('thisYearSales'), amount: thisYear.data?.totalAmount ?? '0' },
  ];
  const chartData = segments.map((s) => ({ ...s, value: Number(s.amount) }));
  const hasData = chartData.some((s) => s.value > 0);

  return (
    <div className="flex h-full flex-col rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
      <h2 className="mb-4 text-base font-semibold text-[var(--dash-fg)]">{t('title')}</h2>

      {error && !isForbidden(error) ? (
        <LoadError
          error={error}
          onRetry={() => {
            void thisMonth.refetch();
            void lastMonth.refetch();
            void thisYear.refetch();
          }}
        />
      ) : isPending ? (
        <div className="mx-auto h-40 w-40 animate-pulse rounded-full bg-[var(--dash-bg)]" />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="relative size-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={hasData ? chartData : [{ key: 'empty', label: '', amount: '0', value: 1 }]}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="65%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="var(--dash-surface)"
                  strokeWidth={2}
                >
                  {hasData ? (
                    chartData.map((entry, index) => (
                      <Cell key={entry.key} fill={COLORS[index % COLORS.length]} />
                    ))
                  ) : (
                    <Cell fill="var(--dash-border)" />
                  )}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-[var(--dash-fg)]">
                {format.money(segments[0]?.amount ?? '0')}
              </span>
              <span className="text-[10px] text-[var(--dash-fg-muted)]">{t('thisMonthSales')}</span>
            </div>
          </div>

          <ul className="w-full space-y-2 text-sm">
            {segments.map((s, index) => (
              <li key={s.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[var(--dash-fg-muted)]">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  {s.label}
                </span>
                <span className="font-medium text-[var(--dash-fg)]">
                  <Money value={s.amount} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
