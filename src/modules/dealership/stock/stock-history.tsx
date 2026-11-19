'use client';

import { History, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { ApiError } from '@/core/api/errors';
import { useCan } from '@/core/auth/can';
import { localizedName } from '@/core/auth/types';
import { useDynamicT } from '@/core/i18n/use-dynamic-t';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { cn } from '@/core/ui/cn';
import { EmptyState } from '@/core/ui/empty-state';
import { PageHeader } from '@/core/ui/page-header';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { useUnits } from '../master-data/api';
import { useNameOf } from '../master-data/shared/display';
import { ListSkeleton, LoadError, Notice } from '../master-data/shared/states';
import { useMovements } from './api';
import { AdjustStockDialog } from './adjust-dialog';
import { MOVEMENT_KINDS, type Movement, type MovementFilters, type MovementKind } from './types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function useMovementFilters(): MovementFilters {
  const p = useSearchParams();
  const date = (key: string) => {
    const v = p.get(key);
    return v && DATE.test(v) ? v : undefined;
  };
  const kind = p.get('kind');
  return {
    from: date('from'),
    to: date('to'),
    kind: (MOVEMENT_KINDS as readonly string[]).includes(kind ?? '')
      ? (kind as MovementKind)
      : undefined,
    page: parsePageParam(p.get('page')),
  };
}

/**
 * One product's stock history, newest first, 10 per page: signed change, stock after, source
 * (a purchase code links to the purchase), reason and who. Filters in the URL.
 */
export function StockHistory({
  slug,
  businessId,
  productId,
}: {
  slug: string;
  businessId: string;
  productId: string;
}) {
  const t = useTranslations('dealership.stock');
  const dt = useDynamicT();
  const locale = useLocale();
  const id = useId();
  const format = useFormat();
  const nameOf = useNameOf();
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canAdjust = useCan('stock.adjust');
  const canSeePurchases = useCan('purchase.view');
  const filters = useMovementFilters();
  const query = useMovements(slug, businessId, productId, filters);
  const units = useUnits(slug, businessId);
  const [adjusting, setAdjusting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const base = `/b/${encodeURIComponent(slug)}`;

  const setParams = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('page');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (query.isPending) return <ListSkeleton rows={6} />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <div className="space-y-4">
          <PageHeader title={t('notFoundTitle')} description={t('notFoundDescription')} />
          <Link href={`${base}/stock`} prefetch={false} className="text-sm font-medium underline">
            {t('movements.back')}
          </Link>
        </div>
      );
    }
    return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  }

  const { product, items } = query.data;
  const unit = units.data?.items.find((u) => u.key === product.unitKey);
  const unitName = unit ? localizedName(unit, locale) : product.unitKey;
  const decimals = unit?.decimals ?? 0;
  const filtered = Boolean(filters.from || filters.to || filters.kind);
  const day = (d: string) => format.date(`${d}T00:00:00+06:00`);
  const kindLabel = (k: string) => dt(`dealership.stock.kinds.${k}`, k);

  const source = (m: Movement) =>
    m.source.code && m.source.id && m.source.type === 'purchase' && canSeePurchases ? (
      <Link
        href={`${base}/purchases/${m.source.id}`}
        prefetch={false}
        className="font-mono hover:underline"
      >
        {m.source.code}
      </Link>
    ) : (
      <span className="font-mono">{m.source.code ?? '—'}</span>
    );
  const change = (m: Movement) => (
    <span
      className={cn(
        'font-semibold tabular-nums',
        m.quantity.startsWith('-') ? 'text-danger' : 'text-success',
      )}
    >
      {m.quantity.startsWith('-') ? format.quantity(m.quantity) : `+${format.quantity(m.quantity)}`}
    </span>
  );

  return (
    <>
      <PageHeader
        title={t('historyFor', { name: nameOf(product) })}
        description={t('movements.now', {
          quantity: `${format.quantity(product.currentStock)} ${unitName}`,
        })}
        actions={
          canAdjust ? (
            <Button variant="secondary" onClick={() => (setNotice(null), setAdjusting(true))}>
              <SlidersHorizontal aria-hidden className="size-4" />
              {t('adjust')}
            </Button>
          ) : null
        }
      />
      <div className="space-y-4">
        <Notice>{notice}</Notice>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`${id}-from`} className="mb-1.5 block text-sm font-medium text-fg">
              {t('movements.from')}
            </label>
            <input
              id={`${id}-from`}
              type="date"
              value={filters.from ?? ''}
              max={filters.to}
              onChange={(e) => setParams({ from: e.target.value || undefined })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-to`} className="mb-1.5 block text-sm font-medium text-fg">
              {t('movements.to')}
            </label>
            <input
              id={`${id}-to`}
              type="date"
              value={filters.to ?? ''}
              min={filters.from}
              onChange={(e) => setParams({ to: e.target.value || undefined })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-kind`} className="mb-1.5 block text-sm font-medium text-fg">
              {t('movements.kind')}
            </label>
            <select
              id={`${id}-kind`}
              value={filters.kind ?? ''}
              onChange={(e) => setParams({ kind: e.target.value || undefined })}
              className={inputClass}
            >
              <option value="">{t('movements.kindAll')}</option>
              {MOVEMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {kindLabel(k)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {items.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={History}
              title={t('movements.noResultsTitle')}
              description={t('movements.noResultsDescription')}
              action={
                <Button
                  variant="secondary"
                  onClick={() => setParams({ from: undefined, to: undefined, kind: undefined })}
                >
                  {t('clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={History}
              title={t('movements.emptyTitle')}
              description={t('movements.emptyDescription')}
            />
          )
        ) : (
          <>
            <div
              className={cn(query.isPlaceholderData && 'opacity-60')}
              aria-busy={query.isFetching}
            >
              {isDesktop ? (
                <div className="overflow-x-auto rounded-card border border-border bg-surface">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border text-fg-muted">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium">
                          {t('movements.date')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          {t('movements.kind')}
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          {t('movements.quantity')}
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          {t('movements.balanceAfter')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          {t('movements.source')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          {t('movements.reason')}
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          {t('movements.by')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((m) => (
                        <tr key={m.id} className="border-b border-border last:border-0">
                          <th scope="row" className="px-4 py-3 font-normal whitespace-nowrap">
                            {day(m.movementDate)}
                          </th>
                          <td className="px-4 py-3">{kindLabel(m.kind)}</td>
                          <td className="px-4 py-3 text-right">{change(m)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {format.quantity(m.balanceAfter)}
                          </td>
                          <td className="px-4 py-3">{source(m)}</td>
                          <td className="px-4 py-3 text-fg-muted">{m.reason ?? '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{m.createdBy.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((m) => (
                    <li key={m.id} className="rounded-card border border-border bg-surface p-4">
                      <p className="flex items-start justify-between gap-3">
                        <span className="font-medium">{kindLabel(m.kind)}</span>
                        {change(m)}
                      </p>
                      <p className="mt-1 text-xs text-fg-muted">
                        {day(m.movementDate)} · {t('movements.balanceAfter')}:{' '}
                        {format.quantity(m.balanceAfter)} · {m.createdBy.name}
                      </p>
                      <p className="mt-1 text-sm">
                        {source(m)}
                        {m.reason ? <span className="text-fg-muted"> · {m.reason}</span> : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Pagination totalItems={query.data.total} pageSize={query.data.pageSize || PAGE_SIZE} />
          </>
        )}
        <Link
          href={`${base}/stock`}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {t('movements.back')}
        </Link>
      </div>
      {adjusting ? (
        <AdjustStockDialog
          slug={slug}
          businessId={businessId}
          target={{
            productId: product.id,
            name: nameOf(product),
            currentStock: product.currentStock,
            decimals,
          }}
          onClose={() => setAdjusting(false)}
          onDone={(m) => (setAdjusting(false), setNotice(m))}
        />
      ) : null}
    </>
  );
}
