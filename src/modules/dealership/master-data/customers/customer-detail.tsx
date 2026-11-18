'use client';

import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/core/ui/page-header';
import { useCustomer, useSaveCustomer } from '../api';
import { CorrectionSection, useCustomerRequestTarget } from '../shared/correction';
import { DeactivateDialog } from '../shared/deactivate-dialog';
import { DetailList, type DetailRow } from '../shared/detail-list';
import { Balance, StatusBadge, useNameOf } from '../shared/display';
import { ListSkeleton, LoadError, Notice } from '../shared/states';
import { CreditLimit, hasDueFields } from './customers-list';
import { CustomerForm } from './customer-form';

export function CustomerDetail({
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
  const saved = useSearchParams().get('saved');
  const canManage = useCan('customer.manage');
  const canDeactivate = useCan('customer.deactivate');
  const query = useCustomer(slug, businessId, id);
  const save = useSaveCustomer(slug, businessId);
  const requestTarget = useCustomerRequestTarget(query.data);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    saved === 'created' ? t('common.created') : saved === 'updated' ? t('common.saved') : null,
  );
  const base = `/b/${encodeURIComponent(slug)}/customers`;

  if (query.isPending) return <ListSkeleton rows={6} />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const c = query.data;

  const rows: DetailRow[] = [
    { label: t('common.code'), value: <span className="font-mono">{c.code}</span> },
    { label: t('common.nameEn'), value: c.nameEn },
    { label: t('common.nameBn'), value: c.nameBn ?? '—' },
    { label: t('common.phone'), value: <span className="tabular-nums">{c.phone}</span> },
    { label: t('common.address'), value: c.address ?? '—' },
    { label: t('common.area'), value: c.area ?? '—' },
    // Only when the API sent them (customer.due.view); otherwise these rows do not exist.
    ...(hasDueFields(c)
      ? [
          { label: t('customers.currentBalance'), value: <Balance value={c.currentBalance} /> },
          ...(c.openingBalance !== undefined
            ? [
                {
                  label: t('customers.openingBalance'),
                  value: <Balance value={c.openingBalance} />,
                },
              ]
            : []),
          { label: t('customers.creditLimit'), value: <CreditLimit value={c.creditLimit} /> },
        ]
      : []),
    { label: t('common.status'), value: <StatusBadge active={c.isActive} /> },
    { label: t('common.createdAt'), value: format.date(c.createdAt) },
    {
      label: t('common.updatedAt'),
      value: format.date(c.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
    },
  ];

  return (
    <>
      <PageHeader
        title={nameOf(c)}
        description={c.code}
        actions={
          <>
            {canDeactivate ? (
              <Button
                variant={c.isActive ? 'danger' : 'secondary'}
                onClick={() => (setNotice(null), setConfirming(true))}
              >
                {c.isActive ? t('common.deactivate') : t('common.activate')}
              </Button>
            ) : null}
            {canManage ? (
              <Link
                href={`${base}/${c.id}/edit`}
                prefetch={false}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90"
              >
                <Pencil aria-hidden className="size-4" />
                {t('common.edit')}
              </Link>
            ) : null}
          </>
        }
      />
      <div className="space-y-4">
        <Notice>{notice}</Notice>
        <DetailList rows={rows} />
        <CorrectionSection slug={slug} target={requestTarget} onSent={setNotice} />
        <Link
          href={base}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {t('common.back')}
        </Link>
      </div>
      <DeactivateDialog
        open={confirming}
        name={nameOf(c)}
        currentlyActive={c.isActive}
        onCancel={() => setConfirming(false)}
        onConfirm={async (reason) => {
          await save.mutateAsync({ id: c.id, body: { isActive: !c.isActive, reason } });
          setConfirming(false);
          setNotice(t('common.statusChanged'));
        }}
      />
    </>
  );
}

export function CustomerEdit({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership.customers');
  const nameOf = useNameOf();
  const query = useCustomer(slug, businessId, id);
  if (query.isPending) return <ListSkeleton rows={6} />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <>
      <PageHeader
        title={t('editTitle', { name: nameOf(query.data) })}
        description={query.data.code}
      />
      <CustomerForm
        key={query.data.updatedAt}
        slug={slug}
        businessId={businessId}
        customer={query.data}
      />
    </>
  );
}
