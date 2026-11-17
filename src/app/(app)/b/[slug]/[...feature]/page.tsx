import { Hourglass } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { can } from '@/core/auth/permissions';
import { lookupBusiness, moduleTranslator } from '@/core/module-system/business-context';
import { findNavEntry } from '@/core/module-system/business-nav';
import { Forbidden } from '@/core/ui/forbidden';
import { PageHeader } from '@/core/ui/page-header';
import { StatusPage } from '@/core/ui/status-page';
import { getModuleManifest } from '@/modules/registry';

/**
 * Feature pages of a business module. Until each feature is built they say "coming soon".
 * A menu entry hidden by permissions is also refused when its URL is typed directly.
 */
export default async function BusinessFeaturePage({
  params,
}: {
  params: Promise<{ slug: string; feature: string[] }>;
}) {
  const { slug, feature } = await params;
  const [lookup, t] = await Promise.all([lookupBusiness(slug), getTranslations('business')]);
  if (lookup.status !== 'ok') return null;

  const manifest = getModuleManifest(lookup.business.type);
  const entry = manifest ? findNavEntry(manifest, feature) : undefined;
  if (!manifest || !entry) notFound();
  if (!can(lookup.business.permissions, entry.permission)) return <Forbidden />;

  const label = (await moduleTranslator(manifest))(`nav.${entry.key}`);
  return (
    <>
      <PageHeader title={label} />
      <StatusPage
        icon={Hourglass}
        headingLevel={2}
        title={t('comingSoonTitle')}
        description={t('comingSoonDescription', { business: lookup.name })}
      />
    </>
  );
}
