'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';
import { cn } from './cn';
import { useDialog } from './use-dialog';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const t = useTranslations('common');
  const ref = useDialog(open, onClose);
  const titleId = useId();

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn(
        'm-auto w-[min(32rem,calc(100%-2rem))] rounded-card glass p-0 text-fg',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-surface-muted"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
