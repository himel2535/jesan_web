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
import { useProductStock } from '../../stock/api';
import { useProduct, useSaveProduct, useUnits } from '../api';
import { CorrectionSection, useProductRequestTarget } from '../shared/correction';
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
  const canSeeCost = useCan('product.cost.view');
  const query = useProduct(slug, businessId, id);
  const units = useUnits(slug, businessId);
  const canSeeStock = useCan('stock.view');
  const stock = useProductStock(slug, businessId, id);
  const save = useSaveProduct(slug, businessId);
  const requestTarget = useProductRequestTarget(query.data);
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
    // Current stock (stock.view) from the first stock-history page, with a link to the history.
    ...(canSeeStock && stock.data
      ? [
          {
            label: t('products.currentStock'),
            value: (
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="tabular-nums">
                  {format.quantity(stock.data.product.currentStock)}
                </span>
                <Link
                  href={`/b/${encodeURIComponent(slug)}/stock/${p.id}`}
                  prefetch={false}
                  className="text-sm font-medium text-primary underline"
                >
                  {t('products.stockHistory')}
                </Link>
              </span>
            ),
          },
        ]
      : []),
    // Only when the API sent it (product.cost.view); otherwise the row does not exist at all.
    // Only with product.cost.view AND when the API sent it; read-only, set by purchases.
    ...(canSeeCost && 'lastPurchasePrice' in p
      ? p.lastPurchasePrice
        ? [
            {
              label: t('products.lastPurchasePrice'),
              value: <Money value={p.lastPurchasePrice} />,
            },
            ...(p.lastPurchasedAt
              ? [{ label: t('products.lastPurchasedAt'), value: format.date(p.lastPurchasedAt) }]
              : []),
          ]
        : [{ label: t('products.lastPurchasePrice'), value: t('products.neverPurchased') }]
      : []),
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
