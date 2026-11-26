import { describe, expect, it } from 'vitest';
import {
  changePercent,
  dayPeriods,
  monthEndOf,
  monthPeriods,
  monthStartOf,
  previousMonthKey,
  previousMonthRange,
  sameDaysPreviousMonth,
  shiftDays,
} from './periods';

describe('calendar arithmetic (UTC on calendar dates)', () => {
  it('shifts across month, year and leap-day boundaries', () => {
    expect(shiftDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('finds month start and end, including leap February', () => {
    expect(monthStartOf('2026-11-26')).toBe('2026-11-01');
    expect(monthEndOf('2026-11-26')).toBe('2026-11-30');
    expect(monthEndOf('2024-02-10')).toBe('2024-02-29');
    expect(monthEndOf('2026-02-10')).toBe('2026-02-28');
  });

  it('gives the whole previous month, across a year boundary', () => {
    expect(previousMonthRange('2026-11-26')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(previousMonthRange('2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('steps month keys backwards', () => {
    expect(previousMonthKey('2026-01')).toBe('2025-12');
    expect(previousMonthKey('2026-11')).toBe('2026-10');
  });
});

describe('growth comparison windows', () => {
  it('compares This Month with the same number of days last month', () => {
    expect(sameDaysPreviousMonth('2026-11-26')).toEqual({ from: '2026-10-01', to: '2026-10-26' });
  });

  it('clamps to the end of a shorter previous month (31 March vs 28 February)', () => {
    expect(sameDaysPreviousMonth('2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});

describe('monthPeriods', () => {
  const TODAY = '2026-11-26';

  it('This Month: month-to-date against the same days last month', () => {
    expect(monthPeriods(TODAY, 'thisMonth')).toEqual({
      current: { from: '2026-11-01', to: TODAY },
      previous: { from: '2026-10-01', to: '2026-10-26' },
    });
  });

  it('Last Month: the full previous month against the month before it', () => {
    expect(monthPeriods(TODAY, 'previousMonth')).toEqual({
      current: { from: '2026-10-01', to: '2026-10-31' },
      previous: { from: '2026-09-01', to: '2026-09-30' },
    });
  });

  it('All Time: lifetime to today, with no comparison', () => {
    expect(monthPeriods(TODAY, 'lifetime')).toEqual({
      current: { from: '2000-01-01', to: TODAY },
      previous: null,
    });
  });
});

describe('dayPeriods', () => {
  const TODAY = '2026-11-26';

  it('Today compares with yesterday', () => {
    expect(dayPeriods(TODAY, 'today')).toEqual({
      current: { from: TODAY, to: TODAY },
      previous: { from: '2026-11-25', to: '2026-11-25' },
    });
  });

  it('Yesterday compares with the day before', () => {
    expect(dayPeriods(TODAY, 'yesterday').current).toEqual({
      from: '2026-11-25',
      to: '2026-11-25',
    });
    expect(dayPeriods(TODAY, 'yesterday').previous).toEqual({
      from: '2026-11-24',
      to: '2026-11-24',
    });
  });

  it('a custom date compares with the day before that date', () => {
    expect(dayPeriods(TODAY, 'custom', '2026-11-10')).toEqual({
      current: { from: '2026-11-10', to: '2026-11-10' },
      previous: { from: '2026-11-09', to: '2026-11-09' },
    });
  });

  it('All Time is lifetime with no comparison', () => {
    expect(dayPeriods(TODAY, 'lifetime')).toEqual({
      current: { from: '2000-01-01', to: TODAY },
      previous: null,
    });
  });
});

describe('changePercent', () => {
  it('computes the real relative change', () => {
    expect(changePercent(125, 100)).toBeCloseTo(25, 10);
    expect(changePercent(80, 100)).toBeCloseTo(-20, 10);
  });

  it('is null, never a fake 0%, when the base is zero or missing', () => {
    expect(changePercent(10, 0)).toBeNull();
    expect(changePercent(null, 100)).toBeNull();
    expect(changePercent(10, null)).toBeNull();
  });
});
