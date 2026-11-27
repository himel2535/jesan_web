'use client';

import type { ReactNode } from 'react';
import { cn } from '@/core/ui/cn';
import { HUE, type TileHue } from '../dashboard/kpi-tile';

/**
 * A commission KPI card in the dashboard's colour system (soft card, icon disc, accent), with one
 * dropdown for the period it shows. The hue tokens live on `.dash-scope`, so the section that
 * holds these cards must carry that class.
 */
export function CommissionKpiCard({
  hue,
  icon,
  title,
  selectId,
  selectLabel,
  selectValue,
  options,
  onSelect,
  loading,
  busy,
  error,
  value,
  note,
}: {
  hue: TileHue;
  icon: ReactNode;
  title: string;
  selectId: string;
  selectLabel: string;
  selectValue: string;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  onSelect: (value: string) => void;
  loading: boolean;
  busy: boolean;
  error: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <article
      aria-busy={busy}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-card border p-3 shadow-[var(--dash-shadow)]',
        HUE[hue].card,
        busy && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-xl',
            HUE[hue].icon,
          )}
        >
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--dash-fg)]">
          {title}
        </h2>
        <select
          id={selectId}
          aria-label={selectLabel}
          value={selectValue}
          onChange={(event) => onSelect(event.target.value)}
          className="min-h-10 shrink-0 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] px-2 text-sm font-medium text-[var(--dash-fg)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        {loading ? (
          <div className="h-7 w-32 animate-pulse rounded bg-[var(--dash-border)]" />
        ) : error ? (
          error
        ) : (
          <p className="truncate text-xl leading-tight font-bold text-[var(--dash-fg)] tabular-nums">
            {value}
          </p>
        )}
      </div>

      {note ? <p className="min-h-4 text-[11px] text-[var(--dash-fg-muted)]">{note}</p> : null}
    </article>
  );
}
