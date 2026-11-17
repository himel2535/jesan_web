import { getLocale, getTranslations } from 'next-intl/server';
import { requireSession } from '@/core/auth/session';
import { localizedName, type Me, type MeBusiness } from '@/core/auth/types';
import type { ModuleManifest } from './types';

export type BusinessLookup =
  | { status: 'ok'; me: Me; business: MeBusiness; name: string }
  | { status: 'forbidden'; me: Me }
  | { status: 'notFound' }
  | { status: 'unavailable' };

/**
 * Finds the business of a /b/[slug] URL in the user's GET /auth/me (cached for the request).
 * - Platform owners can open every active business, so an unknown slug is a real 404.
 * - Everyone else gets one 403 for "unknown" and "no access" alike, like the API (§5), so the page
 *   never reveals whether a business exists.
 */
export async function lookupBusiness(slug: string): Promise<BusinessLookup> {
  const [session, locale] = await Promise.all([requireSession(), getLocale()]);
  if (session.status !== 'authenticated') return { status: 'unavailable' };
  const business = session.me.businesses.find((b) => b.slug === slug);
  if (business)
    return { status: 'ok', me: session.me, business, name: localizedName(business, locale) };
  return session.me.user.isPlatformOwner
    ? { status: 'notFound' }
    : { status: 'forbidden', me: session.me };
}

/** Translates a module's own key (e.g. `dealership.nav.sales`), which is not known statically. */
export async function moduleTranslator(manifest: ModuleManifest) {
  const t = (await getTranslations()) as unknown as (key: string) => string;
  return (key: string) => t(`${manifest.namespace}.${key}`);
}
