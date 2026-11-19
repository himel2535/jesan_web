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

/** How a field's value reads: a quantity (bags), a business date, plain text, or money. */
export type ValueKind = 'quantity' | 'date' | 'text' | 'money';

/**
 * The kind of a request field by its stable name (docs/API.md §11). Purchase lines are
 * `items.<id>.quantity` / `items.<id>.unitPrice`; a large stock adjustment is `adjustBy`.
 */
export function kindOfField(field: string): ValueKind {
  if (field === 'adjustBy' || field === 'quantity' || field.endsWith('.quantity'))
    return 'quantity';
  if (field === 'purchaseDate') return 'date';
  if (field === 'note' || field === 'supplierReference') return 'text';
  return 'money';
}

/** The kind of an impact line: stock and bag counters are quantities (or `unit` says so). */
export function kindOfImpact(line: ImpactLine): ValueKind {
  const prefix = line.key.split('.')[0];
  if (line.unit || prefix === 'stock' || prefix === 'purchaseCounter') return 'quantity';
  return kindOfField(fieldOfImpact(line.key));
}

/**
 * Formats a request value for display. Money and quantities stay strings (formatted, never
 * computed); `isActive` reads as active/inactive; `creditLimit: null` means "no limit".
 */
export function useValueText() {
  const t = useTranslations('approvals.values');
  const format = useFormat();
  return useCallback(
    (field: string, value: unknown, kind: ValueKind = kindOfField(field)): string => {
      if (value === undefined) return t('empty');
      if (typeof value === 'boolean') return value ? t('active') : t('inactive');
      if (value === null) return field === 'creditLimit' ? t('noLimit') : t('empty');
      if (typeof value === 'number') return format.number(value);
      const text = String(value);
      if (kind === 'text') return text || t('empty');
      if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(text))
        return format.date(`${text}T00:00:00+06:00`);
      if (kind === 'quantity' && /^-?\d+(\.\d+)?$/.test(text)) return format.quantity(text);
      if (SIGNED_MONEY_PATTERN.test(text)) return format.money(text);
      return text;
    },
    [t, format],
  );
}

/** "+500.00" → "+৳500.00"; a quantity delta "-30" → "-30" (sign kept, amount formatted). */
export function useDeltaText() {
  const format = useFormat();
  return useCallback(
    (delta: string, kind: ValueKind = 'money') => {
      const sign = delta.startsWith('-') ? '-' : delta.startsWith('+') ? '+' : '';
      const amount = delta.replace(/^[+-]/, '');
      if (kind === 'quantity' && /^\d+(\.\d+)?$/.test(amount))
        return `${sign}${format.quantity(amount)}`;
      return SIGNED_MONEY_PATTERN.test(amount) ? `${sign}${format.money(amount)}` : delta;
    },
    [format],
  );
}

/**
 * Labels by stable key; an unknown key or field shows the API's English label (or the key).
 * Keys carrying an id (`stock.<productId>`, `purchaseCounter.<YYYY-MM>`) are translated by
 * their prefix, with the identifier (product code, month) taken from the end of the API label.
 */
export function useChangeLabels() {
  const dt = useDynamicT();
  return {
    field: (field: string) => {
      const line = /^items\.([^.]+)\.(quantity|unitPrice)$/.exec(field);
      if (line) {
        const name = dt(`approvals.fields.line_${line[2]}`, field);
        return `${name} · …${line[1]!.slice(-4)}`;
      }
      return dt(`approvals.fields.${field}`, field);
    },
    impact: (line: ImpactLine) => {
      const translated = dt(`approvals.impact.${line.key.replace(/\./g, '_')}`, '');
      if (translated) return translated;
      const prefix = line.key.split('.')[0]!;
      const name = dt(`approvals.impactPrefix.${prefix}`, '');
      if (!name) return line.label;
      const id = line.label.trim().split(/\s+/).at(-1) ?? '';
      return id ? `${name} ${id}` : name;
    },
    note: (line: ImpactLine) =>
      line.note && line.key.endsWith('.isActive') && line.after === false
        ? dt('approvals.notes.inactive', line.note)
        : line.note,
    entityType: (type: string) => dt(`approvals.entityTypes.${type}`, type),
  };
}

/** The field name of an impact key: `customer.currentBalance` → `currentBalance`. */
export const fieldOfImpact = (key: string) => key.slice(key.lastIndexOf('.') + 1);
