import { can } from '@/core/auth/permissions';

/**
 * What a user may see in Settings (UI only; the API enforces every call):
 * - Settings at all: `settings.view`.
 * - Users: `users.view` (list); `users.manage` adds the buttons.
 * - Roles & permissions: `roles.manage` only — deliberately not shown read-only to others
 *   (owner decision; DECISIONS.md).
 */
export function settingsSections(permissions: readonly string[]) {
  return {
    any: can(permissions, 'settings.view'),
    users: can(permissions, 'users.view'),
    roles: can(permissions, 'roles.manage'),
  };
}

export const settingsPath = (slug: string, section?: 'users' | 'roles') =>
  `/b/${encodeURIComponent(slug)}/settings${section ? `/${section}` : ''}`;
