'use client';

import { ClipboardCheck, Eye, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useErrorMessage } from '@/core/api/field-errors';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { cn } from '@/core/ui/cn';
import { EmptyState } from '@/core/ui/empty-state';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { Skeleton } from '@/core/ui/skeleton';
import { inputClass } from '@/core/ui/text-field';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { useChangeRequests } from './api';
import { useChangeEntities } from './context';
import { StatusPill, useChangeLabels } from './display';
import {
  CHANGE_STATUSES,
  type ChangeListFilters,
  type ChangeRequestSummary,
  type ChangeStatus,
} from './types';

const isStatus = (v: string | null): v is ChangeStatus =>
  (CHANGE_STATUSES as readonly string[]).includes(v ?? '');

/** Filters live in the URL (?status=&entityType=&entityId=&page=): reload and share keep them. */
function useFilters(scope: 'mine' | 'all'): ChangeListFilters {
  const params = useSearchParams();
  const status = params.get('status');
  return {
    status: isStatus(status) ? status : undefined,
    entityType: scope === 'all' ? params.get('entityType') || undefined : undefined,
    entityId: scope === 'all' ? params.get('entityId') || undefined : undefined,
    page: parsePageParam(params.get('page')),
  };
}

export function LoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations('approvals');
  const message = useErrorMessage().message;
  const final = error instanceof ApiError && (error.status === 403 || error.status === 404);
  return (
    <div role="alert" className="space-y-3 rounded-card border border-border p-6 text-center">
      <p className="text-fg">{final ? message(error) : t('loadError')}</p>
      {final ? null : (
        <Button variant="secondary" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}

/**
 * Change requests, 10 per page. `mine`: own requests, status filter only. `all` (the owner's
 * inbox): status and record type; a single record (`entityId`) only arrives through a link.
 * Rows show who, what (label + summary from the API), when and status; the reason is on the
 * detail page only.
 */
export function ApprovalsList({ slug, scope }: { slug: string; scope: 'mine' | 'all' }) {
  const t = useTranslations('approvals');
  const id = useId();
  const format = useFormat();
  const labels = useChangeLabels();
  const entities = useChangeEntities();
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useFilters(scope);
  const query = useChangeRequests(slug, scope, filters);
  const base = `/b/${encodeURIComponent(slug)}/approvals`;

  const setParams = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    search.delete('page'); // a new filter starts at page 1
    const qs = search.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const items = query.data?.items ?? [];
  const filtered = Boolean(filters.status || filters.entityType || filters.entityId);
  const entityLabel =
    filters.entityId && items[0]?.entityId === filters.entityId
      ? items[0].entityLabel
      : t('entityFilterRecord');

  const what = (r: ChangeRequestSummary) => (
    <>
      <span className="block font-medium text-fg">
        {labels.entityType(r.entityType)} · {r.entityLabel}
      </span>
      <span className="block text-sm text-fg-muted">
        {r.kind === 'void' ? t('kind.void') : r.summary}
      </span>
    </>
  );
  const details = (r: ChangeRequestSummary) => (
    <Link
      href={`${base}/${encodeURIComponent(r.id)}`}
      prefetch={false}
      aria-label={t('detailsFor', { label: r.entityLabel })}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-muted"
    >
      <Eye aria-hidden className="size-4" />
      {t('details')}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`${id}-status`} className="mb-1.5 block text-sm font-medium text-fg">
            {t('status.label')}
          </label>
          <select
            id={`${id}-status`}
            value={filters.status ?? ''}
            onChange={(e) => setParams({ status: e.target.value || undefined })}
            className={inputClass}
          >
            <option value="">{t('status.all')}</option>
            {CHANGE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        {scope === 'all' ? (
          <div>
            <label htmlFor={`${id}-type`} className="mb-1.5 block text-sm font-medium text-fg">
              {t('entityTypes.label')}
            </label>
            <select
              id={`${id}-type`}
              value={filters.entityType ?? ''}
              onChange={(e) => setParams({ entityType: e.target.value || undefined })}
              className={inputClass}
            >
              <option value="">{t('entityTypes.all')}</option>
              {Object.keys(entities).map((type) => (
                <option key={type} value={type}>
                  {labels.entityType(type)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {filters.entityId ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-border px-3 py-1">
            {t('entityFilter', { label: entityLabel })}
          </span>
          <button
            type="button"
            onClick={() => setParams({ entityId: undefined })}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 font-medium text-fg underline"
          >
            <X aria-hidden className="size-4" />
            {t('clearEntityFilter')}
          </button>
        </p>
      ) : null}

      {query.isPending ? (
        <div className="space-y-2" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <LoadFailed error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={ClipboardCheck}
            title={t('noResultsTitle')}
            description={t('noResultsDescription')}
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  setParams({ status: undefined, entityType: undefined, entityId: undefined })
                }
              >
                {t('clearFilters')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
          />
        )
      ) : (
        <>
          <div className={cn(query.isPlaceholderData && 'opacity-60')} aria-busy={query.isFetching}>
            {isDesktop ? (
              <div className="overflow-x-auto rounded-card border border-border bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-fg-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('columns.what')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('columns.who')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('columns.when')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {t('columns.status')}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        {t('columns.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-border last:border-0 hover:bg-surface-muted"
                      >
                        <th scope="row" className="px-4 py-3 font-normal">
                          {what(r)}
                        </th>
                        <td className="px-4 py-3 whitespace-nowrap">{r.requestedBy.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-fg-muted">
                          {format.date(r.requestedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="px-4 py-2 text-right">{details(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((r) => (
                  <li key={r.id} className="rounded-card border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">{what(r)}</div>
                      <StatusPill status={r.status} />
                    </div>
                    <p className="mt-2 text-xs text-fg-muted">
                      {r.requestedBy.name} ·{' '}
                      {format.date(r.requestedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    <div className="mt-3 flex justify-end">{details(r)}</div>
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
