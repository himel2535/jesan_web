'use client';

import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { useFormat } from '@/core/i18n/use-format';
import { businessToday } from '@/core/i18n/format';
import { cn } from '@/core/ui/cn';
import { monthKey } from './periods';
import { SELECTED, type PillHue } from './period-pills';

/**
 * A pill-shaped dropdown, sized and coloured like a `PeriodPills` button. The label wrapper carries
 * the same `before:-inset-y-2` hit area, so the pill stays ~26px tall with a 40px touch target.
 */
function PillSelect({
  label,
  value,
  active,
  hue,
  onChange,
  children,
}: {
  label: string;
  value: number;
  active: boolean;
  hue: PillHue;
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
          'cursor-pointer appearance-none rounded-full py-1 pr-5 pl-2 text-[11px] font-medium whitespace-nowrap',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]',
          active
            ? `${SELECTED[hue]} shadow-sm`
            : 'bg-[var(--dash-surface)]/70 text-[var(--dash-fg-muted)] hover:bg-[var(--dash-surface)]',
        )}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-1.5 size-3" />
    </label>
  );
}

const OPTION = 'bg-[var(--dash-surface)] text-[var(--dash-fg)]';

/**
 * Month and year dropdowns for a KPI card, shown as small pills beside "All Time". They take the
 * card's accent while a month is chosen and the muted pill look while "All Time" is on. Future
 * months of the current year are disabled.
 */
export function MonthYearSelect({
  title,
  hue,
  year,
  month,
  active,
  onChange,
}: {
  title: string;
  hue: PillHue;
  year: number;
  month: number;
  active: boolean;
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
        active={active}
        hue={hue}
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
        active={active}
        hue={hue}
        onChange={(y) => {
          onChange(y, y === thisYear ? Math.min(month, thisMonth) : month);
        }}
      >
        {years.map((y) => (
          <option key={y} value={y} className={OPTION}>
            {format.number(y, { useGrouping: false })}
          </option>
        ))}
      </PillSelect>
    </>
  );
}
