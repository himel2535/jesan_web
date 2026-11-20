import { getTranslations } from 'next-intl/server';
import { CashBookView } from '@/modules/dealership/cash-book/cash-book-view';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { PageHeader } from '@/core/ui/page-header';

export default async function CashBookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'cashbook.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.cashBook');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <CashBookView slug={slug} businessId={gate.business.id} />
    </>
  );
}
