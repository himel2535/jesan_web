'use client';

import type { ReactNode } from 'react';
import { cn } from '@/core/ui/cn';
import { HUE, type TileHue } from './kpi-tile';

export function SummaryTile({
  hue,
  icon,
  label,
  value,
  note,
  loading = false,
  highlighted = false,
}: {
  hue: TileHue;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  loading?: boolean;
  highlighted?: boolean;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-card border p-2.5', HUE[hue].card)}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'inline-flex size-7 shrink-0 items-center justify-center rounded-lg',
            HUE[hue].icon,
          )}
        >
          {icon}
        </span>
        <p className="min-w-0 truncate text-[13px] font-medium text-[var(--dash-fg-muted)]">
          {label}
        </p>
      </div>
      <div className="min-w-0 pl-9">
        {loading ? (
          <div className="h-6 w-24 animate-pulse rounded bg-[var(--dash-border)]" />
        ) : (
          <p
            className={cn(
              'truncate font-semibold text-[var(--dash-fg)] tabular-nums',
              highlighted && 'text-lg font-bold',
            )}
          >
            {value}
          </p>
        )}
        {note ? <p className="mt-0.5 text-xs text-[var(--dash-fg-muted)]">{note}</p> : null}
      </div>
    </div>
  );
}

export function SummaryTileGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'dash-scope grid grid-cols-1 gap-[5px] rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-2 shadow-[var(--dash-shadow)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
