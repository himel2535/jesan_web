'use client';

import { EllipsisVertical, Eye, UserPlus, Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useCan } from '@/core/auth/can';
import { useSession } from '@/core/auth/session-context';
import { useDynamicT } from '@/core/i18n/use-dynamic-t';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { cn } from '@/core/ui/cn';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { Dropdown } from '@/core/ui/dropdown';
import { EmptyState } from '@/core/ui/empty-state';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam } from '@/core/ui/pagination-logic';
import { Skeleton } from '@/core/ui/skeleton';
import { useRemoveAccess, useSetUserStatus, useUsers } from './api';
import { settingsErrorKind, type SettingsErrorKind } from './errors';
import type { SettingsUser } from './types';
import { ChangeRoleDialog, CreateUserDialog, ResetPasswordDialog } from './user-dialogs';

type DialogState =
  | { type: 'create' }
  | { type: 'role' | 'reset' | 'deactivate' | 'activate' | 'remove'; user: SettingsUser }
  | null;

const menuItem =
  'flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-surface-muted';

/**
 * Users of one business. Everyone with `users.view` sees the list; only `users.manage`
 * (platform owner) sees the buttons. Hiding them is a convenience — the API enforces it.
 */
export function UsersSection({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('settings');
  const dt = useDynamicT();
  const format = useFormat();
  const { user: me } = useSession();
  const canManage = useCan('users.manage');
  const page = parsePageParam(useSearchParams().get('page'));
  const query = useUsers(slug, businessId, page);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const roleLabel = (key: string) => dt(`settings.roleNames.${key}`, key);
  const items = query.data?.items ?? [];
  // Shown only when the API really sends the field (decision 3; DECISIONS.md).
  const showLastLogin = items.some((u) => 'lastLoginAt' in u);

  const open = (next: DialogState) => {
    setNotice(null);
    setDialog(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">{t('users.intro')}</p>
        {canManage ? (
          <Button onClick={() => open({ type: 'create' })}>
            <UserPlus aria-hidden className="size-4" />
            {t('users.add')}
          </Button>
        ) : null}
      </div>

      {!canManage ? (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-muted">
          <Eye aria-hidden className="size-4 shrink-0" />
          {t('readOnly')}
        </p>
      ) : null}

      <div role="status" aria-live="polite">
        {notice ? (
          <p className="rounded-lg border border-success px-3 py-2 text-sm font-medium text-success">
            {notice}
          </p>
        ) : null}
      </div>

      {query.isPending ? (
        <div aria-busy="true" className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <div role="alert" className="space-y-3 rounded-card border border-border p-6 text-center">
          <p className="text-fg">{t(`users.error.${settingsErrorKind(query.error)}`)}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : items.length === 0 && page === 1 ? (
        <EmptyState
          icon={Users}
          title={t('users.emptyTitle')}
          description={t('users.emptyDescription')}
        />
      ) : (
        <>
          {/* Plain table (no blur on lists); scrolls sideways on small screens. */}
          <div
            className={cn(
              'overflow-x-auto rounded-card border border-border bg-surface',
              query.isPlaceholderData && 'opacity-60',
            )}
            aria-busy={query.isFetching}
          >
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-fg-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('users.name')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('users.contact')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('users.role')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('users.status')}
                  </th>
                  {showLastLogin ? (
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('users.lastLogin')}
                    </th>
                  ) : null}
                  {canManage ? (
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      {t('users.actions')}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {items.map((user) => {
                  const isSelf = user.id === me.id;
                  return (
                    <tr key={user.id} className="border-b border-border last:border-0">
                      <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap">
                        {user.name}
                        {isSelf ? (
                          <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-normal text-fg-muted">
                            {t('users.you')}
                          </span>
                        ) : null}
                      </th>
                      <td className="px-4 py-3">
                        {user.email ? <div>{user.email}</div> : null}
                        {user.phone ? <div className="text-fg-muted">{user.phone}</div> : null}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{roleLabel(user.role)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'font-medium',
                            user.isActive ? 'text-success' : 'text-danger',
                          )}
                        >
                          {user.isActive ? t('users.active') : t('users.inactive')}
                        </span>
                      </td>
                      {showLastLogin ? (
                        <td className="px-4 py-3 whitespace-nowrap text-fg-muted">
                          {user.lastLoginAt
                            ? format.date(user.lastLoginAt, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : t('users.never')}
                        </td>
                      ) : null}
                      {canManage ? (
                        <td className="px-4 py-2 text-right">
                          {/* Your own account is changed from "Change password", never here. */}
                          {isSelf ? null : <RowActions user={user} onOpen={open} />}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            totalItems={query.data?.total ?? 0}
            pageSize={query.data?.pageSize ?? PAGE_SIZE}
          />
        </>
      )}

      {canManage ? (
        <>
          <CreateUserDialog
            open={dialog?.type === 'create'}
            onClose={() => setDialog(null)}
            onCreated={(name) => setNotice(t('users.create.success', { name }))}
            slug={slug}
            businessId={businessId}
          />
          {dialog?.type === 'role' ? (
            <ChangeRoleDialog
              user={dialog.user}
              onClose={() => setDialog(null)}
              onDone={setNotice}
              slug={slug}
              businessId={businessId}
            />
          ) : null}
          {dialog?.type === 'reset' ? (
            <ResetPasswordDialog
              user={dialog.user}
              onClose={() => setDialog(null)}
              onDone={setNotice}
              slug={slug}
              businessId={businessId}
            />
          ) : null}
          {dialog &&
          (dialog.type === 'deactivate' ||
            dialog.type === 'activate' ||
            dialog.type === 'remove') ? (
            <RiskyActionDialog
              type={dialog.type}
              user={dialog.user}
              onClose={() => setDialog(null)}
              onDone={setNotice}
              slug={slug}
              businessId={businessId}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function RowActions({ user, onOpen }: { user: SettingsUser; onOpen: (d: DialogState) => void }) {
  const t = useTranslations('settings.users');
  return (
    <Dropdown
      label={t('actionsFor', { name: user.name })}
      triggerClassName="size-10 justify-center"
      trigger={<EllipsisVertical aria-hidden className="size-5" />}
    >
      {(close) => {
        const item = (label: string, next: DialogState, danger = false) => (
          <button
            type="button"
            className={cn(menuItem, danger && 'text-danger')}
            onClick={() => {
              close();
              onOpen(next);
            }}
          >
            {label}
          </button>
        );
        return (
          <div className="flex flex-col gap-1">
            {item(t('changeRole'), { type: 'role', user })}
            {item(t('resetPassword'), { type: 'reset', user })}
            {user.isActive
              ? item(t('deactivate'), { type: 'deactivate', user }, true)
              : item(t('activate'), { type: 'activate', user })}
            {item(t('removeAccess'), { type: 'remove', user }, true)}
          </div>
        );
      }}
    </Dropdown>
  );
}

function RiskyActionDialog({
  type,
  user,
  onClose,
  onDone,
  slug,
  businessId,
}: {
  type: 'deactivate' | 'activate' | 'remove';
  user: SettingsUser;
  onClose: () => void;
  onDone: (message: string) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('settings.users');
  const status = useSetUserStatus(slug, businessId);
  const remove = useRemoveAccess(slug, businessId);
  const [error, setError] = useState<SettingsErrorKind | null>(null);
  const inFlight = useRef(false);
  const key =
    type === 'deactivate'
      ? 'confirmDeactivate'
      : type === 'activate'
        ? 'confirmActivate'
        : 'confirmRemove';
  const pending = status.isPending || remove.isPending;

  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      if (type === 'remove') await remove.mutateAsync({ userId: user.id });
      else await status.mutateAsync({ userId: user.id, isActive: type === 'activate' });
      onDone(t(`${key}.success`, { name: user.name }));
      onClose();
    } catch (cause) {
      setError(settingsErrorKind(cause));
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <ConfirmDialog
      open
      title={t(`${key}.title`, { name: user.name })}
      confirmLabel={t(`${key}.confirm`)}
      cancelLabel={t('cancel')}
      danger={type !== 'activate'}
      pending={pending}
      error={error ? t(`error.${error}`) : null}
      onCancel={onClose}
      onConfirm={() => void confirm()}
    >
      {t(`${key}.body`)}
    </ConfirmDialog>
  );
}
