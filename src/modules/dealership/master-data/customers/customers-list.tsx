'use client';

import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { cn } from '@/core/ui/cn';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE } from '@/core/ui/pagination-logic';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { useCustomers } from '../api';
import { Balance, Money, StatusBadge, useNameOf } from '../shared/display';
import { useListParams, useSetListParams } from '../shared/list-params';
import { ListToolbar } from '../shared/list-toolbar';
import { ListEmpty, ListSkeleton, LoadError } from '../shared/states';
import type { Customer } from '../types';

const buttonLink =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90';

/** Due and credit limit appear only with `customer.due.view` AND when the API sends them. */
export function hasDueFields(c: Customer): c is Customer & { currentBalance: string } {
  return 'currentBalance' in c && c.currentBalance !== undefined;
}

/**
 * Customers (shops), 10 per page, searchable by name, phone and code. Without
 * `customer.due.view` there is no due or credit-limit column at all.
 */
export function CustomersList({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const locale = useLocale();
  const nameOf = useNameOf();
  const isDesktop = useIsDesktop();
  const canManage = useCan('customer.manage');
  const canSeeDue = useCan('customer.due.view');
  const params = useListParams();
  const setParams = useSetListParams();
  const query = useCustomers(slug, businessId, params);
  const base = `/b/${encodeURIComponent(slug)}/customers`;
  const items = query.data?.items ?? [];
  const showDue = canSeeDue && items.some(hasDueFields);
  const filtered = Boolean(params.search || params.active !== 'true');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ListToolbar searchPlaceholder={t('customers.searchPlaceholder')} />
        </div>
        {canManage ? (
          <Link href={`${base}/new`} prefetch={false} className={buttonLink}>
            <Plus aria-hidden className="size-4" />
            {t('customers.new')}
          </Link>
        ) : null}
      </div>

      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <ListEmpty
          filtered={filtered}
          icon={Users}
          title={t('customers.emptyTitle')}
          description={t('customers.emptyDescription')}
          onClear={() => setParams({ search: undefined, active: undefined })}
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
                        {t('common.code')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('common.name')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('common.phone')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('common.area')}
                      </th>
                      {showDue ? (
                        <>
                          <th scope="col" className="px-4 py-3 text-right font-medium">
                            {t('customers.currentBalance')}
                          </th>
                          <th scope="col" className="px-4 py-3 text-right font-medium">
                            {t('customers.creditLimit')}
                          </th>
                        </>
                      ) : null}
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('common.status')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-border last:border-0 hover:bg-surface-muted"
                      >
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{c.code}</td>
                        <th scope="row" className="px-4 py-3 font-medium">
                          <Link
                            href={`${base}/${c.id}`}
                            prefetch={false}
                            className="hover:underline"
                          >
                            {nameOf(c)}
                          </Link>
                          {c.nameBn ? (
                            <span className="block text-xs font-normal text-fg-muted">
                              {locale === 'bn' ? c.nameEn : c.nameBn}
                            </span>
                          ) : null}
                        </th>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">{c.phone}</td>
                        <td className="px-4 py-3">{c.area ?? '—'}</td>
                        {showDue ? (
                          <>
                            <td className="px-4 py-3 text-right">
                              {hasDueFields(c) ? <Balance value={c.currentBalance} /> : null}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <CreditLimit value={c.creditLimit} />
                            </td>
                          </>
                        ) : null}
                        <td className="px-4 py-3">
                          <StatusBadge active={c.isActive} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`${base}/${c.id}`}
                      prefetch={false}
                      className="block rounded-card border border-border bg-surface p-4 hover:bg-surface-muted"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-medium">{nameOf(c)}</span>
                        <StatusBadge active={c.isActive} />
                      </span>
                      <span className="mt-1 block text-xs text-fg-muted">
                        {c.code} · {c.phone}
                        {c.area ? ` · ${c.area}` : ''}
                      </span>
                      {showDue && hasDueFields(c) ? (
                        <span className="mt-2 block text-sm">
                          <span className="text-fg-muted">{t('customers.currentBalance')}: </span>
                          <Balance value={c.currentBalance} />
                        </span>
                      ) : null}
                    </Link>
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

/** null = no limit. */
export function CreditLimit({ value }: { value: string | null | undefined }) {
  const t = useTranslations('dealership.customers');
  if (value === undefined) return null;
  return value === null ? (
    <span className="text-fg-muted">{t('noLimit')}</span>
  ) : (
    <Money value={value} />
  );
}
