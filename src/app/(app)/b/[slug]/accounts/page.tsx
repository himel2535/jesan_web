import { getTranslations } from 'next-intl/server';
import { AccountsView } from '@/modules/dealership/accounts/accounts-view';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { PageHeader } from '@/core/ui/page-header';

export default async function AccountsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'ledger.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.accounts');
  return (
    <>
      <PageHeader
        title={t('page.title')}
        description={t('page.description', { business: gate.name })}
      />
      <AccountsView slug={slug} businessId={gate.business.id} />
    </>
  );
}
