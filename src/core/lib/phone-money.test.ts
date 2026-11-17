import { describe, expect, it } from 'vitest';
import {
  MONEY_PATTERN,
  SIGNED_MONEY_PATTERN,
  absoluteMoney,
  cleanMoneyInput,
  isNegativeMoney,
  sameMoney,
} from './money';
import { normalizePhone, toLatinDigits } from './phone';

describe('normalizePhone (same rule as jesan-api)', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['+8801712345678', '+8801712345678'],
    ['017-1234 5678', '+8801712345678'],
    ['০১৭১২৩৪৫৬৭৮', '+8801712345678'],
    ['01000000099', '+8801000000099'],
    ['+447911123456', '+447911123456'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '12345', '0171234567', 'abc', '+0123456789'])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it('converts Bengali digits', () => {
    expect(toLatinDigits('৫৭০.৫০')).toBe('570.50');
  });
});

describe('money strings (never numbers)', () => {
  it('matches the API patterns: up to 12 digits, up to 2 decimals', () => {
    for (const ok of ['0', '570', '570.5', '570.50', '999999999999.99'])
      expect(MONEY_PATTERN.test(ok), ok).toBe(true);
    for (const bad of ['-1', '570.505', '1234567890123', '1,000', '', '.5', '5.'])
      expect(MONEY_PATTERN.test(bad), bad).toBe(false);
    expect(SIGNED_MONEY_PATTERN.test('-200.50')).toBe(true);
  });

  it('cleans typed input: Bengali digits, commas, spaces', () => {
    expect(cleanMoneyInput(' ১২,৩৪,৫৬৭.৫০ ')).toBe('1234567.50');
  });

  it('detects advances by the sign, keeps the digits exact', () => {
    expect(isNegativeMoney('-12500.50')).toBe(true);
    expect(isNegativeMoney('12500.50')).toBe(false);
    expect(absoluteMoney('-99999999999.99')).toBe('99999999999.99');
  });

  it('compares amounts as text ("570" equals "570.00")', () => {
    expect(sameMoney('570', '570.00')).toBe(true);
    expect(sameMoney('570.5', '570.50')).toBe(true);
    expect(sameMoney('0570', '570.00')).toBe(true);
    expect(sameMoney('-200.5', '-200.50')).toBe(true);
    expect(sameMoney('570.01', '570.00')).toBe(false);
    expect(sameMoney('200', '-200')).toBe(false);
    expect(sameMoney(null, '')).toBe(true);
    expect(sameMoney(null, '0')).toBe(false);
  });
});
