'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from './cn';
import { RouteProgress } from './route-progress';
import { PAGE_SIZE, getPageItems, pageRange, parsePageParam, totalPages } from './pagination-logic';

export interface PaginationProps {
  totalItems: number;
  pageSize?: number;
  /** Query-string parameter holding the page number. */
  param?: string;
}

const itemClass =
  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-medium';

/**
 * Server-side pagination controls: the page lives in the URL (?page=N), so the server fetches
 * only that page (proposal §9.2, rule 7). Links never prefetch: list pages are data-heavy.
 */
export function Pagination({ totalItems, pageSize = PAGE_SIZE, param = 'page' }: PaginationProps) {
  const t = useTranslations('pagination');
  const format = useFormat();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pages = totalPages(totalItems, pageSize);
  const current = Math.min(parsePageParam(searchParams.get(param)), pages);
  const { from, to } = pageRange(current, totalItems, pageSize);

  const hrefFor = (page: number) => {
    const next = new URLSearchParams(searchParams.toString());
    if (page === 1) next.delete(param);
    else next.set(param, String(page));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const edge = (target: number, disabled: boolean, label: string, icon: React.ReactNode) =>
    disabled ? (
      <span aria-disabled="true" className={cn(itemClass, 'text-fg-muted opacity-50')}>
        {icon}
        <span className="sr-only sm:not-sr-only">{label}</span>
      </span>
    ) : (
      <Link
        href={hrefFor(target)}
        prefetch={false}
        className={cn(itemClass, 'text-fg hover:bg-surface-muted')}
      >
        {icon}
        <span className="sr-only sm:not-sr-only">{label}</span>
        <RouteProgress />
      </Link>
    );

  return (
    <nav aria-label={t('label')} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <p className="text-sm text-fg-muted">
        {t('summary', {
          from: format.number(from),
          to: format.number(to),
          total: format.number(totalItems),
        })}
      </p>
      <ul className="flex items-center gap-1">
        <li>
          {edge(
            current - 1,
            current <= 1,
            t('previous'),
            <ChevronLeft aria-hidden className="size-4" />,
          )}
        </li>
        {getPageItems(current, pages).map((item, index) =>
          item === 'ellipsis' ? (
            <li key={`ellipsis-${index}`} aria-hidden className={cn(itemClass, 'text-fg-muted')}>
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={hrefFor(item)}
                prefetch={false}
                aria-label={t('page', { page: format.number(item) })}
                aria-current={item === current ? 'page' : undefined}
                className={cn(
                  itemClass,
                  item === current
                    ? 'bg-primary text-primary-fg'
                    : 'text-fg hover:bg-surface-muted',
                )}
              >
                {format.number(item)}
                <RouteProgress />
              </Link>
            </li>
          ),
        )}
        <li>
          {edge(
            current + 1,
            current >= pages,
            t('next'),
            <ChevronRight aria-hidden className="size-4" />,
          )}
        </li>
      </ul>
    </nav>
  );
}
