/**
 * "All Time" starts here (the same date the other pages use). Defined here, not imported from a
 * `'use client'` page module, so these functions also run on the server when it prefetches.
 */
const LIFETIME_FROM = '2000-01-01';

/**
 * Calendar-date period logic for the dashboard. Every date is a business calendar date
 * (`YYYY-MM-DD`, Asia/Dhaka via `businessToday()`), and all arithmetic is done in UTC on those
 * dates so the browser's own time zone never shifts a boundary.
 */

export interface DayRange {
  from: string;
  to: string;
}

export type MonthSelection = 'thisMonth' | 'previousMonth' | 'lifetime';
export type DaySelection = 'today' | 'yesterday' | 'custom' | 'lifetime';

export interface PeriodPair {
  /** The window the card or summary shows. */
  current: DayRange;
  /** The window it is compared with; `null` when no growth is meaningful (lifetime). */
  previous: DayRange | null;
}

function parts(date: string): { y: number; m: number; d: number } {
  return { y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)), d: Number(date.slice(8, 10)) };
}

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/** `date` shifted by `days` calendar days. */
export function shiftDays(date: string, days: number): string {
  const { y, m, d } = parts(date);
  return iso(y, m, d + days);
}

/** The first day of the month containing `date`. */
export function monthStartOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** The last day of the month containing `date`. */
export function monthEndOf(date: string): string {
  const { y, m } = parts(date);
  return iso(y, m + 1, 0);
}

/** The whole calendar month before the one containing `date`. */
export function previousMonthRange(date: string): DayRange {
  const { y, m } = parts(monthStartOf(date));
  const from = iso(y, m - 1, 1);
  return { from, to: monthEndOf(from) };
}

/**
 * The previous month, truncated to the same day-of-month as `today`, so "This Month" compares
 * month-to-date with the same number of days last month (e.g. 1–26 Nov vs 1–26 Oct). Comparing
 * a partial month with a full previous month would understate growth.
 */
export function sameDaysPreviousMonth(today: string): DayRange {
  const prev = previousMonthRange(today);
  const dayOfMonth = parts(today).d;
  const prevLength = parts(prev.to).d;
  return { from: prev.from, to: shiftDays(prev.from, Math.min(dayOfMonth, prevLength) - 1) };
}

/** Monthly card and summary windows for a selection. */
export function monthPeriods(today: string, selection: MonthSelection): PeriodPair {
  if (selection === 'lifetime') {
    return { current: { from: LIFETIME_FROM, to: today }, previous: null };
  }
  if (selection === 'previousMonth') {
    const current = previousMonthRange(today);
    return { current, previous: previousMonthRange(current.from) };
  }
  return {
    current: { from: monthStartOf(today), to: today },
    previous: sameDaysPreviousMonth(today),
  };
}

/** A KPI card's month choice: one calendar month (year + 1-12) or everything. */
export type MonthYearSelection =
  { kind: 'month'; year: number; month: number } | { kind: 'lifetime' };

/**
 * Windows for a chosen calendar month. The current month is month-to-date compared with the same
 * days last month; any past month is the whole month compared with the whole month before it.
 */
export function monthYearPeriods(today: string, selection: MonthYearSelection): PeriodPair {
  if (selection.kind === 'lifetime') return monthPeriods(today, 'lifetime');
  const key = monthKey(selection.year, selection.month);
  if (key === monthKeyOf(today)) return monthPeriods(today, 'thisMonth');
  const from = `${key}-01`;
  const current = { from, to: monthEndOf(from) };
  return { current, previous: previousMonthRange(from) };
}

/** Daily card windows for a selection. `customDate` is used only with `custom`. */
export function dayPeriods(
  today: string,
  selection: DaySelection,
  customDate?: string,
): PeriodPair {
  if (selection === 'lifetime') {
    return { current: { from: LIFETIME_FROM, to: today }, previous: null };
  }
  const day =
    selection === 'today'
      ? today
      : selection === 'yesterday'
        ? shiftDays(today, -1)
        : (customDate ?? today);
  return {
    current: { from: day, to: day },
    previous: { from: shiftDays(day, -1), to: shiftDays(day, -1) },
  };
}

/** Relative growth in percent, or `null` when the base is zero or a value is missing. */
export function changePercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Month key (`YYYY-MM`) for a year and month number (1-12). */
export function monthKey(year: number, month: number): string {
  return `${String(year)}-${String(month).padStart(2, '0')}`;
}

/** Month key (`YYYY-MM`) for a calendar date. */
export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

/** The month key before the given `YYYY-MM`. */
export function previousMonthKey(key: string): string {
  const { y, m } = parts(`${key}-01`);
  return monthKeyOf(iso(y, m - 1, 1));
}
