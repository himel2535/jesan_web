import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { CommissionView } from '@/modules/dealership/commission/commission-view';
import { PageHeader } from '@/core/ui/page-header';

export default async function CommissionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'commission.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.commission');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <CommissionView slug={slug} businessId={gate.business.id} />
    </>
  );
}
