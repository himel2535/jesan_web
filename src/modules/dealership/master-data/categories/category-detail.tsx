'use client';

import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/core/ui/page-header';
import { useCategories, useSaveCategory } from '../api';
import { CorrectionSection, useCategoryRequestTarget } from '../shared/correction';
import { DeactivateDialog } from '../shared/deactivate-dialog';
import { DetailList, type DetailRow } from '../shared/detail-list';
import { StatusBadge, useNameOf } from '../shared/display';
import { ListSkeleton, LoadError, Notice } from '../shared/states';
import { CategoryDialog } from './category-dialog';

/**
 * One category. Categories are a small, unpaged list, so this reads the same cached list
 * (`active=all`) instead of a separate request; an unknown id shows "not found".
 */
export function CategoryDetail({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership');
  const format = useFormat();
  const nameOf = useNameOf();
  const canManage = useCan('product.manage');
  const canDeactivate = useCan('product.deactivate');
  const query = useCategories(slug, businessId, 'all');
  const save = useSaveCategory(slug, businessId);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const requestTargetOf = useCategoryRequestTarget();
  const base = `/b/${encodeURIComponent(slug)}/products`;

  if (query.isPending) return <ListSkeleton rows={4} />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const category = query.data.find((c) => c.id === id);
  if (!category) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('common.notFoundTitle')}
          description={t('common.notFoundDescription')}
        />
        <Link
          href={`${base}/categories`}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {t('common.back')}
        </Link>
      </div>
    );
  }

  const rows: DetailRow[] = [
    { label: t('common.nameEn'), value: category.nameEn },
    { label: t('common.nameBn'), value: category.nameBn },
    { label: t('categories.sortOrder'), value: format.number(category.sortOrder) },
    { label: t('common.status'), value: <StatusBadge active={category.isActive} /> },
    { label: t('common.createdAt'), value: format.date(category.createdAt) },
    {
      label: t('common.updatedAt'),
      value: format.date(category.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
    },
  ];

  return (
    <>
      <PageHeader
        title={nameOf(category)}
        description={t('categories.detailTitle')}
        actions={
          <>
            {canDeactivate ? (
              <Button
                variant={category.isActive ? 'danger' : 'secondary'}
                onClick={() => (setNotice(null), setConfirming(true))}
              >
                {category.isActive ? t('common.deactivate') : t('common.activate')}
              </Button>
            ) : null}
            {canManage ? (
              <Button onClick={() => (setNotice(null), setEditing(true))}>
                <Pencil aria-hidden className="size-4" />
                {t('common.edit')}
              </Button>
            ) : null}
          </>
        }
      />
      <div className="space-y-4">
        <Notice>{notice}</Notice>
        <DetailList rows={rows} />
        <CorrectionSection slug={slug} target={requestTargetOf(category)} onSent={setNotice} />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link
            href={`${base}?category=${encodeURIComponent(category.id)}`}
            prefetch={false}
            className="inline-block text-sm font-medium text-primary underline"
          >
            {t('categories.productsInCategory')}
          </Link>
          <Link
            href={`${base}/categories`}
            prefetch={false}
            className="inline-block text-sm font-medium text-fg underline"
          >
            {t('common.back')}
          </Link>
        </div>
      </div>
      {editing ? (
        <CategoryDialog
          category={category}
          onClose={() => setEditing(false)}
          onSaved={(message) => setNotice(message)}
          slug={slug}
          businessId={businessId}
        />
      ) : null}
      <DeactivateDialog
        open={confirming}
        name={nameOf(category)}
        currentlyActive={category.isActive}
        onCancel={() => setConfirming(false)}
        onConfirm={async (reason) => {
          await save.mutateAsync({
            id: category.id,
            body: { isActive: !category.isActive, reason },
          });
          setConfirming(false);
          setNotice(t('common.statusChanged'));
        }}
      />
    </>
  );
}
