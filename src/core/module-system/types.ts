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
}
