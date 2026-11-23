'use client';

import { useId } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export interface SparklineProps {
  data: Array<{ date: string; value: number }>;
  color?: string;
  height?: number;
  loading?: boolean;
}

export function Sparkline({
  data,
  color = 'var(--success)',
  height = 40,
  loading = false,
}: SparklineProps) {
  const gradientId = useId();

  if (loading || !data || data.length === 0) {
    return <div className="h-10 w-full rounded bg-surface-muted" />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis hide domain={['dataMin - 10%', 'dataMax + 10%']} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
