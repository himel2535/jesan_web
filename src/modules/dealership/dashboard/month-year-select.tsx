'use client';

import { useTranslations } from 'next-intl';
import { useFormat } from '@/core/i18n/use-format';
import { businessToday } from '@/core/i18n/format';
import { monthKey } from './periods';
import type { PillTone } from './period-pills';
import { PillSelect } from './pill-select';

/**
 * Month and year dropdowns, shown as small pastel pills beside "All Time" and looking exactly like
 * it. The year reads as two digits (26). Future months of the current year are disabled.
 */
export function MonthYearSelect({
  title,
  year,
  month,
  tone = 'card',
  onChange,
}: {
  title: string;
  year: number;
  month: number;
  tone?: PillTone;
  onChange: (year: number, month: number) => void;
}) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const today = businessToday();
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));

  return (
    <>
      <PillSelect
        label={t('selectMonth', { title })}
        value={month}
        tone={tone}
        options={Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
          value: m,
          label: format.date(`${monthKey(year, m)}-01T00:00:00+06:00`, { month: 'short' }),
          disabled: year === thisYear && m > thisMonth,
        }))}
        onChange={(m) => {
          onChange(year, m);
        }}
      />
      <PillSelect
        label={t('selectYear', { title })}
        value={year}
        tone={tone}
        options={Array.from({ length: 4 }, (_, i) => thisYear - 3 + i).map((y) => ({
          value: y,
          label: format.number(y % 100, { minimumIntegerDigits: 2, useGrouping: false }),
        }))}
        onChange={(y) => {
          onChange(y, y === thisYear ? Math.min(month, thisMonth) : month);
        }}
      />
    </>
  );
}
