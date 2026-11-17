import { Settings } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { lookupBusiness } from '@/core/module-system/business-context';
import { settingsPath, settingsSections } from '@/core/settings/access';
import { EmptyState } from '@/core/ui/empty-state';

/** Opens the first section the user may see; otherwise says there is nothing here yet. */
export default async function SettingsIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [lookup, t] = await Promise.all([lookupBusiness(slug), getTranslations('settings')]);
  if (lookup.status !== 'ok') return null;
  const sections = settingsSections(lookup.business.permissions);
  if (!sections.any) return null; // layout shows 403
  if (sections.users) redirect(settingsPath(slug, 'users'));
  if (sections.roles) redirect(settingsPath(slug, 'roles'));
  return (
    <EmptyState icon={Settings} title={t('nothingTitle')} description={t('nothingDescription')} />
  );
}
