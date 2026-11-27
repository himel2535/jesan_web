'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/core/ui/cn';

export type TileHue = 'blue' | 'green' | 'purple' | 'orange';

const HUE: Record<TileHue, { card: string; icon: string }> = {
  blue: {
    card: 'bg-[var(--dash-blue-card-bg)] border-[var(--dash-blue-card-border)]',
    icon: 'bg-[var(--dash-blue-icon-bg)] text-[var(--dash-blue-accent)]',
  },
  green: {
    card: 'bg-[var(--dash-green-card-bg)] border-[var(--dash-green-card-border)]',
    icon: 'bg-[var(--dash-green-icon-bg)] text-[var(--dash-green-accent)]',
  },
  purple: {
    card: 'bg-[var(--dash-purple-card-bg)] border-[var(--dash-purple-card-border)]',
    icon: 'bg-[var(--dash-purple-icon-bg)] text-[var(--dash-purple-accent)]',
  },
  orange: {
    card: 'bg-[var(--dash-orange-card-bg)] border-[var(--dash-orange-card-border)]',
    icon: 'bg-[var(--dash-orange-icon-bg)] text-[var(--dash-orange-accent)]',
  },
};

export interface Growth {
  /** The real change, or null when there is nothing to compare against. */
  percent: number | null;
  /** What it is compared with, e.g. "vs Last Month". */
  label: string;
}

/**
 * One KPI card from the reference: icon, title and a chevron on top, the figure
 * large beneath it, the change under that, and the period pills along the
 * bottom.
 *
 * The whole card navigates through an overlay link. The pills sit above that
 * overlay and stop the click themselves, so changing a period never follows the
 * link, and no interactive element is nested inside another.
 */
export function KpiTile({
  hue,
  icon,
  title,
  linkLabel,
  href,
  value,
  growth,
  pills,
  loading = false,
  errorText,
}: {
  hue: TileHue;
  icon: ReactNode;
  title: string;
  linkLabel: string;
  href: string;
  value: ReactNode;
  growth: Growth | null;
  pills: ReactNode;
  loading?: boolean;
  errorText?: string;
}) {
  const up = growth?.percent !== null && growth?.percent !== undefined && growth.percent >= 0;
  return (
    <article
      className={cn(
        'relative flex min-w-0 flex-col gap-0.5 rounded-card border p-2 xl:p-2.5',
        'transition-shadow hover:shadow-[var(--dash-shadow)]',
        HUE[hue].card,
      )}
    >
      <Link
        href={href}
        prefetch={false}
        aria-label={linkLabel}
        className="absolute inset-0 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
      />

      <div className="pointer-events-none flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-xl',
            HUE[hue].icon,
          )}
        >
          {icon}
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--dash-fg)]">
          {title}
        </p>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-[var(--dash-fg-muted)]" />
      </div>

      <div className="pointer-events-none min-w-0">
        {loading ? (
          <div className="h-7 w-28 animate-pulse rounded bg-[var(--dash-border)]" />
        ) : errorText ? (
          <p className="truncate text-sm text-[var(--dash-danger)]">{errorText}</p>
        ) : (
          <p className="truncate text-xl leading-tight font-bold text-[var(--dash-fg)] tabular-nums">
            {value}
          </p>
        )}
      </div>

      <div className="pointer-events-none min-h-4 text-[11px]">
        {growth && !loading && !errorText && (
          <p
            className={cn(
              'flex min-w-0 items-center gap-1 font-semibold',
              growth.percent === null
                ? 'text-[var(--dash-fg-muted)]'
                : up
                  ? 'text-[var(--dash-success)]'
                  : 'text-[var(--dash-danger)]',
            )}
          >
            {growth.percent !== null && <span aria-hidden>{up ? '▲' : '▼'}</span>}
            <span className="truncate">
              {growth.percent === null ? '—' : `${up ? '+' : ''}${growth.percent.toFixed(1)}%`}{' '}
              <span className="font-normal text-[var(--dash-fg-muted)]">{growth.label}</span>
            </span>
          </p>
        )}
      </div>

      <div className="relative z-10 mt-auto pt-0.5">{pills}</div>
    </article>
  );
}
