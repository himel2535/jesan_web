'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { NavItem } from '@/core/navigation/types';
import { NavLinks } from './nav-links';
import { useDialog } from './use-dialog';

/**
 * Phone navigation: a modal drawer (native <dialog>: focus trap, Esc, inert background).
 * Solid surface, not glass: over page content a translucent drawer is hard to read.
 */
export function MobileDrawer({
  items,
  open,
  onClose,
}: {
  items: NavItem[];
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const ref = useDialog(open, onClose);

  return (
    <dialog
      ref={ref}
      aria-label={t('nav.label')}
      className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-r border-border bg-surface p-3 text-fg shadow-glass md:hidden"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="px-2 text-base font-semibold">{t('common.appName')}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-surface-muted"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <nav>
        <NavLinks items={items} onNavigate={onClose} />
      </nav>
    </dialog>
  );
}
