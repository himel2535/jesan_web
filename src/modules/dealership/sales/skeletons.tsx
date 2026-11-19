'use client';

import { Skeleton } from '@/core/ui/skeleton';

/**
 * One skeleton per page, shaped like the page that follows: a filter bar and ten rows for a
 * list, a summary block and a line table for a detail page. Never a skeleton inside a
 * skeleton, and never a blank screen.
 */
export function ListSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="space-y-2 rounded-card border border-border p-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-busy="true" className="space-y-5">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-3 rounded-card border border-border p-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      <div className="space-y-2 rounded-card border border-border p-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}

/** The form pages: a few fields, a line area and the buttons. */
export function FormSkeleton() {
  return (
    <div aria-busy="true" className="max-w-4xl space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-11 w-40" />
    </div>
  );
}
