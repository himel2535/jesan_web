import { Skeleton, SkeletonText } from '@/core/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-card border border-border p-5">
            <SkeletonText lines={3} />
          </div>
        ))}
      </div>
    </div>
  );
}
