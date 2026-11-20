import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { ExpensesList } from '@/modules/dealership/expenses/expenses-list';
import { PageHeader } from '@/core/ui/page-header';

export default async function ExpensesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'expense.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.expenses');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <ExpensesList slug={slug} businessId={gate.business.id} />
    </>
  );
}
