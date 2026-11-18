import type { ReactElement } from 'react';
import { can, type PermissionRule } from '@/core/auth/permissions';
import type { MeBusiness } from '@/core/auth/types';
import { lookupBusiness } from '@/core/module-system/business-context';
import { Forbidden } from '@/core/ui/forbidden';

export type ApprovalsGate =
  { ok: true; business: MeBusiness; name: string } | { ok: false; element: ReactElement | null };

/** Server gate for approval pages: 403 page without the permission (UI only; the API checks). */
export async function approvalsPage(slug: string, rule: PermissionRule): Promise<ApprovalsGate> {
  const lookup = await lookupBusiness(slug);
  if (lookup.status !== 'ok') return { ok: false, element: null }; // the layout shows it
  if (!can(lookup.business.permissions, rule)) return { ok: false, element: <Forbidden /> };
  return { ok: true, business: lookup.business, name: lookup.name };
}
