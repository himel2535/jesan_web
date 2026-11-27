'use client';

import { CalendarDays } from 'lucide-react';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';

/** Current month (business time zone) with a calendar icon; hidden on phones to save room. */
export function TopbarDate() {
  const format = useFormat();
  const label = format.date(`${businessToday().slice(0, 7)}-01T00:00:00.000Z`, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <span className="hidden min-h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-fg sm:inline-flex">
      <CalendarDays aria-hidden className="size-4 text-fg-muted" />
      {label}
    </span>
  );
}
