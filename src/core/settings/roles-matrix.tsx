'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Lock, RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { localizedName } from '@/core/auth/types';
import { useDynamicT } from '@/core/i18n/use-dynamic-t';
import { Button } from '@/core/ui/button';
import { cn } from '@/core/ui/cn';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { Skeleton } from '@/core/ui/skeleton';
import { useIsDesktop } from '@/core/ui/use-media-query';
import { saveRolePermissions, settingsKeys, useRolesMatrix } from './api';
import { settingsErrorKind, type SettingsErrorKind } from './errors';
import {
  groupPermissions,
  isCellEditable,
  moduleLabelKey,
  pendingChanges,
  permissionLabelKey,
  subjectLabelKey,
  type RoleChange,
} from './permission-groups';
import type { PermissionDef, RoleDef, RolesMatrix as Matrix } from './types';
import { useUnsavedChangesGuard } from './unsaved-changes';

interface SaveOutcome {
  saved: string[];
  failed: { roleKey: string; kind: SettingsErrorKind }[];
}

export function RolesMatrix({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('settings');
  const query = useRolesMatrix(slug, businessId);

  if (query.isPending) return <MatrixSkeleton />;
  if (query.isError || !query.data) {
    return (
      <div role="alert" className="space-y-3 rounded-card border border-border p-6 text-center">
        <p className="text-fg">{t('loadError')}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  }
  return <MatrixEditor slug={slug} businessId={businessId} matrix={query.data} />;
}

function MatrixSkeleton() {
  return (
    <div aria-busy="true" className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

function MatrixEditor({
  slug,
  businessId,
  matrix,
}: {
  slug: string;
  businessId: string;
  matrix: Matrix;
}) {
  const t = useTranslations('settings.roles');
  const dt = useDynamicT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const id = useId();

  /** Only roles the user touched; everything else shows the server's list. */
  const [edits, setEdits] = useState<Record<string, string[]>>({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const inFlight = useRef(false);
  const editableRoles = matrix.roles.filter((r) => !r.locked);
  const [mobileRole, setMobileRole] = useState(editableRoles[0]?.key ?? matrix.roles[0]?.key ?? '');

  const order = useMemo(() => matrix.permissions.map((p) => p.key), [matrix.permissions]);
  const modules = useMemo(() => groupPermissions(matrix.permissions), [matrix.permissions]);
  const changes = useMemo(
    () => pendingChanges(matrix.roles, edits, order),
    [matrix.roles, edits, order],
  );
  const changeCount = changes.reduce((n, c) => n + c.added.length + c.removed.length, 0);
  const { dialog: leaveDialog } = useUnsavedChangesGuard(changes.length > 0);

  const roleName = (role: RoleDef) => localizedName(role, locale);
  const permLabel = (key: string) => dt(permissionLabelKey(key), key);
  const effective = (role: RoleDef) => edits[role.key] ?? role.permissions;
  const lockedReasonId = `${id}-locked`;
  const ownerOnlyReasonId = `${id}-owner-only`;

  const toggle = (role: RoleDef, permission: PermissionDef) => {
    if (!isCellEditable(role, permission)) return;
    setOutcome(null);
    setEdits((current) => {
      const list = new Set(current[role.key] ?? role.permissions);
      if (list.has(permission.key)) list.delete(permission.key);
      else list.add(permission.key);
      return { ...current, [role.key]: [...list] };
    });
  };

  /** PUT one role at a time; report saved and failed roles separately. */
  const save = async (toSave: RoleChange[]) => {
    if (inFlight.current || toSave.length === 0) return;
    inFlight.current = true;
    setSaving(true);
    const result: SaveOutcome = { saved: [], failed: [] };
    for (const change of toSave) {
      try {
        await saveRolePermissions(slug, change.role.key, change.permissions);
        result.saved.push(change.role.key);
        // Show the saved list at once, then drop the edit; the refetch below confirms it.
        queryClient.setQueryData<Matrix>(settingsKeys.entity(businessId, 'roles'), (old) =>
          old
            ? {
                ...old,
                roles: old.roles.map((r) =>
                  r.key === change.role.key ? { ...r, permissions: change.permissions } : r,
                ),
              }
            : old,
        );
        setEdits((current) => {
          const next = { ...current };
          delete next[change.role.key];
          return next;
        });
      } catch (error) {
        result.failed.push({ roleKey: change.role.key, kind: settingsErrorKind(error) });
      }
    }
    setOutcome(result);
    setSaving(false);
    setConfirming(false);
    inFlight.current = false;
    if (result.saved.length) {
      await queryClient.invalidateQueries({ queryKey: settingsKeys.entity(businessId, 'roles') });
    }
  };

  const nameOf = (key: string) => {
    const role = matrix.roles.find((r) => r.key === key);
    return role ? roleName(role) : key;
  };
  const failedKeys = outcome?.failed.map((f) => f.roleKey) ?? [];
  const retryChanges = changes.filter((c) => failedKeys.includes(c.role.key));

  /** Arrow keys move between cells (skipping disabled ones); Tab and Space work as usual. */
  const onGridKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    if (Number.isNaN(row) || Number.isNaN(col)) return;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const grid = event.currentTarget;
    let [r, c] = [row + move[0], col + move[1]];
    while (r >= 0 && c >= 0 && r < order.length && c < matrix.roles.length) {
      const cell = grid.querySelector<HTMLInputElement>(`input[data-row="${r}"][data-col="${c}"]`);
      if (cell && !cell.disabled) {
        cell.focus();
        return;
      }
      [r, c] = [r + move[0], c + move[1]];
    }
  };

  const checkbox = (role: RoleDef, permission: PermissionDef, col: number) => {
    const editable = isCellEditable(role, permission);
    const reason = role.locked
      ? lockedReasonId
      : permission.ownerOnly
        ? ownerOnlyReasonId
        : undefined;
    return (
      <input
        type="checkbox"
        className="size-5 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
        checked={effective(role).includes(permission.key)}
        disabled={!editable}
        onChange={() => toggle(role, permission)}
        aria-label={t('cellLabel', { permission: permLabel(permission.key), role: roleName(role) })}
        aria-describedby={reason}
        title={
          reason === lockedReasonId ? t('lockedReason') : reason ? t('ownerOnlyReason') : undefined
        }
        data-row={order.indexOf(permission.key)}
        data-col={col}
      />
    );
  };

  const ownerOnlyBadge = (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-fg-muted">
      <Lock aria-hidden className="size-3" />
      {t('ownerOnly')}
    </span>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">{t('intro')}</p>
      <p id={lockedReasonId} hidden>
        {t('lockedReason')}
      </p>
      <p id={ownerOnlyReasonId} hidden>
        {t('ownerOnlyReason')}
      </p>

      {/* Save bar */}
      <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-4 py-3">
        <p className="text-sm text-fg-muted" aria-live="polite">
          {t('changeCount', { count: changeCount })}
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setEdits({});
              setOutcome(null);
            }}
            disabled={changes.length === 0 || saving}
          >
            {t('discard')}
          </Button>
          <Button onClick={() => setConfirming(true)} disabled={changes.length === 0 || saving}>
            {t('save')}
          </Button>
        </div>
      </div>

      <div role="status" aria-live="polite">
        {outcome && outcome.saved.length > 0 ? (
          <p className="rounded-lg border border-success px-3 py-2 text-sm font-medium text-success">
            {t('saved', { roles: outcome.saved.map(nameOf).join(', ') })}
          </p>
        ) : null}
      </div>
      <div role="alert">
        {outcome && outcome.failed.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-danger px-3 py-2 text-sm text-danger">
            <p className="font-medium">
              {t('failed', { roles: outcome.failed.map((f) => nameOf(f.roleKey)).join(', ') })}
            </p>
            <ul className="list-disc pl-5">
              {outcome.failed.map((f) => (
                <li key={f.roleKey}>
                  {nameOf(f.roleKey)}
                  {': '}
                  {t(`failureReason.${f.kind}`)}
                </li>
              ))}
            </ul>
            {retryChanges.length > 0 ? (
              <Button variant="secondary" onClick={() => void save(retryChanges)} disabled={saving}>
                <RotateCcw aria-hidden className="size-4" />
                {t('retryFailed')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isDesktop ? (
        <div
          className="overflow-x-auto rounded-card border border-border bg-surface"
          onKeyDown={onGridKeyDown}
        >
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border">
                <th
                  scope="col"
                  className="sticky left-0 bg-surface px-4 py-3 text-left font-semibold"
                >
                  {t('permission')}
                </th>
                {matrix.roles.map((role) => (
                  <th
                    key={role.key}
                    scope="col"
                    className="px-3 py-3 text-center font-semibold whitespace-nowrap"
                  >
                    {roleName(role)}
                    {role.locked ? (
                      <span className="mt-1 flex items-center justify-center gap-1 text-xs font-normal text-fg-muted">
                        <Lock aria-hidden className="size-3" />
                        {t('locked')}
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            {modules.map((moduleGroup) => (
              <Fragment key={moduleGroup.module}>
                <tbody>
                  <tr className="bg-surface-muted">
                    <th
                      scope="rowgroup"
                      colSpan={matrix.roles.length + 1}
                      className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-fg-muted uppercase"
                    >
                      {dt(moduleLabelKey(moduleGroup.module), moduleGroup.module)}
                    </th>
                  </tr>
                </tbody>
                {moduleGroup.groups.map((group) => (
                  <tbody key={group.subject} className="border-b border-border">
                    <tr>
                      <th
                        scope="rowgroup"
                        colSpan={matrix.roles.length + 1}
                        className="px-4 pt-3 pb-1 text-left font-semibold"
                      >
                        {dt(subjectLabelKey(group.subject), group.subject)}
                      </th>
                    </tr>
                    {group.items.map((permission) => (
                      <tr key={permission.key} className="hover:bg-surface-muted">
                        <th
                          scope="row"
                          className="sticky left-0 bg-surface px-4 py-2 text-left font-normal"
                        >
                          {permLabel(permission.key)}
                          {permission.ownerOnly ? ownerOnlyBadge : null}
                        </th>
                        {matrix.roles.map((role, col) => (
                          <td key={role.key} className="px-3 py-2 text-center">
                            {checkbox(role, permission, col)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </Fragment>
            ))}
          </table>
        </div>
      ) : (
        <MobileRoleList
          roles={matrix.roles}
          modules={modules}
          current={mobileRole}
          onChoose={setMobileRole}
          roleName={roleName}
          renderCheckbox={(role, permission) =>
            checkbox(role, permission, matrix.roles.indexOf(role))
          }
          permLabel={permLabel}
          subjectLabel={(s) => dt(subjectLabelKey(s), s)}
          moduleLabel={(m) => dt(moduleLabelKey(m), m)}
          ownerOnlyBadge={ownerOnlyBadge}
          onKeyDown={onGridKeyDown}
        />
      )}

      <ConfirmDialog
        open={confirming}
        title={t('confirmTitle')}
        confirmLabel={t('confirm')}
        cancelLabel={t('cancel')}
        pending={saving}
        pendingLabel={t('saving')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void save(changes)}
      >
        <p className="mb-3">{t('confirmIntro')}</p>
        <div className="max-h-[50vh] space-y-4 overflow-y-auto">
          {changes.map((change) => (
            <section key={change.role.key} aria-label={roleName(change.role)}>
              <h3 className="font-semibold">{roleName(change.role)}</h3>
              {change.added.length ? (
                <div className="mt-1">
                  <p className="text-xs font-semibold text-success">{t('added')}</p>
                  <ul className="list-disc pl-5">
                    {change.added.map((key) => (
                      <li key={key}>{permLabel(key)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {change.removed.length ? (
                <div className="mt-1">
                  <p className="text-xs font-semibold text-danger">{t('removed')}</p>
                  <ul className="list-disc pl-5">
                    {change.removed.map((key) => (
                      <li key={key}>{permLabel(key)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </ConfirmDialog>
      {leaveDialog}
    </div>
  );
}

function MobileRoleList({
  roles,
  modules,
  current,
  onChoose,
  roleName,
  renderCheckbox,
  permLabel,
  subjectLabel,
  moduleLabel,
  ownerOnlyBadge,
  onKeyDown,
}: {
  roles: RoleDef[];
  modules: ReturnType<typeof groupPermissions>;
  current: string;
  onChoose: (key: string) => void;
  roleName: (role: RoleDef) => string;
  renderCheckbox: (role: RoleDef, permission: PermissionDef) => React.ReactNode;
  permLabel: (key: string) => string;
  subjectLabel: (subject: string) => string;
  moduleLabel: (module: string) => string;
  ownerOnlyBadge: React.ReactNode;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const t = useTranslations('settings.roles');
  const role = roles.find((r) => r.key === current) ?? roles[0];
  if (!role) return null;

  return (
    <div className="space-y-4">
      <div role="group" aria-label={t('chooseRole')} className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={r.key === role.key}
            onClick={() => onChoose(r.key)}
            className={cn(
              'inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium',
              r.key === role.key ? 'bg-primary text-primary-fg' : 'bg-surface text-fg',
            )}
          >
            {roleName(r)}
            {r.locked ? <Lock aria-hidden className="size-3" /> : null}
          </button>
        ))}
      </div>
      {role.locked ? <p className="text-sm text-fg-muted">{t('lockedReason')}</p> : null}
      <div className="space-y-4" onKeyDown={onKeyDown}>
        {modules.map((moduleGroup) => (
          <section key={moduleGroup.module} className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
              {moduleLabel(moduleGroup.module)}
            </h3>
            {moduleGroup.groups.map((group) => (
              <fieldset
                key={group.subject}
                className="rounded-card border border-border bg-surface p-3"
              >
                <legend className="px-1 font-semibold">{subjectLabel(group.subject)}</legend>
                <ul className="divide-y divide-border">
                  {group.items.map((permission) => (
                    <li
                      key={permission.key}
                      className="flex min-h-11 items-center justify-between gap-3 py-2"
                    >
                      <span className="text-sm">
                        {permLabel(permission.key)}
                        {permission.ownerOnly ? ownerOnlyBadge : null}
                      </span>
                      {renderCheckbox(role, permission)}
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
