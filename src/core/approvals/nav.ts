import { can } from '@/core/auth/permissions';
import type { MeBusiness } from '@/core/auth/types';
import { businessBasePath } from '@/core/module-system/business-nav';
import type { NavItem } from '@/core/navigation/types';

/** Who sees "Approvals" in the sidebar (UI only; the API checks every call). */
export const APPROVALS_RULE = { anyOf: ['change.view.own', 'change.view.all'] } as const;

/**
 * Adds the core "Approvals" entry to a business sidebar (before Settings, else at the end) when
 * the user may see their own or everyone's requests. Its badge shows only with
 * `change.view.all`; the badge component decides that itself.
 */
export function withApprovalsEntry(
  items: NavItem[],
  business: Pick<MeBusiness, 'slug' | 'permissions'>,
  label: string,
): NavItem[] {
  if (!can(business.permissions, APPROVALS_RULE)) return items;
  const entry: NavItem = {
    key: 'approvals',
    label,
    href: `${businessBasePath(business.slug)}/approvals`,
    icon: 'approvals',
    badge: 'pendingApprovals',
  };
  const at = items.findIndex((i) => i.key === 'settings');
  return at === -1 ? [...items, entry] : [...items.slice(0, at), entry, ...items.slice(at)];
}
