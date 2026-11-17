import { ShieldX } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { StatusPage } from './status-page';

/**
 * "No access" (403). Next's forbidden() is still experimental, so this is rendered directly.
 * Hiding pages is a convenience; the API refuses the data anyway.
 */
export async function Forbidden() {
  const t = await getTranslations('business');
  return (
    <StatusPage
      icon={ShieldX}
      title={t('forbiddenTitle')}
      description={t('forbiddenDescription')}
      action={
        <Link
          href="/"
          className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          {t('backToDashboard')}
        </Link>
      }
    />
  );
}
