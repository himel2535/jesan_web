/**
 * The page-shaped skeletons live in core (`src/core/ui/skeleton.tsx`) so every page of every
 * module loads with the same shape. Re-exported here because the sales pages import them from
 * their own folder.
 */
export { DetailSkeleton, FormSkeleton, ListSkeleton } from '@/core/ui/skeleton';
