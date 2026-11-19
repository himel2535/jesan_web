'use client';

import { Boxes, History, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useCan } from '@/core/auth/can';
import { localizedName } from '@/core/auth/types';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { useCategories, useUnits } from '../master-data/api';
import { Money, useNameOf } from '../master-data/shared/display';
import { useListParams, useSetListParams } from '../master-data/shared/list-params';
import { ListToolbar } from '../master-data/shared/list-toolbar';
import { ListEmpty, ListSkeleton, LoadError, Notice } from '../master-data/shared/states';
import { useStock } from './api';
import { AdjustStockDialog, type AdjustTarget } from './adjust-dialog';
import type { StockRow } from './types';

const linkButton =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-muted';

/**
 * Current stock per product, 10 per page. Everyone with `stock.view` sees quantities; the last
 * purchase price and date only come (and show) with `product.cost.view`.
 */
export function StockList({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.stock');
  const tp = useTranslations('dealership.products');
  const tc = useTranslations('dealership.common');
  const locale = useLocale();
  const id = useId();
  const format = useFormat();
  const nameOf = useNameOf();
  const isDesktop = useIsDesktop();
  const canAdjust = useCan('stock.adjust');
  const params = useListParams();
  const setParams = useSetListParams();
  const query = useStock(slug, businessId, {
    search: params.search,
    categoryId: params.categoryId,
    active: params.active,
    page: params.page,
  });
  const categories = useCategories(slug, businessId, 'all');
  const units = useUnits(slug, businessId);
  const [adjusting, setAdjusting] = useState<AdjustTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const base = `/b/${encodeURIComponent(slug)}/stock`;

  const unitOf = (key: string) => units.data?.items.find((u) => u.key === key);
  const qty = (row: StockRow) => {
    const unit = unitOf(row.unitKey);
    return `${format.quantity(row.currentStock)} ${unit ? localizedName(unit, locale) : row.unitKey}`;
  };
  const items = query.data?.items ?? [];
  const showCost = items.some((r) => 'lastPurchasePrice' in r);
  const filtered = Boolean(params.search || params.categoryId || params.active !== 'true');

  const actions = (row: StockRow) => (
    <>
      <Link
        href={`${base}/${row.id}`}
        prefetch={false}
        aria-label={t('historyFor', { name: nameOf(row) })}
        className={linkButton}
      >
        <History aria-hidden className="size-4" />
        {t('history')}
      </Link>
      {canAdjust ? (
        <Button
          variant="secondary"
          aria-label={t('adjustFor', { name: nameOf(row) })}
          onClick={() => (
            setNotice(null),
            setAdjusting({
              productId: row.id,
              name: nameOf(row),
              currentStock: row.currentStock,
              decimals: unitOf(row.unitKey)?.decimals ?? 0,
            })
          )}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          {t('adjust')}
        </Button>
      ) : null}
    </>
  );
  const lastPrice = (row: StockRow) =>
    row.lastPurchasePrice ? (
      <Money value={row.lastPurchasePrice} />
    ) : (
      <span className="text-fg-muted">—</span>
    );

  return (
    <div className="space-y-4">
      <ListToolbar searchPlaceholder={tp('searchPlaceholder')}>
        <div>
          <label htmlFor={`${id}-category`} className="mb-1.5 block text-sm font-medium text-fg">
            {tp('categoryFilter')}
          </label>
          <select
            id={`${id}-category`}
            value={params.categoryId ?? ''}
            onChange={(e) => setParams({ category: e.target.value || undefined })}
            className={inputClass}
          >
            <option value="">{tp('allCategories')}</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {nameOf(c)}
              </option>
            ))}
          </select>
        </div>
      </ListToolbar>
      <Notice>{notice}</Notice>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <ListEmpty
          filtered={filtered}
          icon={Boxes}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          onClear={() => setParams({ search: undefined, category: undefined, active: undefined })}
        />
      ) : (
        <>
          <div className={cn(query.isPlaceholderData && 'opacity-60')} aria-busy={query.isFetching}>
            {isDesktop ? (
              <div className="overflow-x-auto rounded-card border border-border bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-fg-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {tp('category')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {tc('name')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('currentStock')}
                      </th>
                      {showCost ? (
                        <>
                          <th scope="col" className="px-4 py-3 text-right font-medium">
                            {t('lastPurchasePrice')}
                          </th>
                          <th scope="col" className="px-4 py-3 font-medium">
                            {t('lastPurchasedAt')}
                          </th>
                        </>
                      ) : null}
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">{t('history')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border last:border-0 hover:bg-surface-muted"
                      >
                        <td className="px-4 py-3">{nameOf(row.category)}</td>
                        <th scope="row" className="px-4 py-3 font-medium">
                          <span className="font-mono text-xs text-fg-muted">{row.code}</span>{' '}
                          {nameOf(row)}
                        </th>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                          {qty(row)}
                        </td>
                        {showCost ? (
                          <>
                            <td className="px-4 py-3 text-right">{lastPrice(row)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-fg-muted">
                              {row.lastPurchasedAt ? format.date(row.lastPurchasedAt) : '—'}
                            </td>
                          </>
                        ) : null}
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((row) => (
                  <li key={row.id} className="rounded-card border border-border bg-surface p-4">
                    <p className="flex items-start justify-between gap-3">
                      <span className="font-medium">{nameOf(row)}</span>
                      <span className="font-semibold tabular-nums">{qty(row)}</span>
                    </p>
                    <p className="mt-1 text-xs text-fg-muted">
                      {row.code} · {nameOf(row.category)}
                    </p>
                    {showCost ? (
                      <p className="mt-2 text-sm">
                        <span className="text-fg-muted">{t('lastPurchasePrice')}: </span>
                        {lastPrice(row)}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap justify-end gap-1">{actions(row)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Pagination totalItems={query.data.total} pageSize={query.data.pageSize || PAGE_SIZE} />
        </>
      )}
      {adjusting ? (
        <AdjustStockDialog
          slug={slug}
          businessId={businessId}
          target={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={(m) => (setAdjusting(null), setNotice(m))}
        />
      ) : null}
    </div>
  );
}
