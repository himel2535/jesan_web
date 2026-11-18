import type { PermissionRule } from '@/core/auth/permissions';
import type { NavIconName } from '@/core/ui/icons';
import type { NavPrefetch } from '@/core/navigation/types';

/**
 * A business module describes itself here (proposal §3, rule 5); core builds the sidebar from it
 * and never knows any business by name.
 */
export interface ModuleNavEntry {
  key: string;
  /** Path inside the business: '' is the business dashboard, 'sales' is /b/[slug]/sales. */
  path: string;
  icon: NavIconName;
  /** Hide the entry unless the user has this permission in the business (UI hint only). */
  permission?: PermissionRule;
  prefetch?: NavPrefetch;
}

export interface ModuleManifest {
  /** Business `type` from the API, e.g. "dealership". */
  type: string;
  /**
   * Translation namespace of the module in messages/*.json. It must contain `typeName` and a
   * `nav` object with one label per entry key.
   */
  namespace: string;
  nav: readonly ModuleNavEntry[];
  /**
   * Records that change requests (docs/API.md §10) can be about, by API `entityType`: where the
   * record's page is, and which entity query keys to refresh after an approval. Plain data, so
   * the server can hand it to client components.
   */
  changeEntities?: Readonly<Record<string, ChangeEntityConfig>>;
}

export interface ChangeEntityConfig {
  /** Page of one record inside the business, with `:id`, e.g. 'products/:id'. */
  path: string;
  /** Entity keys of the module to refresh after an approval, e.g. ['products']. */
  invalidate: readonly string[];
}
