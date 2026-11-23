'use client';

import { CardBlock } from './card-block';

interface CardBlockSkeletonProps {
  title: string;
  count?: number;
  subtitle?: string;
}

export function CardBlockSkeleton({ title, count = 4, subtitle }: CardBlockSkeletonProps) {
  return (
    <CardBlock title={title} subtitle={subtitle}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface border border-border rounded-lg p-4 min-h-28 animate-pulse"
        >
          <div className="h-4 bg-skeleton rounded w-24 mb-6"></div>
          <div className="h-6 bg-skeleton rounded w-32"></div>
        </div>
      ))}
    </CardBlock>
  );
}

export function DashboardSectionSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <CardBlockSkeleton title="Loading..." count={count} />
    </div>
  );
}
