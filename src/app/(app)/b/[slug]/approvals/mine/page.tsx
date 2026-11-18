import { getTranslations } from 'next-intl/server';
import { approvalsPage } from '@/core/approvals/gate';
import { ApprovalsList } from '@/core/approvals/list';
import { ApprovalsTabs } from '@/core/approvals/tabs';
import { PageHeader } from '@/core/ui/page-header';

export default async function ApprovalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await approvalsPage(slug, 'change.view.own');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('approvals');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <ApprovalsTabs slug={slug} />
      <ApprovalsList slug={slug} scope="mine" />
    </>
  );
}
