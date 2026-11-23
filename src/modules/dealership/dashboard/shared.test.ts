import { describe, expect, it } from 'vitest';
import { commissionProgress, formatAchievementPct } from './shared';

const scheme = { rateBase: '10.00', targetQty: '40000', bonusRate: '1.00', updatedAt: '' };

describe('commissionProgress', () => {
  it('never caps achievementPct at 100 when the target is exceeded', () => {
    const progress = commissionProgress(scheme, 44000);
    expect(progress?.achievementPct).toBeCloseTo(110);
  });

  it('floors remainingQty at 0 once the target is achieved or exceeded', () => {
    const progress = commissionProgress(scheme, 50000);
    expect(progress?.remainingQty).toBe(0);
  });

  it('computes a small real percentage below 1% without rounding it away', () => {
    const progress = commissionProgress(scheme, 110);
    expect(progress?.achievementPct).toBeCloseTo(0.275);
  });

  it('returns null without a configured scheme', () => {
    expect(commissionProgress(null, 100)).toBeNull();
  });
});

describe('formatAchievementPct', () => {
  it('shows one decimal for a nonzero value below 1%', () => {
    expect(formatAchievementPct(0.275)).toBe('0.3');
  });

  it('rounds to a whole number at or above 1%', () => {
    expect(formatAchievementPct(45.6)).toBe('46');
  });

  it('shows real values over 100% uncapped', () => {
    expect(formatAchievementPct(275.4)).toBe('275');
  });

  it('shows exactly "0" for a true zero', () => {
    expect(formatAchievementPct(0)).toBe('0');
  });
});
