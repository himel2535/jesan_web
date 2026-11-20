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
  /**
   * The first list the page shows, so hovering the link can warm that one query as well as the
   * route (`NavPrefetch`). Plain data, because the server layout hands it to a client component:
   * `params` must be exactly the key the page's own hook builds for its unfiltered first page,
   * or the prefetch lands under a key nothing reads (`nav-prefetch.test.ts` checks every entry).
   */
  listPrefetch?: ListPrefetch;
}

export interface ListPrefetch {
  /** Entity segment of the query key, e.g. 'orders'. */
  entity: string;
  /** Endpoint inside the business, e.g. 'orders' for GET /b/:slug/orders. */
  path: string;
  /** Query string and key params of the page's first, unfiltered request. */
  params?: Readonly<Record<string, string | number>>;
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
