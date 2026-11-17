'use client';

import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCan } from '@/core/auth/can';
import { localizedName } from '@/core/auth/types';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/core/ui/page-header';
import { useProduct, useSaveProduct, useUnits } from '../api';
import { DeactivateDialog } from '../shared/deactivate-dialog';
import { DetailList, type DetailRow } from '../shared/detail-list';
import { Money, StatusBadge, useNameOf } from '../shared/display';
import { ListSkeleton, LoadError, Notice } from '../shared/states';

export function ProductDetail({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership');
  const locale = useLocale();
  const format = useFormat();
  const nameOf = useNameOf();
  const saved = useSearchParams().get('saved');
  const canManage = useCan('product.manage');
  const canDeactivate = useCan('product.deactivate');
  const query = useProduct(slug, businessId, id);
  const units = useUnits(slug, businessId);
  const save = useSaveProduct(slug, businessId);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    saved === 'created' ? t('common.created') : saved === 'updated' ? t('common.saved') : null,
  );
  const base = `/b/${encodeURIComponent(slug)}/products`;

  if (query.isPending) return <ListSkeleton rows={6} />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const p = query.data;
  const unit = units.data?.items.find((u) => u.key === p.unitKey);

  const rows: DetailRow[] = [
    { label: t('common.code'), value: <span className="font-mono">{p.code}</span> },
    { label: t('common.nameEn'), value: p.nameEn },
    { label: t('common.nameBn'), value: p.nameBn },
    { label: t('products.category'), value: nameOf(p.category) },
    { label: t('products.unit'), value: unit ? localizedName(unit, locale) : p.unitKey },
    // Only when the API sent it (product.cost.view); otherwise the row does not exist at all.
    ...('purchasePrice' in p && p.purchasePrice !== undefined
      ? [{ label: t('products.purchasePrice'), value: <Money value={p.purchasePrice} /> }]
      : []),
    { label: t('products.salePrice'), value: <Money value={p.defaultSalePrice} /> },
    { label: t('common.status'), value: <StatusBadge active={p.isActive} /> },
    { label: t('common.createdAt'), value: format.date(p.createdAt) },
    {
      label: t('common.updatedAt'),
      value: format.date(p.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
    },
  ];

  return (
    <>
      <PageHeader
        title={nameOf(p)}
        description={p.code}
        actions={
          <>
            {canDeactivate ? (
              <Button
                variant={p.isActive ? 'danger' : 'secondary'}
                onClick={() => (setNotice(null), setConfirming(true))}
              >
                {p.isActive ? t('common.deactivate') : t('common.activate')}
              </Button>
            ) : null}
            {canManage ? (
              <Link
                href={`${base}/${p.id}/edit`}
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
        name={nameOf(p)}
        currentlyActive={p.isActive}
        onCancel={() => setConfirming(false)}
        onConfirm={async (reason) => {
          await save.mutateAsync({ id: p.id, body: { isActive: !p.isActive, reason } });
          setConfirming(false);
          setNotice(t('common.statusChanged'));
        }}
      />
    </>
  );
}
