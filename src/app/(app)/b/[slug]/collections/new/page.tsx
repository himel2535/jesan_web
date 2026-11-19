import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { CollectionForm } from '@/modules/dealership/sales/collections/collection-form';
import { PageHeader } from '@/core/ui/page-header';

export default async function NewCollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'collection.create');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.sales.collections');
  return (
    <>
      <PageHeader title={t('newTitle')} />
      <CollectionForm slug={slug} businessId={gate.business.id} />
    </>
  );
}
