'use client';

import { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from './cn';
import { Sparkline, SparklineProps } from './sparkline';

export interface KPICardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  change?: {
    value: number; // percentage
    positive?: boolean;
  };
  sparkline?: SparklineProps;
  loading?: boolean;
  className?: string;
  iconColor?: string;
}

export function KPICard({
  icon,
  label,
  value,
  change,
  sparkline,
  loading = false,
  className,
  iconColor = 'bg-primary text-primary-fg',
}: KPICardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-card border border-border bg-surface p-4',
        className,
      )}
    >
      {/* Header: Icon and Trend */}
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-lg',
            iconColor,
          )}
        >
          {icon}
        </div>

        {/* Trend Indicator */}
        {change && (
          <div className="flex items-center gap-1">
            {change.positive ? (
              <TrendingUp className="size-4 text-success" />
            ) : (
              <TrendingDown className="size-4 text-warning" />
            )}
            <span
              className={cn(
                'text-xs font-semibold',
                change.positive ? 'text-success' : 'text-warning',
              )}
            >
              {change.positive ? '+' : ''}
              {change.value.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Label and Value */}
      <div className="flex flex-col gap-1">
        <p className="text-sm text-fg-muted">{label}</p>
        <p
          className={cn(
            'text-lg font-bold',
            loading && 'h-6 w-24 animate-pulse rounded bg-surface-muted',
          )}
        >
          {!loading && value}
        </p>
      </div>

      {/* Sparkline Chart */}
      {sparkline && (
        <div className="mt-auto">
          <Sparkline {...sparkline} loading={loading} />
        </div>
      )}
    </div>
  );
}
