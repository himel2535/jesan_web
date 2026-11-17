import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { lookupBusiness } from '@/core/module-system/business-context';
import { settingsPath, settingsSections } from '@/core/settings/access';
import { SettingsNav } from '@/core/settings/settings-nav';
import { Forbidden } from '@/core/ui/forbidden';
import { PageHeader } from '@/core/ui/page-header';

/** Settings of one business: needs `settings.view` (UI gate; the API checks every call). */
export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [lookup, t] = await Promise.all([lookupBusiness(slug), getTranslations('settings')]);
  if (lookup.status !== 'ok') return null; // the business layout already shows 403/404/unavailable
  const sections = settingsSections(lookup.business.permissions);
  if (!sections.any) return <Forbidden />;

  const items = [
    ...(sections.users ? [{ href: settingsPath(slug, 'users'), label: t('tabUsers') }] : []),
    ...(sections.roles ? [{ href: settingsPath(slug, 'roles'), label: t('tabRoles') }] : []),
  ];

  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: lookup.name })} />
      <SettingsNav label={t('navLabel')} items={items} />
      {children}
    </>
  );
}
