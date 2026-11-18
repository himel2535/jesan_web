'use client';

import { Truck } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/core/ui/cn';
import { PageHeader } from '@/core/ui/page-header';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE } from '@/core/ui/pagination-logic';
import { useSupplier, useSuppliers } from '../api';
import { DetailList } from '../shared/detail-list';
import { StatusBadge, useNameOf } from '../shared/display';
import { useListParams, useSetListParams } from '../shared/list-params';
import { ListToolbar } from '../shared/list-toolbar';
import { DetailsLink } from '../shared/row-actions';
import { ListEmpty, ListSkeleton, LoadError } from '../shared/states';

function PrincipalBadge() {
  const t = useTranslations('dealership.suppliers');
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-fg-muted">
      {t('principal')}
    </span>
  );
}

/** Suppliers come from business settings; there is no add or edit API, so this is view only. */
export function SuppliersList({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const nameOf = useNameOf();
  const params = useListParams();
  const setParams = useSetListParams();
  const query = useSuppliers(slug, businessId, { active: params.active, page: params.page });
  const base = `/b/${encodeURIComponent(slug)}/suppliers`;
  const items = query.data?.items ?? [];

  return (
    <div className="space-y-4">
      <ListToolbar />
      {query.isPending ? (
        <ListSkeleton rows={2} />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <ListEmpty
          filtered={params.active !== 'true'}
          icon={Truck}
          title={t('suppliers.emptyTitle')}
          description={t('suppliers.emptyDescription')}
          onClear={() => setParams({ active: undefined })}
        />
      ) : (
        <>
          <ul className={cn('space-y-2', query.isPlaceholderData && 'opacity-60')}>
            {items.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4"
              >
                <Link href={`${base}/${s.id}`} prefetch={false} className="hover:underline">
                  <span>
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {nameOf(s)}
                      {s.isPrincipal ? <PrincipalBadge /> : null}
                    </span>
                    <span className="mt-1 block text-xs text-fg-muted">
                      {s.code}
                      {s.phone ? ` · ${s.phone}` : ''}
                    </span>
                  </span>
                </Link>
                <span className="flex items-center gap-2">
                  <StatusBadge active={s.isActive} />
                  <DetailsLink href={`${base}/${s.id}`} name={nameOf(s)} />
                </span>
              </li>
            ))}
          </ul>
          <Pagination totalItems={query.data.total} pageSize={query.data.pageSize || PAGE_SIZE} />
        </>
      )}
    </div>
  );
}

export function SupplierDetail({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership');
  const nameOf = useNameOf();
  const query = useSupplier(slug, businessId, id);
  if (query.isPending) return <ListSkeleton rows={4} />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const s = query.data;
  return (
    <>
      <PageHeader
        title={nameOf(s)}
        description={s.code}
        actions={s.isPrincipal ? <PrincipalBadge /> : null}
      />
      <div className="space-y-4">
        <DetailList
          rows={[
            { label: t('common.code'), value: <span className="font-mono">{s.code}</span> },
            { label: t('common.nameEn'), value: s.nameEn },
            { label: t('common.nameBn'), value: s.nameBn },
            { label: t('common.phone'), value: s.phone ?? '—' },
            { label: t('common.address'), value: s.address ?? '—' },
            { label: t('common.status'), value: <StatusBadge active={s.isActive} /> },
          ]}
        />
        <Link
          href={`/b/${encodeURIComponent(slug)}/suppliers`}
          prefetch={false}
          className="inline-block text-sm font-medium text-fg underline"
        >
          {t('common.back')}
        </Link>
      </div>
    </>
  );
}
