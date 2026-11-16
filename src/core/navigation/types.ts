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
}
