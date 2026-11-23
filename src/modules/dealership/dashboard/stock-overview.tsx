'use client';

import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Boxes } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { localizedName } from '@/core/auth/types';
import { useFormat } from '@/core/i18n/use-format';
import { EmptyState } from '@/core/ui/empty-state';
import { useCategories, useUnits } from '../master-data/api';
import { useNameOf } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { stockQuery } from '../stock/api';

/** The business's default unit name (বস্তা for Akij Cement) — stock quantities are never "bags" in code. */
function useDefaultUnitName(slug: string, businessId: string) {
  const locale = useLocale();
  const units = useUnits(slug, businessId);
  const unit = units.data?.items.find((u) => u.key === units.data?.defaultUnitKey);
  return { isPending: units.isPending, name: unit ? localizedName(unit, locale) : '' };
}

/**
 * Sums `currentStock` across every page of one category's stock list. There is no backend
 * per-category aggregate endpoint (see DECISIONS.md "Stock Overview"), so this walks all pages —
 * bounded to the category's real page count, fetched in parallel via `useQueries`, never a
 * sequential loop. For a dealership's small SKU count per category this is almost always 1 page.
 */
function useCategoryStockTotal(slug: string, businessId: string, categoryId: string | undefined) {
  const enabled = Boolean(categoryId);
  const firstPage = useQuery({
    ...stockQuery(slug, businessId, { categoryId, page: 1 }),
    enabled,
  });

  const totalPages = firstPage.data ? Math.ceil(firstPage.data.total / firstPage.data.pageSize) : 0;
  const extraPageNumbers = useMemo(
    () => (totalPages > 1 ? Array.from({ length: totalPages - 1 }, (_, i) => i + 2) : []),
    [totalPages],
  );
  const extraPages = useQueries({
    queries: extraPageNumbers.map((page) => ({
      ...stockQuery(slug, businessId, { categoryId, page }),
      enabled,
    })),
  });

  const isPending = enabled && (firstPage.isPending || extraPages.some((q) => q.isPending));
  const error = firstPage.error ?? extraPages.find((q) => q.error)?.error;
  const total = useMemo(() => {
    if (!enabled || !firstPage.data) return undefined;
    const rows = [...firstPage.data.items, ...extraPages.flatMap((q) => q.data?.items ?? [])];
    return rows.reduce((sum, row) => sum + Number(row.currentStock), 0);
  }, [enabled, firstPage.data, extraPages]);

  const refetch = () => {
    void firstPage.refetch();
    extraPages.forEach((q) => void q.refetch());
  };

  return { total, isPending, error, refetch };
}

/**
 * OPC/PCC cement bag totals + grand total, composed client-side from `product-categories` +
 * `stock?categoryId=` (`stock.view`) since no per-category aggregate endpoint exists.
 */
export function StockOverview({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard.stockOverview');
  const format = useFormat();
  const canView = useCan('stock.view');
  const nameOf = useNameOf();
  const unit = useDefaultUnitName(slug, businessId);

  const categories = useCategories(slug, businessId, 'true');
  const opcCategory = categories.data?.find((c) => c.nameEn.trim().toUpperCase() === 'OPC');
  const pccCategory = categories.data?.find((c) => c.nameEn.trim().toUpperCase() === 'PCC');

  const opc = useCategoryStockTotal(slug, businessId, canView ? opcCategory?.id : undefined);
  const pcc = useCategoryStockTotal(slug, businessId, canView ? pccCategory?.id : undefined);

  if (!canView) return null;

  const error = categories.error ?? opc.error ?? pcc.error;
  const isPending = categories.isPending || opc.isPending || pcc.isPending || unit.isPending;
  const noCategories = !categories.isPending && !opcCategory && !pccCategory;
  const totalStock =
    opc.total !== undefined && pcc.total !== undefined ? opc.total + pcc.total : undefined;

  return (
    <div className="flex h-full flex-col rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
      <h2 className="mb-4 text-base font-semibold text-[var(--dash-fg)]">{t('title')}</h2>

      {error ? (
        <LoadError
          error={error}
          onRetry={() => {
            void categories.refetch();
            opc.refetch();
            pcc.refetch();
          }}
        />
      ) : isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-5 w-full animate-pulse rounded bg-[var(--dash-bg)]" />
          ))}
        </div>
      ) : noCategories ? (
        <EmptyState icon={Boxes} title={t('noCategories')} />
      ) : (
        <dl className="flex flex-1 flex-col justify-between gap-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-[var(--dash-fg-muted)]">
              {opcCategory ? nameOf(opcCategory) : t('opc')}
            </dt>
            <dd className="font-medium text-[var(--dash-fg)]">
              {opc.total !== undefined
                ? t('bags', { count: format.quantity(opc.total), unit: unit.name })
                : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[var(--dash-fg-muted)]">
              {pccCategory ? nameOf(pccCategory) : t('pcc')}
            </dt>
            <dd className="font-medium text-[var(--dash-fg)]">
              {pcc.total !== undefined
                ? t('bags', { count: format.quantity(pcc.total), unit: unit.name })
                : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--dash-border)] pt-2">
            <dt className="font-semibold text-[var(--dash-fg)]">{t('totalStock')}</dt>
            <dd className="font-semibold text-[var(--dash-fg)]">
              {totalStock !== undefined
                ? t('bags', { count: format.quantity(totalStock), unit: unit.name })
                : '—'}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
