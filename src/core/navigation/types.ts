import type { ListPrefetch } from '@/core/module-system/types';
import type { NavIconName } from '@/core/ui/icons';

/**
 * How a sidebar link prefetches (proposal §9.2, rule 2):
 * - `false` (default): never; use for data-heavy pages (reports, accounts, lists).
 * - `'hover'`: only when the pointer or keyboard focus reaches the link.
 * - `true`: on viewport, only for light pages.
 */
export type NavPrefetch = boolean | 'hover';

/** A resolved, serializable sidebar entry. Module manifests will produce these later. */
export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: NavIconName;
  prefetch?: NavPrefetch;
  /** Active only on this exact path (e.g. a dashboard whose children are other entries). */
  exact?: boolean;
  /** A live count next to the label (rendered by a client component that fetches it). */
  badge?: 'pendingApprovals';
  /** With `prefetch: 'hover'`, the page's first list query is warmed on hover/focus too. */
  listPrefetch?: ListPrefetch;
}
