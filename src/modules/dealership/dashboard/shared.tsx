'use client';

import { useMemo } from 'react';
import { businessToday } from '@/core/i18n/format';
import type { CommissionScheme } from '../commission/types';
import { LIFETIME_FROM } from '../expenses/shared';

function isoOf(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

export interface DashboardRanges {
  total: { from: string; to: string };
  today: { from: string; to: string };
  thisMonth: { from: string; to: string };
  previousMonth: { from: string; to: string };
}

/**
 * The dashboard's four fixed windows, anchored on the business's "today" (Dhaka time) — the
 * same `isoOf`/lifetime-from pattern every other module's KPI cards already use
 * (accounts/sales/purchases/expenses `shared.tsx`), duplicated here rather than importing one of
 * those modules' hooks so the dashboard never depends on another module's page-specific type.
 */
export function useDashboardRanges(): DashboardRanges {
  const today = useMemo(() => businessToday(), []);
  return useMemo(() => {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    return {
      total: { from: LIFETIME_FROM, to: today },
      today: { from: today, to: today },
      thisMonth: { from: isoOf(y, m - 1, 1), to: today },
      previousMonth: { from: isoOf(y, m - 2, 1), to: isoOf(y, m - 1, 0) },
    };
  }, [today]);
}

/** A genuine (thisMonth vs previousMonth) % change, or `null` when it can't be computed (no prior-month data to compare against — never fabricated as 0%). */
export function monthOverMonthChange(thisMonth: string, previousMonth: string): number | null {
  const prev = Number(previousMonth);
  const curr = Number(thisMonth);
  if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export interface CommissionProgress {
  targetQty: number;
  achievedQty: number;
  achievementPct: number;
  remainingQty: number;
  estimatedCommission: number;
}

/**
 * Purchase-based (not sales-based) progress against the commission scheme's bonus threshold
 * (`targetQty`) — the backend has no sales-target concept. See DECISIONS.md "Commission Target
 * Progress". Formula matches docs/API.md's commission-entry calculation exactly:
 * `baseAmount = quantity × rateBase`; `bonusAmount = max(0, quantity − targetQty) × bonusRate`.
 * Shared by the 8th KPI card and the Target & Commission Progress panel.
 */
export function commissionProgress(
  scheme: CommissionScheme | null | undefined,
  achievedQty: number,
): CommissionProgress | null {
  if (!scheme) return null;
  const targetQty = Number(scheme.targetQty);
  const rateBase = Number(scheme.rateBase);
  const bonusRate = Number(scheme.bonusRate);
  const achievementPct = targetQty > 0 ? (achievedQty / targetQty) * 100 : 0;
  const remainingQty = Math.max(targetQty - achievedQty, 0);
  const baseAmount = achievedQty * rateBase;
  const bonusAmount = Math.max(0, achievedQty - targetQty) * bonusRate;
  return {
    targetQty,
    achievedQty,
    achievementPct,
    remainingQty,
    estimatedCommission: baseAmount + bonusAmount,
  };
}

/** Current month's purchased bags from `purchase-counters`' months array (`YYYY-MM` key). */
export function achievedQtyForMonth(
  months: { month: string; quantity: string }[] | undefined,
  month: string,
): number {
  const row = months?.find((m) => m.month === month);
  return row ? Number(row.quantity) : 0;
}

/**
 * Formats a real (never capped) achievement percentage for display: one decimal place when the
 * true value is a nonzero fraction below 1% (so e.g. 0.275% reads as "0.3%" instead of a
 * misleading "0%"), otherwise a whole number — including values over 100%, shown as-is (see
 * DECISIONS.md "Commission Target Progress").
 */
export function formatAchievementPct(pct: number): string {
  return pct > 0 && pct < 1 ? pct.toFixed(1) : pct.toFixed(0);
}
