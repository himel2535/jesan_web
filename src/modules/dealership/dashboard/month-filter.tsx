'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MonthYearSelection } from './periods';
import { PeriodPills, type PillHue, type PillTone } from './period-pills';
import { MonthYearSelect } from './month-year-select';

/**
 * State of a "month · year · All Time" filter. Picking a month or year leaves All Time; clicking
 * All Time shows everything, and clicking it again returns to the last chosen month.
 */
export function useMonthFilter(today: string) {
  const initial = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  const [selection, setSelection] = useState<MonthYearSelection>({ kind: 'month', ...initial });
  const [last, setLast] = useState(initial);
  return {
    selection,
    last,
    pick: (year: number, month: number) => {
      setLast({ year, month });
      setSelection({ kind: 'month', year, month });
    },
    toggleAll: () => {
      setSelection((current) =>
        current.kind === 'lifetime' ? { kind: 'month', ...last } : { kind: 'lifetime' },
      );
    },
  };
}

export type MonthFilterState = ReturnType<typeof useMonthFilter>;

/** The one-line pill row for a `useMonthFilter`. `title` names the card or panel it filters. */
export function MonthFilter({
  title,
  filter,
  hue = 'blue',
  tone = 'card',
}: {
  title: string;
  filter: MonthFilterState;
  hue?: PillHue;
  tone?: PillTone;
}) {
  const t = useTranslations('dealership.dashboard');
  return (
    <div className="flex flex-nowrap items-center justify-end gap-0.5 sm:gap-1">
      <MonthYearSelect
        title={title}
        year={filter.last.year}
        month={filter.last.month}
        tone={tone}
        onChange={filter.pick}
      />
      <PeriodPills
        label={t('periodFor', { title })}
        value={filter.selection.kind === 'lifetime' ? 'lifetime' : ''}
        hue={hue}
        tone={tone}
        options={[{ value: 'lifetime', label: t('period.allTime') }]}
        onChange={filter.toggleAll}
      />
    </div>
  );
}
