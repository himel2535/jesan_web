'use client';

import { EllipsisVertical, Eye } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/core/ui/cn';
import { Dropdown } from '@/core/ui/dropdown';
import { DeactivateDialog } from './deactivate-dialog';

const menuItem =
  'flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-surface-muted';

/** Visible "Details" link for a row or card; its accessible name includes the record's name. */
export function DetailsLink({
  href,
  name,
  className,
}: {
  href: string;
  name: string;
  className?: string;
}) {
  const t = useTranslations('dealership.common');
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={t('detailsFor', { name })}
      className={cn(
        'inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-muted',
        className,
      )}
    >
      <Eye aria-hidden className="size-4" />
      {t('details')}
    </Link>
  );
}

/**
 * Per-row "Actions" menu: Edit (with the manage permission) and Deactivate/Activate (with the
 * deactivate permission; reason required). Items the user may not use are left out, and with no
 * items the menu is not shown at all. There is no Delete: records are never deleted (DECISIONS.md).
 */
export function RowActions({
  name,
  isActive,
  editHref,
  onEdit,
  canDeactivate,
  onToggleActive,
}: {
  name: string;
  isActive: boolean;
  /** Edit as a page link (products, customers)… */
  editHref?: string;
  /** …or as an action (categories open a dialog). Leave both out without the manage permission. */
  onEdit?: () => void;
  canDeactivate: boolean;
  onToggleActive: (reason: string) => Promise<unknown>;
}) {
  const t = useTranslations('dealership.common');
  const [confirming, setConfirming] = useState(false);
  const canEdit = Boolean(editHref || onEdit);
  if (!canEdit && !canDeactivate) return null;

  return (
    <>
      <Dropdown
        label={t('actionsFor', { name })}
        triggerClassName="size-10 justify-center"
        trigger={<EllipsisVertical aria-hidden className="size-5" />}
      >
        {(close) => (
          <div className="flex flex-col gap-1">
            {editHref ? (
              <Link href={editHref} prefetch={false} onClick={close} className={menuItem}>
                {t('edit')}
              </Link>
            ) : onEdit ? (
              <button
                type="button"
                className={menuItem}
                onClick={() => {
                  close();
                  onEdit();
                }}
              >
                {t('edit')}
              </button>
            ) : null}
            {canDeactivate ? (
              <button
                type="button"
                className={cn(menuItem, isActive && 'text-danger')}
                onClick={() => {
                  close();
                  setConfirming(true);
                }}
              >
                {isActive ? t('deactivate') : t('activate')}
              </button>
            ) : null}
          </div>
        )}
      </Dropdown>
      <DeactivateDialog
        open={confirming}
        name={name}
        currentlyActive={isActive}
        onCancel={() => setConfirming(false)}
        onConfirm={async (reason) => {
          await onToggleActive(reason);
          setConfirming(false);
        }}
      />
    </>
  );
}
