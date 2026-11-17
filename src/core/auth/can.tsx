'use client';

import type { ReactNode } from 'react';
import { can, type PermissionRule } from './permissions';
import { useCurrentBusiness } from './session-context';

/**
 * UI convenience only — NOT security. It hides what the user cannot use in the current business,
 * based on the permission list from GET /auth/me. jesan-api checks every request itself (403) and
 * leaves out protected fields, so a hidden button is never the only protection.
 */
export function useCan(rule: PermissionRule): boolean {
  const business = useCurrentBusiness();
  return business ? can(business.permissions, rule) : false;
}

/** Renders `children` only when the current business grants `permission` (UI convenience only). */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionRule;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useCan(permission) ? children : fallback;
}
