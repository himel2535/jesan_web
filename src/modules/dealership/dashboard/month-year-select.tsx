'use client';

import { useTranslations } from 'next-intl';
import { useFormat } from '@/core/i18n/use-format';
import { businessToday } from '@/core/i18n/format';
import { cn } from '@/core/ui/cn';
import { monthKey } from './periods';

const SELECT =
  'min-h-10 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] px-1.5 text-xs font-medium text-[var(--dash-fg)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]';

/**
 * Month and year dropdowns for a KPI card, the same control the commission cards use. Future
 * months of the current year are disabled. `dimmed` greys them while "All Time" is chosen.
 */
export function MonthYearSelect({
  title,
  year,
  month,
  dimmed,
  onChange,
}: {
  title: string;
  year: number;
  month: number;
  dimmed?: boolean;
  onChange: (year: number, month: number) => void;
}) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const today = businessToday();
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const years = Array.from({ length: 4 }, (_, i) => thisYear - 3 + i);

  return (
    <div className={cn('flex items-center gap-1', dimmed && 'opacity-50')}>
      <select
        aria-label={t('selectMonth', { title })}
        value={month}
        onChange={(event) => {
          onChange(year, Number(event.target.value));
        }}
        className={SELECT}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m} disabled={year === thisYear && m > thisMonth}>
            {format.date(`${monthKey(year, m)}-01T00:00:00+06:00`, { month: 'long' })}
          </option>
        ))}
      </select>
      <select
        aria-label={t('selectYear', { title })}
        value={year}
        onChange={(event) => {
          const y = Number(event.target.value);
          onChange(y, y === thisYear ? Math.min(month, thisMonth) : month);
        }}
        className={SELECT}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {format.number(y, { useGrouping: false })}
          </option>
        ))}
      </select>
    </div>
  );
}
