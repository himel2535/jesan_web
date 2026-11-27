'use client';

import { useRef } from 'react';
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
  const selectRef = useRef<HTMLSelectElement>(null);
  return (
    // The ::before widens the touch target to 40px. It is positioned, so it would paint over an
    // unpositioned <select> and swallow the click (a label click only focuses a select). The select
    // is therefore `relative` (painted above it), and a click that lands on the extra hit area
    // opens the picker itself where the browser supports it.
    <label
      onClick={(event) => {
        if (event.target === selectRef.current) return;
        try {
          selectRef.current?.showPicker?.();
        } catch {
          // Not supported or no user activation: the label already focused the select.
        }
      }}
      className="relative isolate inline-flex items-center before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']"
    >
      <select
        ref={selectRef}
        aria-label={label}
        value={value}
        onChange={(event) => {
          const picked = options.find((option) => String(option.value) === event.target.value);
          if (picked) onChange(picked.value);
        }}
        className={cn(
          'relative cursor-pointer appearance-none rounded-full py-1 pr-3.5 pl-1.5 text-[11px] font-medium whitespace-nowrap',
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
