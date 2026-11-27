'use client';

import { cn } from '@/core/ui/cn';

export interface PillOption<T extends string> {
  value: T;
  label: string;
}

/** The selected pill takes its card's own colour, as in the reference. */
export type PillHue = 'blue' | 'green' | 'purple' | 'orange';

const SELECTED: Record<PillHue, string> = {
  blue: 'bg-[var(--dash-blue-accent)] text-white',
  green: 'bg-[var(--dash-green-accent)] text-white',
  purple: 'bg-[var(--dash-purple-accent)] text-white',
  orange: 'bg-[var(--dash-orange-accent)] text-white',
};

/**
 * The row of small period pills on a KPI card. They read as ~26px tall, as in
 * the reference, while `before:-inset-y-2` gives each one the 40px touch target
 * the project requires — the hit area grows, the layout does not.
 *
 * On a card the whole surface is a link, so these sit above it and stop the
 * click: choosing a period must never navigate.
 */
export function PeriodPills<T extends string>({
  label,
  value,
  options,
  onChange,
  hue = 'blue',
}: {
  label: string;
  value: T;
  options: readonly PillOption<T>[];
  onChange: (value: T) => void;
  hue?: PillHue;
}) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-wrap gap-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange(option.value);
            }}
            className={cn(
              'relative isolate rounded-full px-2 py-1 text-[11px] font-medium whitespace-nowrap',
              'before:absolute before:inset-x-0 before:-inset-y-2 before:content-[""]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]',
              selected
                ? `${SELECTED[hue]} shadow-sm`
                : 'bg-[var(--dash-surface)]/70 text-[var(--dash-fg-muted)] hover:bg-[var(--dash-surface)]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
