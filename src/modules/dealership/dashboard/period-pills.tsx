'use client';

import { cn } from '@/core/ui/cn';

export interface PillOption<T extends string> {
  value: T;
  label: string;
}

/** The accent only draws the ring round the chosen pill; the fill stays pastel and glassless. */
export type PillHue = 'blue' | 'green' | 'purple' | 'orange';

/** `card` pills sit on a tinted KPI card, `panel` pills on a white panel. */
export type PillTone = 'card' | 'panel';

const RING: Record<PillHue, string> = {
  blue: 'ring-[var(--dash-blue-accent)]',
  green: 'ring-[var(--dash-green-accent)]',
  purple: 'ring-[var(--dash-purple-accent)]',
  orange: 'ring-[var(--dash-orange-accent)]',
};

/** The one pastel pill look shared by every dashboard filter (buttons and dropdowns alike). */
export function pillClass(selected: boolean, hue: PillHue, tone: PillTone): string {
  if (selected) {
    return cn(
      'bg-[var(--dash-surface)] text-[var(--dash-fg)] shadow-sm ring-1 ring-inset',
      RING[hue],
    );
  }
  return cn(
    tone === 'card' ? 'bg-[var(--dash-surface)]/70' : 'bg-[var(--dash-bg)]',
    'text-[var(--dash-fg-muted)] hover:bg-[var(--dash-surface)]',
  );
}

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
  tone = 'card',
}: {
  label: string;
  value: T;
  options: readonly PillOption<T>[];
  onChange: (value: T) => void;
  hue?: PillHue;
  tone?: PillTone;
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
              pillClass(selected, hue, tone),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
