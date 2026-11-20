'use client';

import { Plus, Receipt, Tags } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useCan } from '@/core/auth/can';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { inputClass } from '@/core/ui/text-field';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { Money, useNameOf } from '../master-data/shared/display';
import { DetailsLink } from '../master-data/shared/row-actions';
import { ListEmpty, LoadError } from '../master-data/shared/states';
import { useExpenseCategories, useExpenseMethods, useExpenses } from './api';
import { ListSkeleton } from './skeletons';
import { StatusText, dateParam, useBusinessDay, useMethodLabel, useSetFilters } from './shared';
import type { ExpenseFilters } from './types';

const buttonLink =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90';
const linkButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-muted';

function useExpenseFilters(): ExpenseFilters {
  const p = useSearchParams();
  const status = p.get('status');
  return {
    categoryId: p.get('categoryId') || undefined,
    method: p.get('method') || undefined,
    status: status === 'active' || status === 'void' ? status : undefined,
    from: dateParam(p, 'from'),
    to: dateParam(p, 'to'),
    page: parsePageParam(p.get('page')),
  };
}

/** Expenses, 10 per page, newest first (`expense.view`). */
export function ExpensesList({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.expenses');
  const tc = useTranslations('dealership.common');
  const tx = useTranslations('dealership.expenses.common');
  const id = useId();
  const nameOf = useNameOf();
  const day = useBusinessDay();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const methodLabel = useMethodLabel();
  const setFilters = useSetFilters();
  const canCreate = useCan('expense.create');
  const canManageCategories = useCan('expense.category.manage');
  const filters = useExpenseFilters();
  const query = useExpenses(slug, businessId, filters);
  const categories = useExpenseCategories(slug, businessId, 'all');
  const methods = useExpenseMethods(slug, businessId, canCreate || Boolean(filters.method));
  const base = `/b/${encodeURIComponent(slug)}/expenses`;

  const items = query.data?.items ?? [];
  const filtered = Boolean(
    filters.status || filters.categoryId || filters.method || filters.from || filters.to,
  );

  const label = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {text}
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            {label(`${id}-from`, t('filters.from'))}
            <input
              id={`${id}-from`}
              type="date"
              value={filters.from ?? ''}
              max={filters.to}
              onChange={(e) => setFilters({ from: e.target.value || undefined })}
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
              onChange={(e) => setFilters({ to: e.target.value || undefined })}
              className={inputClass}
            />
          </div>
          {categories.data && categories.data.length > 0 ? (
            <div>
              {label(`${id}-category`, t('category'))}
              <select
                id={`${id}-category`}
                value={filters.categoryId ?? ''}
                onChange={(e) => setFilters({ categoryId: e.target.value || undefined })}
                className={inputClass}
              >
                <option value="">{t('categoryAll')}</option>
                {categories.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nameOf(c)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {methods.data && methods.data.length > 0 ? (
            <div>
              {label(`${id}-method`, t('method'))}
              <select
                id={`${id}-method`}
                value={filters.method ?? ''}
                onChange={(e) => setFilters({ method: e.target.value || undefined })}
                className={inputClass}
              >
                <option value="">{t('methodAll')}</option>
                {methods.data.map((m) => (
                  <option key={m} value={m}>
                    {methodLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            {label(`${id}-status`, t('status.label'))}
            <select
              id={`${id}-status`}
              value={filters.status ?? ''}
              onChange={(e) => setFilters({ status: e.target.value || undefined })}
              className={inputClass}
            >
              <option value="">{t('status.all')}</option>
              <option value="active">{t('status.active')}</option>
              <option value="void">{t('status.void')}</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageCategories ? (
            <Link href={`${base}/categories`} prefetch={false} className={linkButton}>
              <Tags aria-hidden className="size-4" />
              {t('manageCategories')}
            </Link>
          ) : null}
          {canCreate ? (
            <Link href={`${base}/new`} prefetch={false} className={buttonLink}>
              <Plus aria-hidden className="size-4" />
              {t('new')}
            </Link>
          ) : null}
        </div>
      </div>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <ListEmpty
          filtered={filtered}
          icon={Receipt}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          onClear={() =>
            setFilters({
              status: undefined,
              categoryId: undefined,
              method: undefined,
              from: undefined,
              to: undefined,
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
                        {tc('code')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {tx('date')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('category')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('method')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {tx('amount')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('status.label')}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">{tc('details')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((e) => {
                      const href = `${base}/${e.id}`;
                      const prefetch = () => router.prefetch(href);
                      return (
                        <tr
                          key={e.id}
                          className="border-b border-border last:border-0 hover:bg-surface-muted"
                          onMouseEnter={prefetch}
                          onFocus={prefetch}
                        >
                          <th
                            scope="row"
                            className="px-4 py-3 font-mono font-medium whitespace-nowrap"
                          >
                            <Link href={href} prefetch={false} className="hover:underline">
                              {e.code}
                            </Link>
                          </th>
                          <td className="px-4 py-3 whitespace-nowrap">{day(e.expenseDate)}</td>
                          <td className="px-4 py-3">{nameOf(e.category)}</td>
                          <td className="px-4 py-3">{methodLabel(e.method)}</td>
                          <td className="px-4 py-3 text-right">
                            <Money value={e.amount} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusText status={e.status} />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <DetailsLink href={href} name={e.code} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((e) => (
                  <li key={e.id} className="rounded-card border border-border bg-surface p-4">
                    <Link
                      href={`${base}/${e.id}`}
                      prefetch={false}
                      className="block hover:underline"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-mono font-medium">{e.code}</span>
                        <StatusText status={e.status} />
                      </span>
                      <span className="mt-1 block text-xs text-fg-muted">
                        {day(e.expenseDate)} · {nameOf(e.category)} · {methodLabel(e.method)}
                      </span>
                    </Link>
                    <p className="mt-2 text-sm">
                      <span className="text-fg-muted">{tx('amount')}: </span>
                      <Money value={e.amount} />
                    </p>
                    <div className="mt-3 flex justify-end">
                      <DetailsLink href={`${base}/${e.id}`} name={e.code} />
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
