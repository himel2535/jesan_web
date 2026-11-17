'use client';

import { Pencil, Tags } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { EmptyState } from '@/core/ui/empty-state';
import { inputClass } from '@/core/ui/text-field';
import { useCategories, useSaveCategory } from '../api';
import { DeactivateDialog } from '../shared/deactivate-dialog';
import { StatusBadge } from '../shared/display';
import { ListSkeleton, LoadError, Notice } from '../shared/states';
import type { ActiveFilter, Category } from '../types';
import { CategoryDialog } from './category-dialog';

/** Category list (small, no pages) with create/edit for `product.manage`. */
export function CategoriesPanel({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const format = useFormat();
  const canManage = useCan('product.manage');
  const canDeactivate = useCan('product.deactivate');
  const [active, setActive] = useState<ActiveFilter>('all');
  const query = useCategories(slug, businessId, active);
  const save = useSaveCategory(slug, businessId);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [statusOf, setStatusOf] = useState<Category | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      ) : (
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
                {canManage || canDeactivate ? (
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t('common.edit')}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {query.data.map((category) => (
                <tr key={category.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 tabular-nums">{format.number(category.sortOrder)}</td>
                  <th scope="row" className="px-4 py-3 font-medium">
                    {category.nameEn}
                  </th>
                  <td className="px-4 py-3">{category.nameBn}</td>
                  <td className="px-4 py-3">
                    <StatusBadge active={category.isActive} />
                  </td>
                  {canManage || canDeactivate ? (
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {canManage ? (
                        <Button
                          variant="ghost"
                          onClick={() => (setNotice(null), setEditing(category))}
                          aria-label={t('categories.actionsFor', { name: category.nameEn })}
                        >
                          <Pencil aria-hidden className="size-4" />
                        </Button>
                      ) : null}
                      {canDeactivate ? (
                        <Button
                          variant="ghost"
                          onClick={() => (setNotice(null), setStatusOf(category))}
                        >
                          {category.isActive ? t('common.deactivate') : t('common.activate')}
                        </Button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={setNotice}
          slug={slug}
          businessId={businessId}
        />
      ) : null}
      <DeactivateDialog
        open={statusOf !== null}
        name={statusOf?.nameEn ?? ''}
        currentlyActive={statusOf?.isActive ?? true}
        onCancel={() => setStatusOf(null)}
        onConfirm={async (reason) => {
          if (!statusOf) return;
          await save.mutateAsync({
            id: statusOf.id,
            body: { isActive: !statusOf.isActive, reason },
          });
          setStatusOf(null);
          setNotice(t('common.statusChanged'));
        }}
      />
    </div>
  );
}
