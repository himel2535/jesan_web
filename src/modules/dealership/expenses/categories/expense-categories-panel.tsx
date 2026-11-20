'use client';

import { Tags } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { EmptyState } from '@/core/ui/empty-state';
import { inputClass } from '@/core/ui/text-field';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { StatusBadge, useNameOf } from '../../master-data/shared/display';
import { DetailsLink, RowActions } from '../../master-data/shared/row-actions';
import { ListSkeleton, LoadError, Notice } from '../../master-data/shared/states';
import type { ActiveFilter } from '../../master-data/types';
import { useExpenseCategories, useSaveExpenseCategory } from '../api';
import { useExpenseCategoryRequestTarget } from '../correction';
import type { ExpenseCategory } from '../types';
import { ExpenseCategoryDialog } from './expense-category-dialog';

/**
 * Expense types: a small, unpaged list (`expense.category.manage`). Each row has a visible
 * Details link and an Actions menu: Edit and Deactivate/Activate (reason required). No hard
 * delete — an already-used type keeps showing on its old expenses.
 */
export function ExpenseCategoriesPanel({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.expenses.categories');
  const tc = useTranslations('dealership.common');
  const format = useFormat();
  const nameOf = useNameOf();
  const isDesktop = useIsDesktop();
  const canManage = useCan('expense.category.manage');
  const [active, setActive] = useState<ActiveFilter>('all');
  const query = useExpenseCategories(slug, businessId, active);
  const save = useSaveExpenseCategory(slug, businessId);
  const [editing, setEditing] = useState<ExpenseCategory | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestTargetOf = useExpenseCategoryRequestTarget();
  const base = `/b/${encodeURIComponent(slug)}/expenses/categories`;

  const actions = (category: ExpenseCategory) => (
    <>
      <DetailsLink href={`${base}/${category.id}`} name={nameOf(category)} />
      <RowActions
        name={nameOf(category)}
        isActive={category.isActive}
        onEdit={canManage ? () => (setNotice(null), setEditing(category)) : undefined}
        canDeactivate={canManage}
        onToggleActive={async (reason) => {
          await save.mutateAsync({
            id: category.id,
            body: { isActive: !category.isActive, reason },
          });
          setNotice(tc('statusChanged'));
        }}
        requestTarget={requestTargetOf(category)}
        onRequestSent={setNotice}
      />
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-fg-muted">{t('intro')}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium">
            <span className="mb-1.5 block">{tc('statusFilter')}</span>
            <select
              value={active}
              onChange={(e) => setActive(e.target.value as ActiveFilter)}
              className={inputClass}
            >
              <option value="all">{tc('all')}</option>
              <option value="true">{tc('active')}</option>
              <option value="false">{tc('inactive')}</option>
            </select>
          </label>
          {canManage ? (
            <Button onClick={() => (setNotice(null), setEditing('new'))}>{t('new')}</Button>
          ) : null}
        </div>
      </div>
      <Notice>{notice}</Notice>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState icon={Tags} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : isDesktop ? (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('sortOrder')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {tc('nameEn')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {tc('nameBn')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {tc('status')}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  {tc('actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((category) => (
                <tr
                  key={category.id}
                  className="border-b border-border last:border-0 hover:bg-surface-muted"
                >
                  <td className="px-4 py-3 tabular-nums">{format.number(category.sortOrder)}</td>
                  <th scope="row" className="px-4 py-3 font-medium">
                    {category.nameEn}
                  </th>
                  <td className="px-4 py-3">{category.nameBn}</td>
                  <td className="px-4 py-3">
                    <StatusBadge active={category.isActive} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">{actions(category)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-2">
          {query.data.map((category) => (
            <li key={category.id} className="rounded-card border border-border bg-surface p-4">
              <span className="flex items-start justify-between gap-3">
                <span className="font-medium">{nameOf(category)}</span>
                <StatusBadge active={category.isActive} />
              </span>
              <span className="mt-1 block text-xs text-fg-muted">
                {t('sortOrder')}: {format.number(category.sortOrder)}
              </span>
              <div className="mt-3 flex items-center justify-end gap-1">{actions(category)}</div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ExpenseCategoryDialog
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={setNotice}
          slug={slug}
          businessId={businessId}
        />
      ) : null}
    </div>
  );
}
