'use client';

import { ReactNode } from 'react';
import { Money } from '@/core/ui/money';
import { useFormat } from '@/core/i18n/format';
import { cn } from '@/core/lib/cn';

export type KPITone = 'neutral' | 'positive' | 'negative' | 'muted';

interface KPICardProps {
  label: string;
  value: string | number | null | undefined;
  unit?: ReactNode;
  tone?: KPITone;
  isMoney?: boolean;
  isLoading?: boolean;
  error?: boolean;
  decimals?: number;
}

export function KPICard({
  label,
  value,
  unit,
  tone = 'neutral',
  isMoney = false,
  isLoading = false,
  error = false,
  decimals = 0,
}: KPICardProps) {
  const { formatNumber } = useFormat();

  if (error) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4 min-h-28 flex flex-col justify-between">
        <p className="text-sm text-fg-muted">{label}</p>
        <p className="text-xs text-fg-error">Error loading</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4 min-h-28 flex flex-col justify-between animate-pulse">
        <div className="h-4 bg-skeleton rounded w-24"></div>
        <div className="h-6 bg-skeleton rounded w-32 mt-2"></div>
      </div>
    );
  }

  const toneColors: Record<KPITone, string> = {
    neutral: 'text-fg',
    positive: 'text-fg-success',
    negative: 'text-fg-error',
    muted: 'text-fg-muted',
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-4 min-h-28 flex flex-col justify-between hover:shadow-md transition-shadow">
      <p className="text-sm text-fg-muted">{label}</p>
      <div className="flex items-baseline gap-1">
        {isMoney && value !== null && value !== undefined ? (
          <Money value={String(value)} className={cn('text-lg font-semibold', toneColors[tone])} />
        ) : value !== null && value !== undefined ? (
          <>
            <span className={cn('text-lg font-semibold', toneColors[tone])}>
              {formatNumber(Number(value), { decimals })}
            </span>
            {unit && <span className="text-xs text-fg-muted">{unit}</span>}
          </>
        ) : (
          <span className="text-lg font-semibold text-fg-muted">—</span>
        )}
      </div>
    </div>
  );
}
