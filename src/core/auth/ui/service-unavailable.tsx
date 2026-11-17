'use client';

import { ServerCrash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/core/ui/button';
import { StatusPage } from '@/core/ui/status-page';

/**
 * The API could not be reached while checking the session. Not a reason to log the user out:
 * show this and let them retry.
 */
export function ServiceUnavailable() {
  const t = useTranslations('session');
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center p-6">
      <StatusPage
        icon={ServerCrash}
        title={t('unavailableTitle')}
        description={t('unavailableDescription')}
        action={<Button onClick={() => window.location.reload()}>{t('retry')}</Button>}
      />
    </main>
  );
}
