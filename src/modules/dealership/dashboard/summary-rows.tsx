'use client';

import type { ReactNode } from 'react';
import { useFormat } from '@/core/i18n/use-format';

/** One money line. `sign` only decorates the figure; it never changes the arithmetic. */
export function SummaryRow({
  label,
  value,
  sign,
  hint,
}: {
  label: string;
  value: string | undefined;
  sign: 'plus' | 'minus' | 'none';
  hint?: string;
}) {
  const format = useFormat();
  const tone =
    sign === 'plus'
      ? 'text-[var(--dash-success)]'
      : sign === 'minus'
        ? 'text-[var(--dash-danger)]'
        : 'text-[var(--dash-fg)]';
  const prefix = sign === 'plus' ? '+ ' : sign === 'minus' ? '− ' : '';
  return (
    <li className="flex min-w-0 items-baseline justify-between gap-2 text-sm">
      <span className="min-w-0 truncate text-[var(--dash-fg-muted)]">
        {label}
        {hint && <span className="ml-1 text-xs">({hint})</span>}
      </span>
      <span className={`shrink-0 font-semibold tabular-nums ${tone}`}>
        {value === undefined ? '—' : `${prefix}${format.money(value)}`}
      </span>
    </li>
  );
}

/** A line that is not computed yet: shown as a status, never as a number. */
export function PendingRow({ label, reason }: { label: string; reason?: ReactNode }) {
  return (
    <li className="flex min-w-0 items-baseline justify-between gap-2 text-sm">
      <span className="min-w-0 truncate text-[var(--dash-fg-muted)]">{label}</span>
      <span className="shrink-0 text-xs text-[var(--dash-fg-muted)]">{reason ?? '—'}</span>
    </li>
  );
}
