'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RequestChangeButton } from '@/core/approvals/request-dialog';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/core/ui/page-header';
import { DeactivateDialog } from '../../master-data/shared/deactivate-dialog';
import { DetailList, type DetailRow } from '../../master-data/shared/detail-list';
import { StatusBadge, useNameOf } from '../../master-data/shared/display';
import { DetailSkeleton, LoadError, Notice } from '../../master-data/shared/states';
import { useExpenseCategories, useSaveExpenseCategory } from '../api';
import { useExpenseCategoryRequestTarget } from '../correction';
import { ExpenseCategoryDialog } from './expense-category-dialog';

/**
 * One expense type. Types are a small, unpaged list, so this reads the same cached list
 * (`active=all`) instead of a separate request; an unknown id shows "not found".
 */
export function ExpenseCategoryDetail({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership.expenses.categories');
  const tc = useTranslations('dealership.common');
  const format = useFormat();
  const nameOf = useNameOf();
  const canManage = useCan('expense.category.manage');
  const query = useExpenseCategories(slug, businessId, 'all');
  const save = useSaveExpenseCategory(slug, businessId);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const requestTargetOf = useExpenseCategoryRequestTarget();
  const base = `/b/${encodeURIComponent(slug)}/expenses`;

  if (query.isPending) return <DetailSkeleton lines={4} />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const category = query.data.find((c) => c.id === id);
  if (!category) {
    return (
      <div className="space-y-4">
        <PageHeader title={tc('notFoundTitle')} description={tc('notFoundDescription')} />
        <Link
          href={`${base}/categories`}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {tc('back')}
        </Link>
      </div>
    );
  }

  const rows: DetailRow[] = [
    { label: tc('nameEn'), value: category.nameEn },
    { label: tc('nameBn'), value: category.nameBn },
    { label: t('sortOrder'), value: format.number(category.sortOrder) },
    { label: tc('status'), value: <StatusBadge active={category.isActive} /> },
    { label: tc('createdAt'), value: format.date(category.createdAt) },
    {
      label: tc('updatedAt'),
      value: format.date(category.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
    },
  ];

  const requestTarget = requestTargetOf(category);

  return (
    <>
      <PageHeader
        title={nameOf(category)}
        description={t('detailTitle')}
        actions={
          <>
            {requestTarget ? (
              <RequestChangeButton slug={slug} target={requestTarget} onSent={setNotice} />
            ) : null}
            {canManage ? (
              <Button
                variant={category.isActive ? 'danger' : 'secondary'}
                onClick={() => (setNotice(null), setConfirming(true))}
              >
                {category.isActive ? tc('deactivate') : tc('activate')}
              </Button>
            ) : null}
            {canManage ? (
              <Button onClick={() => (setNotice(null), setEditing(true))}>{tc('edit')}</Button>
            ) : null}
          </>
        }
      />
      <div className="space-y-4">
        <Notice>{notice}</Notice>
        <DetailList rows={rows} />
        <Link
          href={`${base}/categories`}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {tc('back')}
        </Link>
      </div>
      {editing ? (
        <ExpenseCategoryDialog
          category={category}
          onClose={() => setEditing(false)}
          onSaved={setNotice}
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
          setNotice(tc('statusChanged'));
        }}
      />
    </>
  );
}
