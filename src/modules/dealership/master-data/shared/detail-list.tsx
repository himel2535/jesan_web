import type { ReactNode } from 'react';

export interface DetailRow {
  label: string;
  value: ReactNode;
}

/** Label/value pairs of a detail page (a card, not a long list: glass is fine here). */
export function DetailList({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 rounded-card glass p-5 sm:grid-cols-[minmax(10rem,auto)_1fr]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-sm text-fg-muted">{row.label}</dt>
          <dd className="text-sm font-medium text-fg">{row.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
