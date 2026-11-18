import { APPROVALS_RULE } from '@/core/approvals/nav';
import { ApprovalDetail } from '@/core/approvals/detail';
import { approvalsPage } from '@/core/approvals/gate';

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await approvalsPage(slug, APPROVALS_RULE);
  if (!gate.ok) return gate.element;
  return <ApprovalDetail slug={slug} id={id} />;
}
