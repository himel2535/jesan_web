'use client';

import { Plus, ShoppingCart, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { useSuppliers } from '../master-data/api';
import { Money, useNameOf } from '../master-data/shared/display';
import { DetailsLink } from '../master-data/shared/row-actions';
import { ListEmpty, ListSkeleton, LoadError } from '../master-data/shared/states';
import { usePurchases } from './api';
import { ProductPicker } from './product-picker';
import { usePurchaseSummaryRanges } from './shared';
import { PurchasesSummaryCards } from './summary-cards';
import type { PurchaseFilters, PurchaseStatus, PurchaseSummary } from './types';

const buttonLink =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Filters live in the URL (?from=&to=&supplierId=&productId=&status=&page=). */
function usePurchaseFilters(): PurchaseFilters {
  const p = useSearchParams();
  const date = (key: string) => {
    const v = p.get(key);
    return v && DATE.test(v) ? v : undefined;
  };
  const status = p.get('status');
  return {
    from: date('from'),
    to: date('to'),
    supplierId: p.get('supplierId') || undefined,
    productId: p.get('productId') || undefined,
    status: status === 'active' || status === 'void' ? (status as PurchaseStatus) : undefined,
    page: parsePageParam(p.get('page')),
  };
}

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  const t = useTranslations('dealership.purchases.status');
  return (
    <span className={cn('text-sm font-medium', status === 'void' ? 'text-danger' : 'text-success')}>
      {t(status)}
    </span>
  );
}

/**
 * Purchases, 10 per page, newest first. The total column exists only when the API sends
 * `totalAmount` (product.cost.view); otherwise no space is kept for it.
 */
export function PurchasesList({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.purchases');
  const id = useId();
  const format = useFormat();
  const nameOf = useNameOf();
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Entering a purchase needs the price permission too (prices are typed in).
  const mayCreate = useCan('purchase.create');
  const maySeeCost = useCan('product.cost.view');
  const canCreate = mayCreate && maySeeCost;
  const tc = useTranslations('dealership.common');
  const filters = usePurchaseFilters();
  const query = usePurchases(slug, businessId, filters);
  const summaryRanges = usePurchaseSummaryRanges();
  const suppliers = useSuppliers(slug, businessId, { active: 'all', page: 1 });
  // Name of a product picked in this session (the URL keeps only the id).
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const base = `/b/${encodeURIComponent(slug)}/purchases`;

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

  const items = query.data?.items ?? [];
  const showAmount = items.some((p) => 'totalAmount' in p);
  const filtered = Boolean(
    filters.from || filters.to || filters.supplierId || filters.productId || filters.status,
  );
  const when = (iso: string) => format.date(`${iso}T00:00:00+06:00`);

  const label = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {text}
    </label>
  );

  return (
    <div className="space-y-4">
      <PurchasesSummaryCards slug={slug} businessId={businessId} ranges={summaryRanges} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            {label(`${id}-from`, t('filters.from'))}
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
            {label(`${id}-to`, t('filters.to'))}
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
            {label(`${id}-supplier`, t('supplier'))}
            <select
              id={`${id}-supplier`}
              value={filters.supplierId ?? ''}
              onChange={(e) => setParams({ supplierId: e.target.value || undefined })}
              className={inputClass}
            >
              <option value="">{t('filters.supplierAll')}</option>
              {(suppliers.data?.items ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {nameOf(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            {label(`${id}-status`, t('status.label'))}
            <select
              id={`${id}-status`}
              value={filters.status ?? ''}
              onChange={(e) => setParams({ status: e.target.value || undefined })}
              className={inputClass}
            >
              <option value="">{t('status.all')}</option>
              <option value="active">{t('status.active')}</option>
              <option value="void">{t('status.void')}</option>
            </select>
          </div>
          <div>
            {label(`${id}-product`, t('filters.product'))}
            {filters.productId ? (
              <div className="flex min-h-10 flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-border px-3 py-1">
                  {t('filters.productChip', {
                    name: pickedName ?? t('filters.productChipUnknown'),
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => (setPickedName(null), setParams({ productId: undefined }))}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 font-medium underline"
                >
                  <X aria-hidden className="size-4" />
                  {t('filters.clearProduct')}
                </button>
              </div>
            ) : (
              <button
                id={`${id}-product`}
                type="button"
                aria-expanded={picking}
                onClick={() => setPicking((v) => !v)}
                className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 font-medium hover:bg-surface-muted"
              >
                {t('filters.product')}
              </button>
            )}
          </div>
        </div>
        {canCreate ? (
          <Link href={`${base}/new`} prefetch={false} className={buttonLink}>
            <Plus aria-hidden className="size-4" />
            {t('new')}
          </Link>
        ) : null}
      </div>

      {picking && !filters.productId ? (
        <div className="max-w-xl">
          <ProductPicker
            slug={slug}
            businessId={businessId}
            label={t('filters.product')}
            onPick={(p) => {
              setPickedName(nameOf(p));
              setPicking(false);
              setParams({ productId: p.id });
            }}
          />
        </div>
      ) : null}

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <ListEmpty
          filtered={filtered}
          icon={ShoppingCart}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          onClear={() =>
            setParams({
              from: undefined,
              to: undefined,
              supplierId: undefined,
              productId: undefined,
              status: undefined,
            })
          }
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
                        {t('code')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('date')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('supplier')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('lines')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('totalQuantity')}
                      </th>
                      {showAmount ? (
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          {t('totalAmount')}
                        </th>
                      ) : null}
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('status.label')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('createdBy')}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">{tc('details')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <PurchaseRow
                        key={p.id}
                        purchase={p}
                        href={`${base}/${p.id}`}
                        showAmount={showAmount}
                        date={when(p.purchaseDate)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((p) => (
                  <li key={p.id} className="rounded-card border border-border bg-surface p-4">
                    <Link
                      href={`${base}/${p.id}`}
                      prefetch={false}
                      className="block hover:underline"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-mono font-medium">{p.code}</span>
                        <PurchaseStatusBadge status={p.status} />
                      </span>
                      <span className="mt-1 block text-xs text-fg-muted">
                        {when(p.purchaseDate)} · {nameOf(p.supplier)}
                      </span>
                    </Link>
                    <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
                      <span>
                        <span className="text-fg-muted">{t('totalQuantity')}: </span>
                        <span className="tabular-nums">{format.quantity(p.totalQuantity)}</span>
                      </span>
                      {showAmount && p.totalAmount !== undefined ? (
                        <span>
                          <span className="text-fg-muted">{t('totalAmount')}: </span>
                          <Money value={p.totalAmount} />
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <DetailsLink href={`${base}/${p.id}`} name={p.code} />
                    </div>
                  </li>
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

function PurchaseRow({
  purchase: p,
  href,
  showAmount,
  date,
}: {
  purchase: PurchaseSummary;
  href: string;
  showAmount: boolean;
  date: string;
}) {
  const format = useFormat();
  const nameOf = useNameOf();
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-muted">
      <th scope="row" className="px-4 py-3 font-mono font-medium whitespace-nowrap">
        <Link href={href} prefetch={false} className="hover:underline">
          {p.code}
        </Link>
      </th>
      <td className="px-4 py-3 whitespace-nowrap">{date}</td>
      <td className="px-4 py-3">{nameOf(p.supplier)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{format.number(p.itemCount)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{format.quantity(p.totalQuantity)}</td>
      {showAmount ? (
        <td className="px-4 py-3 text-right">
          {p.totalAmount !== undefined ? <Money value={p.totalAmount} /> : null}
        </td>
      ) : null}
      <td className="px-4 py-3">
        <PurchaseStatusBadge status={p.status} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-fg-muted">{p.createdBy.name}</td>
      <td className="px-4 py-2 text-right">
        <DetailsLink href={href} name={p.code} />
      </td>
    </tr>
  );
}
