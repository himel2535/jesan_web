import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { can, type PermissionRule } from '@/core/auth/permissions';
import type { MeBusiness } from '@/core/auth/types';
import { lookupBusiness } from '@/core/module-system/business-context';
import { Forbidden } from '@/core/ui/forbidden';
import { dealershipManifest } from '../manifest';

export type PageGate =
  { ok: true; business: MeBusiness; name: string } | { ok: false; element: ReactElement | null };

/**
 * Server-side gate for dealership pages: the business must be a dealership (else 404) and the
 * user must hold `permission` here (else the 403 page). UI convenience only: the API checks again.
 */
export async function dealershipPage(slug: string, permission: PermissionRule): Promise<PageGate> {
  const lookup = await lookupBusiness(slug);
  // Business layout already renders 403/404/"unavailable" for these.
  if (lookup.status !== 'ok') return { ok: false, element: null };
  if (lookup.business.type !== dealershipManifest.type) notFound();
  if (!can(lookup.business.permissions, permission)) return { ok: false, element: <Forbidden /> };
  return { ok: true, business: lookup.business, name: lookup.name };
}
