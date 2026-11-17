import { lookupBusiness } from '@/core/module-system/business-context';
import { settingsSections } from '@/core/settings/access';
import { RolesMatrix } from '@/core/settings/roles-matrix';
import { Forbidden } from '@/core/ui/forbidden';

export default async function SettingsRolesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lookup = await lookupBusiness(slug);
  if (lookup.status !== 'ok') return null;
  const sections = settingsSections(lookup.business.permissions);
  if (!sections.any) return null; // layout shows 403
  // Only `roles.manage` (platform owner): no read-only matrix for others, by decision.
  if (!sections.roles) return <Forbidden />;
  return <RolesMatrix slug={slug} businessId={lookup.business.id} />;
}
