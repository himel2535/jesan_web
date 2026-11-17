import { lookupBusiness } from '@/core/module-system/business-context';
import { settingsSections } from '@/core/settings/access';
import { UsersSection } from '@/core/settings/users-section';
import { Forbidden } from '@/core/ui/forbidden';

export default async function SettingsUsersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lookup = await lookupBusiness(slug);
  if (lookup.status !== 'ok') return null;
  const sections = settingsSections(lookup.business.permissions);
  if (!sections.any) return null; // layout shows 403
  if (!sections.users) return <Forbidden />;
  return <UsersSection slug={slug} businessId={lookup.business.id} />;
}
