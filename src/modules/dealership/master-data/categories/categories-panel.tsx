'use client';

import { Tags } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { EmptyState } from '@/core/ui/empty-state';
import { inputClass } from '@/core/ui/text-field';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { useCategories, useSaveCategory } from '../api';
import { StatusBadge, useNameOf } from '../shared/display';
import { useCategoryRequestTarget } from '../shared/correction';
import { DetailsLink, RowActions } from '../shared/row-actions';
import { ListSkeleton, LoadError, Notice } from '../shared/states';
import type { ActiveFilter, Category } from '../types';
import { CategoryDialog } from './category-dialog';

/**
 * Category list (small, no pages). Each row has a visible Details link and an Actions menu:
 * Edit (`product.manage`) and Deactivate/Activate (`product.deactivate`, reason required).
 */
export function CategoriesPanel({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const format = useFormat();
  const nameOf = useNameOf();
  const isDesktop = useIsDesktop();
  const canManage = useCan('product.manage');
  const canDeactivate = useCan('product.deactivate');
  const [active, setActive] = useState<ActiveFilter>('all');
  const query = useCategories(slug, businessId, active);
  const save = useSaveCategory(slug, businessId);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestTargetOf = useCategoryRequestTarget();
  const base = `/b/${encodeURIComponent(slug)}/products/categories`;

  const actions = (category: Category) => (
    <>
      <DetailsLink href={`${base}/${category.id}`} name={nameOf(category)} />
      <RowActions
        name={nameOf(category)}
        isActive={category.isActive}
        onEdit={canManage ? () => (setNotice(null), setEditing(category)) : undefined}
        canDeactivate={canDeactivate}
        onToggleActive={async (reason) => {
          await save.mutateAsync({
            id: category.id,
            body: { isActive: !category.isActive, reason },
          });
          setNotice(t('common.statusChanged'));
        }}
        requestTarget={requestTargetOf(category)}
        onRequestSent={setNotice}
      />
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-fg-muted">{t('categories.intro')}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium">
            <span className="mb-1.5 block">{t('common.statusFilter')}</span>
            <select
              value={active}
              onChange={(e) => setActive(e.target.value as ActiveFilter)}
              className={inputClass}
            >
              <option value="all">{t('common.all')}</option>
              <option value="true">{t('common.active')}</option>
              <option value="false">{t('common.inactive')}</option>
            </select>
          </label>
          {canManage ? (
            <Button onClick={() => (setNotice(null), setEditing('new'))}>
              {t('categories.new')}
            </Button>
          ) : null}
        </div>
      </div>
      <Notice>{notice}</Notice>

      {query.isPending ? (
        <ListSkeleton rows={3} />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={t('categories.emptyTitle')}
          description={t('categories.emptyDescription')}
        />
      ) : isDesktop ? (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('categories.sortOrder')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('common.nameEn')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('common.nameBn')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('common.status')}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  {t('common.actions')}
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
                    <Link
                      href={`${base}/${category.id}`}
                      prefetch={false}
                      className="hover:underline"
                    >
                      {category.nameEn}
                    </Link>
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
              <Link
                href={`${base}/${category.id}`}
                prefetch={false}
                className="block hover:underline"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-medium">{nameOf(category)}</span>
                  <StatusBadge active={category.isActive} />
                </span>
                <span className="mt-1 block text-xs text-fg-muted">
                  {t('categories.sortOrder')}: {format.number(category.sortOrder)}
                </span>
              </Link>
              <div className="mt-3 flex items-center justify-end gap-1">{actions(category)}</div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => setNotice(message)}
          slug={slug}
          businessId={businessId}
        />
      ) : null}
    </div>
  );
}
