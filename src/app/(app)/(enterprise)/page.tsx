import { Building2 } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireSession } from '@/core/auth/session';
import { localizedName } from '@/core/auth/types';
import { businessBasePath } from '@/core/module-system/business-nav';
import { BusinessCard } from '@/core/ui/business-card';
import { EmptyState } from '@/core/ui/empty-state';
import { PageHeader } from '@/core/ui/page-header';
import { getModuleManifest } from '@/modules/registry';

/**
 * Enterprise Dashboard: one card per business the user can open, straight from GET /auth/me
 * (already fetched for this request, so no extra call). Money summaries come in a later phase.
 */
export default async function EnterpriseDashboardPage() {
  const [session, t, locale] = await Promise.all([
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  if (session.status !== 'authenticated') return null;
  const translate = t as unknown as (key: string) => string;
  const { businesses } = session.me;

  return (
    <>
      <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />
      {businesses.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('dashboard.emptyTitle')}
          description={t('dashboard.emptyDescription')}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {businesses.map((business) => {
            const manifest = getModuleManifest(business.type);
            return (
              <li key={business.id}>
                <BusinessCard
                  href={businessBasePath(business.slug)}
                  name={localizedName(business, locale)}
                  typeLabel={manifest ? translate(`${manifest.namespace}.typeName`) : business.type}
                  roleText={t('dashboard.role', { role: localizedName(business.role, locale) })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
