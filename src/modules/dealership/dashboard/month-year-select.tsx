'use client';

import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { useFormat } from '@/core/i18n/use-format';
import { businessToday } from '@/core/i18n/format';
import { cn } from '@/core/ui/cn';
import { monthKey } from './periods';

/**
 * A pill-shaped dropdown, sized and coloured like a `PeriodPills` button. The label wrapper carries
 * the same `before:-inset-y-2` hit area, so the pill stays ~26px tall with a 40px touch target.
 */
function PillSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative isolate inline-flex items-center before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        className={cn(
          'cursor-pointer appearance-none rounded-full py-1 pr-3.5 pl-1.5 text-[11px] font-medium whitespace-nowrap',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]',
          // Exactly the look of an unselected PeriodPills button (the "All Time" pill).
          'bg-[var(--dash-surface)]/70 text-[var(--dash-fg-muted)] hover:bg-[var(--dash-surface)]',
        )}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-0.5 size-3" />
    </label>
  );
}

const OPTION = 'bg-[var(--dash-surface)] text-[var(--dash-fg)]';

/**
 * Month and year dropdowns for a KPI card, shown as small pills beside "All Time" and looking
 * exactly like it. The year reads as two digits (26). Future months of the current year are
 * disabled.
 */
export function MonthYearSelect({
  title,
  year,
  month,
  onChange,
}: {
  title: string;
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const today = businessToday();
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const years = Array.from({ length: 4 }, (_, i) => thisYear - 3 + i);

  return (
    <>
      <PillSelect
        label={t('selectMonth', { title })}
        value={month}
        onChange={(m) => {
          onChange(year, m);
        }}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option
            key={m}
            value={m}
            disabled={year === thisYear && m > thisMonth}
            className={OPTION}
          >
            {format.date(`${monthKey(year, m)}-01T00:00:00+06:00`, { month: 'short' })}
          </option>
        ))}
      </PillSelect>
      <PillSelect
        label={t('selectYear', { title })}
        value={year}
        onChange={(y) => {
          onChange(y, y === thisYear ? Math.min(month, thisMonth) : month);
        }}
      >
        {years.map((y) => (
          <option key={y} value={y} className={OPTION}>
            {format.number(y % 100, { minimumIntegerDigits: 2, useGrouping: false })}
          </option>
        ))}
      </PillSelect>
    </>
  );
}
