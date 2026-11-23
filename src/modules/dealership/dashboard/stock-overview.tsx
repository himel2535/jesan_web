'use client';

import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { EmptyState } from '@/core/ui/empty-state';
import { useUnits } from '../master-data/api';
import { useNameOf } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { stockQuery } from '../stock/api';
import type { StockRow } from '../stock/types';

const MAX_VISIBLE_PRODUCTS = 8;

/**
 * Walks every page of `GET stock?active=true`, fetched in parallel via `useQueries` (bounded to
 * the real page count, never a sequential loop) — see DECISIONS.md "Stock Overview". `StockRow`
 * already carries `nameEn`/`nameBn`/`unitKey`/`currentStock` per product, so no cross-reference
 * against `product-categories` or `products` is needed.
 */
function useActiveStockRows(slug: string, businessId: string, enabled: boolean) {
  const firstPage = useQuery({
    ...stockQuery(slug, businessId, { active: 'true', page: 1 }),
    enabled,
  });

  const totalPages = firstPage.data ? Math.ceil(firstPage.data.total / firstPage.data.pageSize) : 0;
  const extraPageNumbers = useMemo(
    () => (totalPages > 1 ? Array.from({ length: totalPages - 1 }, (_, i) => i + 2) : []),
    [totalPages],
  );
  const extraPages = useQueries({
    queries: extraPageNumbers.map((page) => ({
      ...stockQuery(slug, businessId, { active: 'true', page }),
      enabled,
    })),
  });

  const isPending = enabled && (firstPage.isPending || extraPages.some((q) => q.isPending));
  const error = firstPage.error ?? extraPages.find((q) => q.error)?.error;
  const rows = useMemo<StockRow[] | undefined>(() => {
    if (!enabled || !firstPage.data) return undefined;
    return [...firstPage.data.items, ...extraPages.flatMap((q) => q.data?.items ?? [])];
  }, [enabled, firstPage.data, extraPages]);

  const refetch = () => {
    void firstPage.refetch();
    extraPages.forEach((q) => void q.refetch());
  };

  return { rows, isPending, error, refetch };
}

interface UnitGroup {
  unitKey: string;
  unitName: string;
  rows: StockRow[];
  total: number;
}

/** Groups rows by `unitKey` so quantities of incompatible units are never summed together. */
function groupByUnit(rows: StockRow[], unitNameOf: (key: string) => string): UnitGroup[] {
  const byUnit = new Map<string, StockRow[]>();
  for (const row of rows) {
    const list = byUnit.get(row.unitKey);
    if (list) list.push(row);
    else byUnit.set(row.unitKey, [row]);
  }
  return Array.from(byUnit.entries()).map(([unitKey, unitRows]) => ({
    unitKey,
    unitName: unitNameOf(unitKey),
    rows: unitRows,
    total: unitRows.reduce((sum, row) => sum + Number(row.currentStock), 0),
  }));
}

/**
 * All active products' current stock, grouped by unit (never cross-summed across units) — see
 * DECISIONS.md "Stock Overview" for why the previous OPC/PCC-name lookup was replaced with this
 * dynamic enumeration.
 */
export function StockOverview({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard.stockOverview');
  const format = useFormat();
  const canView = useCan('stock.view');
  const nameOf = useNameOf();
  const units = useUnits(slug, businessId);
  const stock = useActiveStockRows(slug, businessId, canView);

  const unitNameOf = (key: string) => {
    const unit = units.data?.items.find((u) => u.key === key);
    return unit ? nameOf(unit) : key;
  };

  const groups = useMemo(
    () => (stock.rows ? groupByUnit(stock.rows, unitNameOf) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unitNameOf is derived from units.data each render
    [stock.rows, units.data],
  );

  if (!canView) return null;

  const error = units.error ?? stock.error;
  const isPending = units.isPending || stock.isPending;
  const noProducts = !isPending && !error && groups?.length === 0;

  const visibleRows = groups?.flatMap((g) => g.rows) ?? [];
  const sortedRows = [...visibleRows].sort(
    (a, b) => Number(b.currentStock) - Number(a.currentStock),
  );
  const hasMore = sortedRows.length > MAX_VISIBLE_PRODUCTS;
  const shownRows = hasMore ? sortedRows.slice(0, MAX_VISIBLE_PRODUCTS) : sortedRows;

  return (
    <div className="flex flex-col rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--dash-fg)]">{t('title')}</h2>
        {hasMore && (
          <Link
            href={`/b/${encodeURIComponent(slug)}/stock`}
            prefetch={false}
            className="text-sm font-medium text-[var(--dash-primary)] underline-offset-2 hover:underline"
          >
            {t('viewAll')}
          </Link>
        )}
      </div>

      {error ? (
        <LoadError
          error={error}
          onRetry={() => {
            void units.refetch();
            stock.refetch();
          }}
        />
      ) : isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-5 w-full animate-pulse rounded bg-[var(--dash-bg)]" />
          ))}
        </div>
      ) : noProducts ? (
        <EmptyState icon={Boxes} title={t('noProducts')} />
      ) : (
        <dl className="flex flex-col gap-2 text-sm">
          {shownRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between">
              <dt className="truncate text-[var(--dash-fg-muted)]">{nameOf(row)}</dt>
              <dd className="shrink-0 pl-2 font-medium text-[var(--dash-fg)]">
                {t('bags', {
                  count: format.quantity(row.currentStock),
                  unit: unitNameOf(row.unitKey),
                })}
              </dd>
            </div>
          ))}

          {groups && groups.length > 0 && (
            <div className="space-y-1 border-t border-[var(--dash-border)] pt-2">
              {groups.map((group) => (
                <div key={group.unitKey} className="flex items-center justify-between">
                  <dt className="font-semibold text-[var(--dash-fg)]">
                    {groups.length > 1
                      ? t('subtotalFor', { unit: group.unitName })
                      : t('totalStock')}
                  </dt>
                  <dd className="font-semibold text-[var(--dash-primary)]">
                    {t('bags', { count: format.quantity(group.total), unit: group.unitName })}
                  </dd>
                </div>
              ))}
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
