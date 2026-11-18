'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { SIGNED_MONEY_PATTERN } from '@/core/lib/money';
import { useDynamicT } from '@/core/i18n/use-dynamic-t';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import type { ChangeStatus, ImpactLine } from './types';

const STATUS_CLASS: Record<ChangeStatus, string> = {
  pending: 'border-warning text-warning',
  approved: 'border-success text-success',
  rejected: 'border-danger text-danger',
  cancelled: 'border-border text-fg-muted',
  stale: 'border-border text-fg-muted',
};

export function StatusPill({ status }: { status: ChangeStatus }) {
  const t = useTranslations('approvals.status');
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_CLASS[status] ?? STATUS_CLASS.cancelled,
      )}
    >
      {t(status)}
    </span>
  );
}

/**
 * Formats a request value for display. Money stays a string (formatted, never computed);
 * `isActive` reads as active/inactive; `creditLimit: null` means "no limit".
 */
export function useValueText() {
  const t = useTranslations('approvals.values');
  const format = useFormat();
  return useCallback(
    (field: string, value: unknown): string => {
      if (value === undefined) return t('empty');
      if (typeof value === 'boolean') return value ? t('active') : t('inactive');
      if (value === null) return field === 'creditLimit' ? t('noLimit') : t('empty');
      if (typeof value === 'string' && SIGNED_MONEY_PATTERN.test(value)) return format.money(value);
      if (typeof value === 'number') return format.number(value);
      return String(value);
    },
    [t, format],
  );
}

/** "+500.00" → "+৳500.00" (sign kept, amount formatted). */
export function useDeltaText() {
  const format = useFormat();
  return useCallback(
    (delta: string) => {
      const sign = delta.startsWith('-') ? '-' : delta.startsWith('+') ? '+' : '';
      const amount = delta.replace(/^[+-]/, '');
      return SIGNED_MONEY_PATTERN.test(amount) ? `${sign}${format.money(amount)}` : delta;
    },
    [format],
  );
}

/** Labels by stable key; an unknown key or field shows the API's English label (or the key). */
export function useChangeLabels() {
  const dt = useDynamicT();
  return {
    field: (field: string) => dt(`approvals.fields.${field}`, field),
    impact: (line: ImpactLine) =>
      dt(`approvals.impact.${line.key.replace(/\./g, '_')}`, line.label),
    note: (line: ImpactLine) =>
      line.note && line.key.endsWith('.isActive') && line.after === false
        ? dt('approvals.notes.inactive', line.note)
        : line.note,
    entityType: (type: string) => dt(`approvals.entityTypes.${type}`, type),
  };
}

/** The field name of an impact key: `customer.currentBalance` → `currentBalance`. */
export const fieldOfImpact = (key: string) => key.slice(key.lastIndexOf('.') + 1);
