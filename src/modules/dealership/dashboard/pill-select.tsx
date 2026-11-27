'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/core/ui/cn';
import { pillClass, type PillTone } from './period-pills';

export interface PillSelectOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * A native dropdown dressed as one of the dashboard's pastel pills. The label wrapper carries the
 * same `before:-inset-y-2` hit area as `PeriodPills`, so the pill stays ~26px tall with a 40px
 * touch target.
 */
export function PillSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
  tone = 'card',
}: {
  label: string;
  value: T;
  options: readonly PillSelectOption<T>[];
  onChange: (value: T) => void;
  tone?: PillTone;
}) {
  return (
    <label className="relative isolate inline-flex items-center before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          const picked = options.find((option) => String(option.value) === event.target.value);
          if (picked) onChange(picked.value);
        }}
        className={cn(
          'cursor-pointer appearance-none rounded-full py-1 pr-3.5 pl-1.5 text-[11px] font-medium whitespace-nowrap',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]',
          pillClass(false, 'blue', tone),
        )}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="bg-[var(--dash-surface)] text-[var(--dash-fg)]"
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-0.5 size-3 text-[var(--dash-fg-muted)]"
      />
    </label>
  );
}
