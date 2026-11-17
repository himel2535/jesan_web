'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';

/**
 * Warns before unsaved changes are lost:
 * - closing or reloading the tab → the browser's own beforeunload prompt;
 * - clicking any link inside the app → our dialog, then navigation on "Leave".
 * Limitation (DECISIONS.md): the browser Back button inside the App Router cannot be intercepted.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const t = useTranslations('settings.roles');
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const dialog = (
    <ConfirmDialog
      open={pendingHref !== null}
      title={t('leaveTitle')}
      confirmLabel={t('leave')}
      cancelLabel={t('stay')}
      danger
      onCancel={() => setPendingHref(null)}
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (href) router.push(href);
      }}
    >
      {t('leaveBody')}
    </ConfirmDialog>
  );

  return { dialog };
}
