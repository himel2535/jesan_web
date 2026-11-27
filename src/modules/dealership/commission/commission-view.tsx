'use client';

import { ChevronLeft, ChevronRight, Pencil, Percent, Plus } from 'lucide-react';
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
import { useCommissionEntries, useCommissionSummary } from './api';
import { EntryForm } from './entry-form';
import type { CommissionEntry } from './types';

const THIS_YEAR = Number(businessToday().slice(0, 4));

function useYearParam() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = Number(params.get('year'));
  const year =
    Number.isInteger(raw) && raw >= THIS_YEAR - 3 && raw <= THIS_YEAR + 3 ? raw : THIS_YEAR;
  const setYear = (next: number) => {
    const search = new URLSearchParams(params.toString());
    if (next === THIS_YEAR) search.delete('year');
    else search.set('year', String(next));
    search.delete('page');
    const qs = search.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return { year, setYear };
}

/** Year total + paginated list of commission received (`commission.view`, owner-only). */
export function CommissionView({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.commission');
  const canManage = useCan('commission.manage');
  const { year, setYear } = useYearParam();
  const summary = useCommissionSummary(slug, businessId, year);
  const [dialog, setDialog] = useState<{ entry: CommissionEntry | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Notice>{notice}</Notice>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t('summary.title')}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              aria-label={t('summary.previousYear')}
              disabled={year <= THIS_YEAR - 3}
              onClick={() => setYear(year - 1)}
            >
              <ChevronLeft aria-hidden className="size-4" />
            </Button>
            <span className="min-w-14 text-center font-semibold tabular-nums">{year}</span>
            <Button
              variant="ghost"
              aria-label={t('summary.nextYear')}
              disabled={year >= THIS_YEAR + 3}
              onClick={() => setYear(year + 1)}
            >
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
        {summary.isPending ? (
          <div className="h-24 animate-pulse rounded-card bg-border sm:max-w-xs" />
        ) : summary.isError ? (
          <LoadError error={summary.error} onRetry={() => void summary.refetch()} />
        ) : (
          <div
            className={cn(
              'rounded-card border border-border bg-surface p-4 sm:max-w-xs',
              summary.isPlaceholderData && 'opacity-60',
            )}
            aria-busy={summary.isFetching}
          >
            <p className="text-sm text-fg-muted">{t('summary.totalReceived')}</p>
            <p className="text-lg font-bold tabular-nums">
              <Money value={summary.data.totalReceived} />
            </p>
            <p className="text-sm text-fg-muted">
              {t('summary.entries', { count: summary.data.entryCount })}
            </p>
          </div>
        )}
      </section>

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
