import { can } from '@/core/auth/permissions';
import type { MeBusiness } from '@/core/auth/types';
import type { NavItem } from '@/core/navigation/types';
import type { ModuleManifest, ModuleNavEntry } from './types';

export function businessBasePath(slug: string): string {
  return `/b/${encodeURIComponent(slug)}`;
}

/** The sidebar of one business: the module's entries the user is allowed to see, in order. */
export function buildBusinessNav(
  manifest: ModuleManifest,
  business: Pick<MeBusiness, 'slug' | 'permissions'>,
  label: (entryKey: string) => string,
): NavItem[] {
  const base = businessBasePath(business.slug);
  return manifest.nav
    .filter((entry) => can(business.permissions, entry.permission))
    .map((entry) => ({
      key: entry.key,
      label: label(entry.key),
      href: entry.path ? `${base}/${entry.path}` : base,
      icon: entry.icon,
      prefetch: entry.prefetch,
      exact: entry.path === '',
    }));
}

/** The manifest entry for a feature path such as ['sales'], or undefined. */
export function findNavEntry(
  manifest: ModuleManifest,
  segments: readonly string[],
): ModuleNavEntry | undefined {
  const path = segments.join('/');
  return manifest.nav.find((entry) => entry.path !== '' && entry.path === path);
}
