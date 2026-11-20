'use client';

import { useLinkStatus } from 'next/link';

/**
 * A thin bar at the top of the viewport while the link the user just clicked is still loading.
 *
 * Deliberately not a route `loading.tsx`: a route fallback is a Suspense boundary, so it
 * unmounts the page under it — the rows of a list vanish on every page or filter change, and the
 * user then watches the shape change twice (fallback, then the page's own skeleton). With no
 * boundary the current page stays on screen until the next one is ready, each page shows exactly
 * one skeleton, and `keepPreviousData` can dim the old rows instead of clearing them
 * (DECISIONS.md). This bar is the click's answer in the meantime: pure CSS, no library, no blur.
 *
 * Must be rendered inside the `<Link>` it reports on (`useLinkStatus`).
 */
export function RouteProgress() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 block h-0.5">
      <span className="block h-full w-1/3 route-progress bg-primary" />
    </span>
  );
}
