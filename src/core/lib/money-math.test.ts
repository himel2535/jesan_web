import { describe, expect, it } from 'vitest';
import { multiplyMoney, sumMoney } from './money';
import { isPositiveQuantity, signedQuantity, sumQuantity } from './quantity';

describe('display-only decimal math (BigInt, never Number)', () => {
  it('multiplies quantity × price, half up to 2 decimals like the API', () => {
    expect(multiplyMoney('500', '570')).toBe('285000.00');
    expect(multiplyMoney('200', '545.50')).toBe('109100.00');
    expect(multiplyMoney('1', '0.005')).toBe('0.01');
    expect(multiplyMoney('3', '0.333')).toBe('1.00');
    expect(multiplyMoney('12.5', '10.01')).toBe('125.13');
    expect(multiplyMoney('999999999999', '999999999999.99')).toBe('999999999998990000000000.01');
    expect(multiplyMoney('x', '1')).toBeNull();
    expect(multiplyMoney('1', '-1')).toBeNull();
  });

  it('sums money strings exactly', () => {
    expect(sumMoney(['285000.00', '109100.00'])).toBe('394100.00');
    expect(sumMoney(['0.1', '0.2'])).toBe('0.30');
    expect(sumMoney(['-5', '2.50'])).toBe('-2.50');
    expect(sumMoney([])).toBe('0.00');
    expect(sumMoney(['abc'])).toBeNull();
  });

  it('quantities by unit decimals', () => {
    expect(isPositiveQuantity('500', 0)).toBe(true);
    expect(isPositiveQuantity('12.5', 0)).toBe(false);
    expect(isPositiveQuantity('12.5', 1)).toBe(true);
    expect(isPositiveQuantity('0', 0)).toBe(false);
    expect(signedQuantity('-৩', 0)).toBe('-3');
    expect(signedQuantity('+5', 0)).toBe('5');
    expect(signedQuantity('0', 0)).toBeNull();
    expect(sumQuantity(['500', '200'])).toBe('700');
    expect(sumQuantity(['1.25', '2.5'])).toBe('3.75');
    expect(sumQuantity(['1.5', '1.5'])).toBe('3');
  });
});
