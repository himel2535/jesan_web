'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
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
  /** Real percent change, or `null` when it cannot be computed (zero base). */
  percent: number | null;
  /** The comparison label, e.g. "vs last month". */
  label: string;
}

export interface KpiTileProps {
  hue: TileHue;
  icon: ReactNode;
  title: string;
  /** Accessible name of the navigation link, e.g. "Total Collection — open Collections". */
  linkLabel: string;
  href: string;
  value: ReactNode;
  growth: Growth | null;
  /** The period control. It sits above the navigation overlay, so using it never navigates. */
  selector: ReactNode;
  loading?: boolean;
  /** Shown instead of the value when the data could not be loaded. */
  errorText?: string;
}

/**
 * One KPI card. The whole card navigates to its parent page through an overlay link; the
 * period control is layered above that link (`z-10`), so changing the period can never follow
 * the link. There is no nested interactive element: the link wraps nothing but its own overlay.
 */
export function KpiTile({
  hue,
  icon,
  title,
  linkLabel,
  href,
  value,
  growth,
  selector,
  loading = false,
  errorText,
}: KpiTileProps) {
  const up = growth?.percent !== null && growth?.percent !== undefined && growth.percent >= 0;
  return (
    <article
      className={cn(
        'relative flex min-h-[96px] min-w-0 flex-col gap-1 rounded-card border p-2.5',
        'transition-shadow hover:shadow-[var(--dash-shadow)] xl:p-3',
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
            'inline-flex size-7 shrink-0 items-center justify-center rounded-full',
            HUE[hue].icon,
          )}
        >
          {icon}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--dash-fg-muted)]">
          {title}
        </p>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-[var(--dash-fg-muted)]" />
      </div>

      <div className="flex min-w-0 items-end justify-between gap-2">
        <div className="pointer-events-none min-w-0 flex-1">
          {loading ? (
            <div className="h-6 w-24 animate-pulse rounded bg-[var(--dash-border)]" />
          ) : errorText ? (
            <p className="truncate text-sm text-[var(--dash-danger)]">{errorText}</p>
          ) : (
            <p className="truncate text-lg font-bold text-[var(--dash-fg)] tabular-nums xl:text-xl">
              {value}
            </p>
          )}
          {growth && !loading && !errorText && (
            <p
              className={cn(
                'flex min-w-0 items-center gap-1 text-xs font-medium',
                growth.percent === null
                  ? 'text-[var(--dash-fg-muted)]'
                  : up
                    ? 'text-[var(--dash-success)]'
                    : 'text-[var(--dash-danger)]',
              )}
            >
              {growth.percent !== null &&
                (up ? (
                  <TrendingUp aria-hidden className="size-3.5 shrink-0" />
                ) : (
                  <TrendingDown aria-hidden className="size-3.5 shrink-0" />
                ))}
              <span className="truncate">
                {growth.percent === null ? '—' : `${up ? '+' : ''}${growth.percent.toFixed(1)}%`}{' '}
                <span className="text-[var(--dash-fg-muted)]">{growth.label}</span>
              </span>
            </p>
          )}
        </div>
        <div className="relative z-10 w-[min(11.5rem,56%)] shrink-0">{selector}</div>
      </div>
    </article>
  );
}
