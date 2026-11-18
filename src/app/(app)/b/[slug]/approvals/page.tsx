import { redirect } from 'next/navigation';
import { can } from '@/core/auth/permissions';
import { lookupBusiness } from '@/core/module-system/business-context';
import { Forbidden } from '@/core/ui/forbidden';

/** Sends the user to the inbox they may see: everyone's (change.view.all) or their own. */
export default async function ApprovalsIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lookup = await lookupBusiness(slug);
  if (lookup.status !== 'ok') return null;
  const base = `/b/${encodeURIComponent(slug)}/approvals`;
  if (can(lookup.business.permissions, 'change.view.all')) redirect(`${base}/all`);
  if (can(lookup.business.permissions, 'change.view.own')) redirect(`${base}/mine`);
  return <Forbidden />;
}
