'use client';

import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { LoadError } from '../master-data/shared/states';
import { salesReportQuery, collectionsReportQuery } from '../reports/api';

function isoOf(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

const FILTERS = ['thisMonth', 'lastMonth', 'thisYear'] as const;
type Filter = (typeof FILTERS)[number];

interface ChartPoint {
  key: string;
  label: string;
  sales: number;
  collection: number;
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Daily points for a single month (This Month / Last Month). `reports/sales`/`reports/collections`
 * with `groupBy=date` page at 10 rows server-side, so a very active month only shows its most
 * recent 10 active days — the headline total in the KPI cards above is always the full-month
 * figure regardless (see DECISIONS.md, "Revenue Overview chart scope").
 */
function useDailyRevenue(slug: string, businessId: string, range: { from: string; to: string }) {
  const sales = useQuery(
    salesReportQuery(slug, businessId, { groupBy: 'date', ...range, page: 1 }),
  );
  const collections = useQuery(
    collectionsReportQuery(slug, businessId, { groupBy: 'date', ...range, page: 1 }),
  );
  const points = useMemo<ChartPoint[]>(() => {
    if (!sales.data || !collections.data) return [];
    const collectionByDate = new Map(collections.data.items.map((row) => [row.key, row.amount]));
    return [...sales.data.items]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((row) => ({
        key: row.key,
        label: row.label,
        sales: Number(row.amount),
        collection: Number(collectionByDate.get(row.key) ?? '0'),
      }));
  }, [sales.data, collections.data]);
  return {
    points,
    isPending: sales.isPending || collections.isPending,
    error: sales.error ?? collections.error,
    refetch: () => {
      void sales.refetch();
      void collections.refetch();
    },
  };
}

/** One data point per calendar month, Jan through the current month (year to date). */
function useYearRevenue(slug: string, businessId: string, today: string) {
  const year = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const months = useMemo(
    () =>
      Array.from({ length: currentMonth }, (_, i) => {
        const m = i + 1;
        const to = m === currentMonth ? today : isoOf(year, m, 0);
        return { month: m, from: isoOf(year, m - 1, 1), to };
      }),
    [year, currentMonth, today],
  );

  const salesQueries = useQueries({
    queries: months.map((m) =>
      salesReportQuery(slug, businessId, { groupBy: 'date', from: m.from, to: m.to, page: 1 }),
    ),
  });
  const collectionsQueries = useQueries({
    queries: months.map((m) =>
      collectionsReportQuery(slug, businessId, {
        groupBy: 'date',
        from: m.from,
        to: m.to,
        page: 1,
      }),
    ),
  });

  const isPending =
    salesQueries.some((q) => q.isPending) || collectionsQueries.some((q) => q.isPending);
  const error =
    salesQueries.find((q) => q.error)?.error ?? collectionsQueries.find((q) => q.error)?.error;
  const points = useMemo<ChartPoint[]>(() => {
    if (isPending) return [];
    return months.map((m, i) => ({
      key: String(m.month),
      label: m.from.slice(0, 7),
      sales: Number(salesQueries[i]?.data?.totalAmount ?? '0'),
      collection: Number(collectionsQueries[i]?.data?.totalAmount ?? '0'),
    }));
  }, [months, isPending, salesQueries, collectionsQueries]);

  return {
    points,
    isPending,
    error,
    refetch: () => {
      salesQueries.forEach((q) => void q.refetch());
      collectionsQueries.forEach((q) => void q.refetch());
    },
  };
}

export function RevenueOverview({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard.revenueOverview');
  const format = useFormat();
  const [filter, setFilter] = useState<Filter>('thisMonth');
  const today = useMemo(() => businessToday(), []);

  const ranges = useMemo(() => {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    return {
      thisMonth: { from: isoOf(y, m - 1, 1), to: today },
      lastMonth: { from: isoOf(y, m - 2, 1), to: isoOf(y, m - 1, 0) },
    };
  }, [today]);

  const monthData = useDailyRevenue(
    slug,
    businessId,
    filter === 'lastMonth' ? ranges.lastMonth : ranges.thisMonth,
  );
  const yearData = useYearRevenue(slug, businessId, today);
  const active = filter === 'thisYear' ? yearData : monthData;

  if (isForbidden(active.error)) return null;

  return (
    <div className="flex h-full flex-col rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--dash-fg)]">{t('title')}</h2>
        <div className="flex gap-1 rounded-lg bg-[var(--dash-bg)] p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-[var(--dash-primary)] text-white'
                  : 'text-[var(--dash-fg-muted)] hover:text-[var(--dash-fg)]',
              )}
            >
              {t(`filter${f.charAt(0).toUpperCase()}${f.slice(1)}` as 'filterThisMonth')}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex gap-5 text-xs">
        <span className="flex items-center gap-1.5 text-[var(--dash-fg-muted)]">
          <span className="size-2.5 rounded-full bg-[var(--dash-primary)]" /> {t('salesRevenue')}
        </span>
        <span className="flex items-center gap-1.5 text-[var(--dash-fg-muted)]">
          <span className="size-2.5 rounded-full bg-[var(--dash-success)]" /> {t('collection')}
        </span>
      </div>

      {active.error && !isForbidden(active.error) ? (
        <LoadError error={active.error} onRetry={active.refetch} />
      ) : active.isPending ? (
        <div className="h-64 w-full animate-pulse rounded-lg bg-[var(--dash-bg)]" />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={active.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="dashSalesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--dash-primary)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--dash-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashCollectionFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--dash-success)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--dash-success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--dash-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--dash-fg-muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--dash-border)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--dash-fg-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(value: number) => format.number(value, { notation: 'compact' })}
              />
              <Tooltip
                formatter={(value) => format.money(String(value))}
                contentStyle={{
                  background: 'var(--dash-surface)',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 8,
                  color: 'var(--dash-fg)',
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                name={t('salesRevenue')}
                stroke="var(--dash-primary)"
                strokeWidth={2}
                fill="url(#dashSalesFill)"
              />
              <Area
                type="monotone"
                dataKey="collection"
                name={t('collection')}
                stroke="var(--dash-success)"
                strokeWidth={2}
                fill="url(#dashCollectionFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
