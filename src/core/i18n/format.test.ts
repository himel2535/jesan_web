import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatNumber, formatQuantity } from './format';

describe('formatNumber', () => {
  it('uses Bengali digits with lakh/crore grouping in bn', () => {
    expect(formatNumber(1234567, 'bn')).toBe('১২,৩৪,৫৬৭');
    expect(formatNumber(123456789, 'bn')).toBe('১২,৩৪,৫৬,৭৮৯');
  });

  it('uses Latin digits with lakh/crore grouping in en', () => {
    expect(formatNumber(1234567, 'en')).toBe('12,34,567');
  });
});

describe('formatMoney', () => {
  it('puts ৳ first with two decimals', () => {
    expect(formatMoney(1234567.5, 'bn')).toBe('৳১২,৩৪,৫৬৭.৫০');
    expect(formatMoney(1234567.5, 'en')).toBe('৳12,34,567.50');
    expect(formatMoney(0, 'en')).toBe('৳0.00');
  });

  it('keeps the minus sign before ৳', () => {
    expect(formatMoney(-570, 'en')).toBe('-৳570.00');
    expect(formatMoney('-1500.5', 'bn')).toBe('-৳১,৫০০.৫০');
  });

  it('formats Decimal strings from the API exactly (no float rounding)', () => {
    expect(formatMoney('12345678901234567.89', 'en')).toBe('৳12,34,56,78,90,12,34,567.89');
  });
});

describe('formatQuantity', () => {
  it('hides decimals for whole numbers and keeps up to 3 otherwise', () => {
    expect(formatQuantity('40000', 'bn')).toBe('৪০,০০০');
    expect(formatQuantity('12.345', 'en')).toBe('12.345');
    expect(formatQuantity(2.5, 'en', 0)).toBe('3');
  });
});

describe('formatDate', () => {
  it('shows the date in Bangladesh time regardless of the input zone', () => {
    // 20:00 UTC on 15 Nov is already 16 Nov in Dhaka (UTC+6).
    const date = new Date('2026-11-15T20:00:00Z');
    expect(formatDate(date, 'en')).toBe('16 Nov 2026');
    expect(formatDate(date, 'bn')).toContain('১৬');
  });
});
