import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { ExpenseForm } from '@/modules/dealership/expenses/expense-form';
import { PageHeader } from '@/core/ui/page-header';

export default async function NewExpensePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'expense.create');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.expenses');
  return (
    <>
      <PageHeader title={t('newTitle')} />
      <ExpenseForm slug={slug} businessId={gate.business.id} />
    </>
  );
}
