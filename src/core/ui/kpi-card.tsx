'use client';

import { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from './cn';

export const KPI_VARIANTS = ['blue', 'green', 'purple', 'orange', 'pink', 'aqua'] as const;
export type KPIVariant = (typeof KPI_VARIANTS)[number];

const VARIANT_CLASSES: Record<KPIVariant, { card: string; icon: string }> = {
  blue: {
    card: 'bg-[var(--dash-blue-card-bg)] border-[var(--dash-blue-card-border)]',
    icon: 'bg-[var(--dash-blue-icon-bg)] text-[var(--dash-icon-fg)]',
  },
  green: {
    card: 'bg-[var(--dash-green-card-bg)] border-[var(--dash-green-card-border)]',
    icon: 'bg-[var(--dash-green-icon-bg)] text-[var(--dash-icon-fg)]',
  },
  purple: {
    card: 'bg-[var(--dash-purple-card-bg)] border-[var(--dash-purple-card-border)]',
    icon: 'bg-[var(--dash-purple-icon-bg)] text-[var(--dash-icon-fg)]',
  },
  orange: {
    card: 'bg-[var(--dash-orange-card-bg)] border-[var(--dash-orange-card-border)]',
    icon: 'bg-[var(--dash-orange-icon-bg)] text-[var(--dash-icon-fg-on-orange)]',
  },
  pink: {
    card: 'bg-[var(--dash-pink-card-bg)] border-[var(--dash-pink-card-border)]',
    icon: 'bg-[var(--dash-pink-icon-bg)] text-[var(--dash-icon-fg)]',
  },
  aqua: {
    card: 'bg-[var(--dash-aqua-card-bg)] border-[var(--dash-aqua-card-border)]',
    icon: 'bg-[var(--dash-aqua-icon-bg)] text-[var(--dash-icon-fg)]',
  },
};

export interface KPICardProps {
  variant: KPIVariant;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  /** Real (thisMonth vs previousMonth) % change, or omit entirely when not computable — never fabricated. */
  change?: { value: number; label: string };
  loading?: boolean;
  className?: string;
}

export function KPICard({
  variant,
  icon,
  label,
  value,
  change,
  loading = false,
  className,
}: KPICardProps) {
  const classes = VARIANT_CLASSES[variant];
  const positive = (change?.value ?? 0) >= 0;

  return (
    <div
      className={cn(
        'flex min-h-[112px] items-center gap-4 rounded-card border p-4',
        classes.card,
        className,
      )}
    >
      <div
        className={cn(
          'inline-flex size-12 shrink-0 items-center justify-center rounded-full',
          classes.icon,
        )}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--dash-fg-muted)]">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-6 w-24 animate-pulse rounded bg-[var(--dash-border)]" />
        ) : (
          <p className="truncate text-xl font-bold text-[var(--dash-fg)]">{value}</p>
        )}
        {change && !loading && (
          <p
            className={cn(
              'mt-0.5 flex items-center gap-1 text-xs font-medium',
              positive ? 'text-[var(--dash-success)]' : 'text-[var(--dash-danger)]',
            )}
          >
            {positive ? (
              <TrendingUp aria-hidden className="size-3.5" />
            ) : (
              <TrendingDown aria-hidden className="size-3.5" />
            )}
            {positive ? '+' : ''}
            {change.value.toFixed(1)}% {change.label}
          </p>
        )}
      </div>
    </div>
  );
}
