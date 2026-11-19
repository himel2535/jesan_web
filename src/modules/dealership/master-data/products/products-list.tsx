'use client';

import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { localizedName } from '@/core/auth/types';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { useStock } from '../../stock/api';
import { useCategories, useProducts, useSaveProduct, useUnits } from '../api';
import { Money, StatusBadge, useNameOf } from '../shared/display';
import { useListParams, useSetListParams } from '../shared/list-params';
import { ListToolbar } from '../shared/list-toolbar';
import { DetailsLink, RowActions } from '../shared/row-actions';
import { ListEmpty, ListSkeleton, LoadError, Notice } from '../shared/states';
import type { Product } from '../types';

const buttonLink =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90';

/**
 * Products of one business, 10 per page, searchable by English/Bangla name and code.
 * The purchase-price column exists only with `product.cost.view` — without it the API sends no
 * `lastPurchasePrice` and the UI keeps no space for it.
 */
export function ProductsList({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const locale = useLocale();
  const id = useId();
  const nameOf = useNameOf();
  const isDesktop = useIsDesktop();
  const canManage = useCan('product.manage');
  const canSeeCost = useCan('product.cost.view');
  const canDeactivate = useCan('product.deactivate');
  const save = useSaveProduct(slug, businessId);
  const [notice, setNotice] = useState<string | null>(null);
  const params = useListParams();
  const setParams = useSetListParams();
  const query = useProducts(slug, businessId, params);
  const categories = useCategories(slug, businessId, 'all');
  const units = useUnits(slug, businessId);
  // Current stock: GET products has no stock, so ask GET stock with the same filters (same
  // order and search on the API) and match by id; only with stock.view (DECISIONS.md).
  const canSeeStock = useCan('stock.view');
  const stock = useStock(
    slug,
    businessId,
    {
      search: params.search,
      categoryId: params.categoryId,
      active: params.active,
      page: params.page,
    },
    canSeeStock,
  );
  const stockOf = (id: string) => stock.data?.items.find((r) => r.id === id)?.currentStock;
  const base = `/b/${encodeURIComponent(slug)}/products`;

  const unitName = (key: string) => {
    const unit = units.data?.items.find((u) => u.key === key);
    return unit ? localizedName(unit, locale) : key;
  };
  const items = query.data?.items ?? [];
  const filtered = Boolean(params.search || params.categoryId || params.active !== 'true');
  // Belt and braces: the column needs the permission AND the field in the data.
  const showCost = canSeeCost && items.some((p) => 'lastPurchasePrice' in p);
  const actions = (p: Product) => (
    <>
      <DetailsLink href={`${base}/${p.id}`} name={nameOf(p)} />
      <RowActions
        name={nameOf(p)}
        isActive={p.isActive}
        editHref={canManage ? `${base}/${p.id}/edit` : undefined}
        canDeactivate={canDeactivate}
        onToggleActive={async (reason) => {
          await save.mutateAsync({ id: p.id, body: { isActive: !p.isActive, reason } });
          setNotice(t('common.statusChanged'));
        }}
      />
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ListToolbar searchPlaceholder={t('products.searchPlaceholder')}>
            <div>
              <label
                htmlFor={`${id}-category`}
                className="mb-1.5 block text-sm font-medium text-fg"
              >
                {t('products.categoryFilter')}
              </label>
              <select
                id={`${id}-category`}
                value={params.categoryId ?? ''}
                onChange={(e) => setParams({ category: e.target.value || undefined })}
                className={inputClass}
              >
                <option value="">{t('products.allCategories')}</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {nameOf(c)}
                  </option>
                ))}
              </select>
            </div>
          </ListToolbar>
        </div>
        {canManage ? (
          <Link href={`${base}/new`} prefetch={false} className={buttonLink}>
            <Plus aria-hidden className="size-4" />
            {t('products.new')}
          </Link>
        ) : null}
      </div>

      <Notice>{notice}</Notice>
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <ListEmpty
          filtered={filtered}
          icon={Package}
          title={t('products.emptyTitle')}
          description={t('products.emptyDescription')}
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
                        {t('common.code')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('common.name')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('products.category')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('products.unit')}
                      </th>
                      {canSeeStock ? (
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          {t('products.currentStock')}
                        </th>
                      ) : null}
                      {showCost ? (
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          {t('products.lastPurchasePrice')}
                        </th>
                      ) : null}
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('common.status')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-border last:border-0 hover:bg-surface-muted"
                      >
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{p.code}</td>
                        <th scope="row" className="px-4 py-3 font-medium">
                          <Link
                            href={`${base}/${p.id}`}
                            prefetch={false}
                            className="hover:underline"
                          >
                            {nameOf(p)}
                          </Link>
                          <span className="block text-xs font-normal text-fg-muted">
                            {locale === 'bn' ? p.nameEn : p.nameBn}
                          </span>
                        </th>
                        <td className="px-4 py-3">{nameOf(p.category)}</td>
                        <td className="px-4 py-3">{unitName(p.unitKey)}</td>
                        {canSeeStock ? (
                          <td className="px-4 py-3 text-right tabular-nums">
                            <StockCell value={stockOf(p.id)} />
                          </td>
                        ) : null}
                        {showCost ? (
                          <td className="px-4 py-3 text-right">
                            <LastPrice value={p.lastPurchasePrice} />
                          </td>
                        ) : null}
                        <td className="px-4 py-3">
                          <StatusBadge active={p.isActive} />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">{actions(p)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    href={`${base}/${p.id}`}
                    showCost={showCost}
                    unitName={unitName}
                    stock={canSeeStock ? stockOf(p.id) : undefined}
                    showStock={canSeeStock}
                    actions={actions(p)}
                  />
                ))}
              </ul>
            )}
          </div>
          <Pagination totalItems={query.data.total} pageSize={query.data.pageSize || PAGE_SIZE} />
        </>
      )}
    </div>
  );
}

function ProductCard({
  product,
  href,
  showCost,
  unitName,
  stock,
  showStock,
  actions,
}: {
  product: Product;
  href: string;
  showCost: boolean;
  unitName: (key: string) => string;
  stock: string | undefined;
  showStock: boolean;
  actions: ReactNode;
}) {
  const t = useTranslations('dealership');
  const nameOf = useNameOf();
  return (
    <li className="rounded-card border border-border bg-surface p-4">
      <Link href={href} prefetch={false} className="block hover:underline">
        <span className="flex items-start justify-between gap-3">
          <span className="font-medium">{nameOf(product)}</span>
          <StatusBadge active={product.isActive} />
        </span>
        <span className="mt-1 block text-xs text-fg-muted">
          {product.code} · {nameOf(product.category)}
        </span>
        <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {showCost && 'lastPurchasePrice' in product ? (
            <span>
              <span className="text-fg-muted">{t('products.lastPurchasePrice')}: </span>
              <LastPrice value={product.lastPurchasePrice} />
            </span>
          ) : null}
          <span>
            <span className="text-fg-muted">{t('products.unit')}: </span>
            {unitName(product.unitKey)}
          </span>
          {showStock ? (
            <span>
              <span className="text-fg-muted">{t('products.currentStock')}: </span>
              <StockCell value={stock} />
            </span>
          ) : null}
        </span>
      </Link>
      <div className="mt-3 flex items-center justify-end gap-1">{actions}</div>
    </li>
  );
}

/** Last purchase price, read-only (from purchases); "—" until the first purchase. */
function LastPrice({ value }: { value: string | null | undefined }) {
  return value ? <Money value={value} /> : <span className="text-fg-muted">—</span>;
}

/** Current stock (a quantity string) or "—" while unknown. */
function StockCell({ value }: { value: string | undefined }) {
  const format = useFormat();
  return value !== undefined ? (
    <span className="font-semibold">{format.quantity(value)}</span>
  ) : (
    <span className="text-fg-muted">—</span>
  );
}
