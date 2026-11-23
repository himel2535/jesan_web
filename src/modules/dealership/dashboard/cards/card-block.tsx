'use client';

import { ReactNode } from 'react';

interface CardBlockProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  columns?: number;
}

export function CardBlock({ title, subtitle, children, columns = 4 }: CardBlockProps) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
      </div>
      <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(columns, 4)}`}>
        {children}
      </div>
    </div>
  );
}
