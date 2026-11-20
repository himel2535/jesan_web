'use client';

import { ChevronLeft, ChevronRight, Percent, Plus } from 'lucide-react';
import Link from 'next/link';
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
import { Skeleton } from '@/core/ui/skeleton';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { Money } from '../master-data/shared/display';
import { ListSkeleton, LoadError, Notice } from '../master-data/shared/states';
import { useCommissionEntries, useCommissionScheme, useCommissionSummary } from './api';
import { EntryForm } from './entry-form';
import { ReceiptForm } from './receipt-form';
import { SchemeForm } from './scheme-form';
import { useDefaultUnit } from './shared';
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

/** Scheme card + yearly KPI + paginated entries list (`commission.view`, owner-only). */
export function CommissionView({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.commission');
  const format = useFormat();
  const tc = useTranslations('dealership.common');
  const canManage = useCan('commission.manage');
  const unit = useDefaultUnit(slug, businessId);
  const scheme = useCommissionScheme(slug, businessId);
  const { year, setYear } = useYearParam();
  const summary = useCommissionSummary(slug, businessId, year);
  const [dialog, setDialog] = useState<'scheme' | 'entry' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const base = `/b/${encodeURIComponent(slug)}/commission`;

  return (
    <div className="space-y-6">
      <Notice>{notice}</Notice>

      <section className="rounded-card glass p-5">
        {scheme.isPending || unit.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-56" />
          </div>
        ) : scheme.data ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">{t('scheme.title')}</h2>
              <p className="text-sm">
                {t('scheme.rateBaseLine', {
                  amount: format.money(scheme.data.rateBase),
                  unit: unit.name,
                })}
              </p>
              <p className="text-sm">
                {t('scheme.targetQtyLine', {
                  quantity: format.quantity(scheme.data.targetQty),
                  unit: unit.name,
                })}
              </p>
              <p className="text-sm">
                {t('scheme.bonusRateLine', {
                  amount: format.money(scheme.data.bonusRate),
                  unit: unit.name,
                })}
              </p>
            </div>
            {canManage ? (
              <Button variant="secondary" onClick={() => setDialog('scheme')}>
                {tc('edit')}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-fg-muted">{t('scheme.notSet')}</p>
            {canManage ? (
              <Button onClick={() => setDialog('scheme')}>{t('scheme.setPrompt')}</Button>
            ) : null}
          </div>
        )}
      </section>

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
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-card bg-border" />
            ))}
          </div>
        ) : summary.isError ? (
          <LoadError error={summary.error} onRetry={() => void summary.refetch()} />
        ) : (
          <div
            className={cn('grid gap-3 sm:grid-cols-3', summary.isPlaceholderData && 'opacity-60')}
            aria-busy={summary.isFetching}
          >
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-sm text-fg-muted">{t('summary.totalCalculated')}</p>
              <p className="text-lg font-bold tabular-nums">
                <Money value={summary.data.totalCalculated} />
              </p>
              <p className="text-sm text-fg-muted">
                {t('summary.entries', { count: summary.data.entryCount })}
              </p>
            </div>
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-sm text-fg-muted">{t('summary.totalReceived')}</p>
              <p className="text-lg font-bold tabular-nums">
                <Money value={summary.data.totalReceived} />
              </p>
              <p className="text-sm text-fg-muted">
                {t('summary.receipts', { count: summary.data.receiptCount })}
              </p>
            </div>
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-sm text-fg-muted">{t('summary.totalPending')}</p>
              <p className="text-lg font-bold tabular-nums">
                <Money value={summary.data.totalPending} />
              </p>
            </div>
          </div>
        )}
      </section>

      <EntriesList
        slug={slug}
        businessId={businessId}
        base={base}
        canManage={canManage}
        unitName={unit.name}
        onNew={() => setDialog('entry')}
      />

      {dialog === 'scheme' ? (
        <SchemeForm
          scheme={scheme.data ?? null}
          unitName={unit.name}
          slug={slug}
          businessId={businessId}
          onClose={() => setDialog(null)}
          onSaved={(message) => (setDialog(null), setNotice(message))}
        />
      ) : null}
      {dialog === 'entry' ? (
        <EntryForm
          entry={null}
          scheme={scheme.data ?? null}
          unitName={unit.name}
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
  base,
  canManage,
  unitName,
  onNew,
}: {
  slug: string;
  businessId: string;
  base: string;
  canManage: boolean;
  unitName: string;
  onNew: () => void;
}) {
  const t = useTranslations('dealership.commission.entry');
  const format = useFormat();
  const isDesktop = useIsDesktop();
  const params = useSearchParams();
  const page = parsePageParam(params.get('page'));
  const query = useCommissionEntries(slug, businessId, page);
  const [quickReceipt, setQuickReceipt] = useState<CommissionEntry | null>(null);
  const [listNotice, setListNotice] = useState<string | null>(null);
  const when = (iso: string) => format.date(`${iso}T00:00:00+06:00`);

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
      <Notice>{listNotice}</Notice>

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
                        {t('fromDate')} – {t('toDate')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('quantity', { unit: unitName })}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('calculatedAmount')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('receivedAmount')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('pendingAmount')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        <span className="sr-only">{t('actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.items.map((entry: CommissionEntry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-border last:border-0 hover:bg-surface-muted"
                      >
                        <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap">
                          <Link
                            href={`${base}/${entry.id}`}
                            prefetch={false}
                            className="hover:underline"
                            aria-label={t('detailsFor', {
                              date: `${when(entry.fromDate)} – ${when(entry.toDate)}`,
                            })}
                          >
                            {when(entry.fromDate)} – {when(entry.toDate)}
                          </Link>
                        </th>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {format.quantity(entry.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <Money value={entry.calculatedAmount} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <Money value={entry.receivedAmount} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <Money value={entry.pendingAmount} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`${base}/${entry.id}`}
                              prefetch={false}
                              className="hover:bg-surface-hover focus-visible:outline-ring inline-flex h-8 items-center rounded-md border border-border bg-surface-muted px-3 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                              {t('details')}
                            </Link>
                            {canManage ? (
                              <Button
                                variant="secondary"
                                onClick={() => setQuickReceipt(entry)}
                                aria-label={t('addReceiptFor', {
                                  date: `${when(entry.fromDate)} – ${when(entry.toDate)}`,
                                })}
                              >
                                <Plus aria-hidden className="size-3" />
                                {t('addReceipt')}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {query.data.items.map((entry: CommissionEntry) => (
                  <li key={entry.id} className="rounded-card border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {when(entry.fromDate)} – {when(entry.toDate)}
                        </p>
                        <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
                          <span>
                            <span className="text-fg-muted">{t('calculatedAmount')}: </span>
                            <Money value={entry.calculatedAmount} />
                          </span>
                          <span>
                            <span className="text-fg-muted">{t('receivedAmount')}: </span>
                            <Money value={entry.receivedAmount} />
                          </span>
                          <span>
                            <span className="text-fg-muted">{t('pendingAmount')}: </span>
                            <Money value={entry.pendingAmount} />
                          </span>
                        </p>
                      </div>
                      <span className="text-sm text-fg-muted tabular-nums">
                        {format.quantity(entry.quantity)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`${base}/${entry.id}`}
                        prefetch={false}
                        className="hover:bg-surface-hover focus-visible:outline-ring inline-flex h-8 items-center rounded-md border border-border bg-surface-muted px-3 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {t('details')}
                      </Link>
                      {canManage ? (
                        <Button
                          variant="secondary"
                          onClick={() => setQuickReceipt(entry)}
                          aria-label={t('addReceiptFor', {
                            date: `${when(entry.fromDate)} – ${when(entry.toDate)}`,
                          })}
                        >
                          <Plus aria-hidden className="size-3" />
                          {t('addReceipt')}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Pagination totalItems={query.data.total} pageSize={query.data.pageSize || PAGE_SIZE} />
        </>
      )}

      {quickReceipt ? (
        <ReceiptForm
          entryId={quickReceipt.id}
          receipt={null}
          slug={slug}
          businessId={businessId}
          onClose={() => setQuickReceipt(null)}
          onSaved={(message) => (setQuickReceipt(null), setListNotice(message))}
        />
      ) : null}
    </section>
  );
}
