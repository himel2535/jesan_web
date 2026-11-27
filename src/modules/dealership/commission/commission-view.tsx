'use client';

import { Coins, Pencil, Percent, PiggyBank, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCan } from '@/core/auth/can';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { cn } from '@/core/ui/cn';
import { EmptyState } from '@/core/ui/empty-state';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { Money } from '../master-data/shared/display';
import { ListSkeleton, LoadError, Notice } from '../master-data/shared/states';
import { useDashboardCommissionSeries } from '../dashboard/api';
import { useCommissionEntries, useCommissionSummary } from './api';
import { EntryForm } from './entry-form';
import { CommissionKpiCard } from './kpi-card';
import type { CommissionEntry } from './types';

const TODAY = businessToday();
const THIS_YEAR = Number(TODAY.slice(0, 4));
const THIS_MONTH = Number(TODAY.slice(5, 7));
const MIN_YEAR = THIS_YEAR - 3;
const MAX_YEAR = THIS_YEAR + 3;
const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** `?year=` and `?month=` (1-12, within that year); the defaults are this year and this month. */
function usePeriodParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rawYear = Number(params.get('year'));
  const year =
    Number.isInteger(rawYear) && rawYear >= MIN_YEAR && rawYear <= MAX_YEAR ? rawYear : THIS_YEAR;
  const rawMonth = Number(params.get('month'));
  const month =
    Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12
      ? rawMonth
      : year === THIS_YEAR
        ? THIS_MONTH
        : 12;

  const update = (nextYear: number, nextMonth: number) => {
    const search = new URLSearchParams(params.toString());
    if (nextYear === THIS_YEAR) search.delete('year');
    else search.set('year', String(nextYear));
    const defaultMonth = nextYear === THIS_YEAR ? THIS_MONTH : 12;
    if (nextMonth === defaultMonth) search.delete('month');
    else search.set('month', String(nextMonth));
    search.delete('page');
    const qs = search.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return {
    year,
    month,
    setYear: (next: number) => update(next, month),
    setMonth: (next: number) => update(year, next),
  };
}

/** Year and month KPI cards, each with its own dropdown (`commission.view`, owner-only). */
function CommissionKpis({
  slug,
  businessId,
  year,
  month,
  setYear,
  setMonth,
}: {
  slug: string;
  businessId: string;
  year: number;
  month: number;
  setYear: (year: number) => void;
  setMonth: (month: number) => void;
}) {
  const t = useTranslations('dealership.commission.summary');
  const format = useFormat();
  const summary = useCommissionSummary(slug, businessId, year);
  const series = useDashboardCommissionSeries(slug, businessId, year);
  const monthly = series.data?.months.find((row) => row.month === monthKey(year, month));
  const monthName = (m: number) =>
    format.date(`${monthKey(year, m)}-01T00:00:00+06:00`, { month: 'long' });

  return (
    <div className="dash-scope grid gap-3 sm:grid-cols-2">
      <CommissionKpiCard
        hue="green"
        icon={<PiggyBank aria-hidden className="size-4" />}
        title={t('yearlyTitle')}
        selectId="commission-year"
        selectLabel={t('selectYear')}
        selectValue={String(year)}
        options={YEARS.map((y) => ({
          value: String(y),
          label: format.number(y, { useGrouping: false }),
        }))}
        onSelect={(value) => setYear(Number(value))}
        loading={summary.isPending}
        busy={summary.isFetching}
        error={
          summary.isError ? (
            <LoadError error={summary.error} onRetry={() => void summary.refetch()} />
          ) : null
        }
        value={summary.data ? <Money value={summary.data.totalReceived} /> : null}
        note={summary.data ? t('entries', { count: summary.data.entryCount }) : null}
      />
      <CommissionKpiCard
        hue="blue"
        icon={<Coins aria-hidden className="size-4" />}
        title={t('monthlyTitle')}
        selectId="commission-month"
        selectLabel={t('selectMonth')}
        selectValue={String(month)}
        options={MONTHS.map((m) => ({
          value: String(m),
          label: monthName(m),
          disabled: year === THIS_YEAR && m > THIS_MONTH,
        }))}
        onSelect={(value) => setMonth(Number(value))}
        loading={series.isPending}
        busy={series.isFetching}
        error={
          series.isError ? (
            <LoadError error={series.error} onRetry={() => void series.refetch()} />
          ) : null
        }
        value={<Money value={monthly?.received ?? '0.00'} />}
        note={`${monthName(month)} ${format.number(year, { useGrouping: false })}`}
      />
    </div>
  );
}

/** Year and month totals + paginated list of commission received (`commission.view`, owner-only). */
export function CommissionView({ slug, businessId }: { slug: string; businessId: string }) {
  const canManage = useCan('commission.manage');
  const period = usePeriodParams();
  const [dialog, setDialog] = useState<{ entry: CommissionEntry | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Notice>{notice}</Notice>

      <CommissionKpis slug={slug} businessId={businessId} {...period} />

      <EntriesList
        slug={slug}
        businessId={businessId}
        canManage={canManage}
        onNew={() => setDialog({ entry: null })}
        onEdit={(entry) => setDialog({ entry })}
      />

      {dialog ? (
        <EntryForm
          entry={dialog.entry}
          slug={slug}
          businessId={businessId}
          onClose={() => setDialog(null)}
          onSaved={(message) => (setDialog(null), setNotice(message))}
        />
      ) : null}
    </div>
  );
}

function EntriesList({
  slug,
  businessId,
  canManage,
  onNew,
  onEdit,
}: {
  slug: string;
  businessId: string;
  canManage: boolean;
  onNew: () => void;
  onEdit: (entry: CommissionEntry) => void;
}) {
  const t = useTranslations('dealership.commission.entry');
  const tc = useTranslations('dealership.common');
  const format = useFormat();
  const isDesktop = useIsDesktop();
  const params = useSearchParams();
  const page = parsePageParam(params.get('page'));
  const query = useCommissionEntries(slug, businessId, page);
  const when = (iso: string) => format.date(`${iso}T00:00:00+06:00`);
  const editButton = (entry: CommissionEntry) =>
    canManage ? (
      <Button
        variant="secondary"
        onClick={() => onEdit(entry)}
        aria-label={t('editFor', { date: when(entry.receivedDate) })}
      >
        <Pencil aria-hidden className="size-3" />
        {tc('edit')}
      </Button>
    ) : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {canManage ? (
          <Button onClick={onNew}>
            <Plus aria-hidden className="size-4" />
            {t('new')}
          </Button>
        ) : null}
      </div>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={Percent} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          <div className={cn(query.isPlaceholderData && 'opacity-60')} aria-busy={query.isFetching}>
            {isDesktop ? (
              <div className="overflow-x-auto rounded-card border border-border bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-fg-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('receivedDate')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('amount')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('note')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        <span className="sr-only">{t('actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.items.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-border last:border-0 hover:bg-surface-muted"
                      >
                        <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap">
                          {when(entry.receivedDate)}
                        </th>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <Money value={entry.amount} />
                        </td>
                        <td className="max-w-md px-4 py-3 break-words">{entry.note ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">{editButton(entry)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {query.data.items.map((entry) => (
                  <li key={entry.id} className="rounded-card border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{when(entry.receivedDate)}</p>
                      <p className="font-semibold tabular-nums">
                        <Money value={entry.amount} />
                      </p>
                    </div>
                    <p className="mt-1 text-sm break-words text-fg-muted">{entry.note ?? '—'}</p>
                    {canManage ? <div className="mt-3">{editButton(entry)}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Pagination totalItems={query.data.total} pageSize={query.data.pageSize || PAGE_SIZE} />
        </>
      )}
    </section>
  );
}
