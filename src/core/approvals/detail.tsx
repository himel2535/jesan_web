'use client';

import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { useErrorMessage } from '@/core/api/field-errors';
import { ApiError } from '@/core/api/errors';
import { useCan } from '@/core/auth/can';
import { useSession } from '@/core/auth/session-context';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { PageHeader } from '@/core/ui/page-header';
import { Skeleton } from '@/core/ui/skeleton';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { cn } from '@/core/ui/cn';
import { useChangeRequest, useDecide, type Decision } from './api';
import { recordHref, useChangeEntities } from './context';
import {
  StatusPill,
  fieldOfImpact,
  kindOfImpact,
  useChangeLabels,
  useDeltaText,
  useValueText,
} from './display';
import { LoadFailed } from './list';
import type { ChangeRequest } from './types';

export const NOTE_MIN = 3;
export const NOTE_MAX = 500;

/** Reject needs a note (3–500); approve takes an optional one (≤ 500); withdraw none. */
export function noteError(decision: Decision, note: string): 'required' | 'tooLong' | null {
  const n = note.trim().length;
  if (n > NOTE_MAX) return 'tooLong';
  if (decision === 'reject' && n < NOTE_MIN) return 'required';
  return null;
}

/**
 * One change request. Proposed values are read-only: an approver cannot alter them (reject with
 * a note and change the record directly instead). Approve/Reject only for someone else's pending,
 * up-to-date request with `change.approve`; Withdraw only for your own pending request. Your own
 * request never shows Approve or Reject.
 */
export function ApprovalDetail({ slug, id }: { slug: string; id: string }) {
  const t = useTranslations('approvals');
  const format = useFormat();
  const labels = useChangeLabels();
  const valueText = useValueText();
  const entities = useChangeEntities();
  const { user } = useSession();
  const canApprove = useCan('change.approve');
  const query = useChangeRequest(slug, id);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const base = `/b/${encodeURIComponent(slug)}/approvals`;

  if (query.isPending) {
    return (
      <div className="space-y-3" aria-busy>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <div className="space-y-4">
          <PageHeader title={t('notFoundTitle')} description={t('notFoundDescription')} />
          <Link href={base} prefetch={false} className="text-sm font-medium underline">
            {t('back')}
          </Link>
        </div>
      );
    }
    return <LoadFailed error={query.error} onRetry={() => void query.refetch()} />;
  }

  const r: ChangeRequest = query.data;
  const isOwn = r.requestedBy.id === user.id;
  const pending = r.status === 'pending';
  const stale = r.isStale || r.status === 'stale';
  const href = recordHref(entities, slug, r.entityType, r.entityId);
  const mayDecide = canApprove && !isOwn && pending;
  const fields = Array.from(
    new Set([...Object.keys(r.snapshot ?? {}), ...Object.keys(r.proposedChange ?? {})]),
  );
  const when = (iso: string) => format.date(iso, { dateStyle: 'medium', timeStyle: 'short' });

  const facts: [string, React.ReactNode][] = [
    [t('detail.record'), `${labels.entityType(r.entityType)} · ${r.entityLabel}`],
    [t('detail.requestedBy'), r.requestedBy.name],
    [t('detail.requestedAt'), when(r.requestedAt)],
    [t('columns.status'), <StatusPill key="s" status={r.status} />],
    ...(r.decidedBy ? [[t('detail.decidedBy'), r.decidedBy.name] as [string, string]] : []),
    ...(r.decidedAt ? [[t('detail.decidedAt'), when(r.decidedAt)] as [string, string]] : []),
    ...(r.appliedAt ? [[t('detail.appliedAt'), when(r.appliedAt)] as [string, string]] : []),
  ];

  return (
    <>
      <PageHeader
        title={r.entityLabel}
        description={t('detail.title')}
        actions={
          <>
            {pending && isOwn ? (
              <Button variant="secondary" onClick={() => (setNotice(null), setDecision('cancel'))}>
                {t('actions.cancel')}
              </Button>
            ) : null}
            {mayDecide ? (
              <Button variant="danger" onClick={() => (setNotice(null), setDecision('reject'))}>
                {t('actions.reject')}
              </Button>
            ) : null}
            {mayDecide && !stale ? (
              <Button onClick={() => (setNotice(null), setDecision('approve'))}>
                {t('actions.approve')}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="space-y-5">
        <div role="status" aria-live="polite">
          {notice ? (
            <p className="rounded-lg border border-success px-3 py-2 text-sm font-medium text-success">
              {notice}
            </p>
          ) : null}
        </div>

        {stale ? (
          <div className="flex gap-3 rounded-card border border-warning p-4 text-sm">
            <TriangleAlert aria-hidden className="size-5 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="font-semibold text-fg">{t('stale.title')}</p>
              <p className="text-fg-muted">{t('stale.body')}</p>
              {href ? (
                <Link href={href} prefetch={false} className="font-medium text-fg underline">
                  {t('stale.link')}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {pending && isOwn ? <p className="text-sm text-fg-muted">{t('ownRequest')}</p> : null}

        <dl className="grid gap-x-6 gap-y-3 rounded-card glass p-5 sm:grid-cols-[minmax(10rem,auto)_1fr]">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-sm text-fg-muted">{label}</dt>
              <dd className="text-sm font-medium text-fg">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('detail.reason')}</h2>
          <p className="rounded-card border border-border bg-surface p-4 text-sm whitespace-pre-wrap">
            {r.reason}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('detail.values')}</h2>
          {r.kind === 'void' ? (
            <p className="text-sm">{t('detail.voidRequest')}</p>
          ) : fields.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('detail.noValues')}</p>
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-fg-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t('detail.field')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      {t('detail.before')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      {t('detail.proposed')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => (
                    <tr key={field} className="border-b border-border last:border-0">
                      <th scope="row" className="px-4 py-3 font-medium">
                        {labels.field(field)}
                      </th>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {valueText(field, r.snapshot?.[field])}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {valueText(field, r.proposedChange?.[field])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {r.impact && r.impact.length > 0 ? <ImpactList impact={r.impact} /> : null}

        {r.decisionNote ? (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t('detail.decisionNote')}</h2>
            <p className="rounded-card border border-border bg-surface p-4 text-sm whitespace-pre-wrap">
              {r.decisionNote}
            </p>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {href ? (
            <Link href={href} prefetch={false} className="font-medium text-primary underline">
              {t('detail.openRecord')}
            </Link>
          ) : null}
          <Link href={base} prefetch={false} className="font-medium text-fg underline">
            {t('back')}
          </Link>
        </div>
      </div>

      {decision ? (
        <DecisionDialog
          slug={slug}
          request={r}
          decision={decision}
          onClose={() => setDecision(null)}
          onDone={(message) => {
            setDecision(null);
            setNotice(message);
          }}
        />
      ) : null}
    </>
  );
}

function DecisionDialog({
  slug,
  request,
  decision,
  onClose,
  onDone,
}: {
  slug: string;
  request: ChangeRequest;
  decision: Decision;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('approvals.actions');
  const id = useId();
  const errorMessage = useErrorMessage();
  const decide = useDecide(slug);
  const [note, setNote] = useState('');
  const [showNoteError, setShowNoteError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const problem = noteError(decision, note);
  const noteMessage =
    showNoteError && problem
      ? problem === 'tooLong'
        ? t('noteTooLong')
        : t('noteRequired')
      : undefined;

  const confirm = async () => {
    if (inFlight.current) return;
    if (problem) return setShowNoteError(true);
    inFlight.current = true;
    setError(null);
    try {
      await decide.mutateAsync({ request, decision, note: note.trim() || undefined });
      onDone(
        decision === 'approve'
          ? t('approved')
          : decision === 'reject'
            ? t('rejected')
            : t('cancelled'),
      );
    } catch (cause) {
      const split = errorMessage.split(cause, ['note'] as const);
      if (split.fields.note) {
        setShowNoteError(false);
        setError(split.fields.note);
      } else setError(split.form);
    } finally {
      inFlight.current = false;
    }
  };

  const title =
    decision === 'approve'
      ? t('approveTitle')
      : decision === 'reject'
        ? t('rejectTitle')
        : t('cancelTitle');
  const body =
    decision === 'approve'
      ? t('approveBody')
      : decision === 'reject'
        ? t('rejectBody')
        : t('cancelBody');
  const label =
    decision === 'approve' ? t('approve') : decision === 'reject' ? t('reject') : t('cancel');
  const pendingLabel =
    decision === 'approve'
      ? t('approving')
      : decision === 'reject'
        ? t('rejecting')
        : t('cancelling');

  return (
    <ConfirmDialog
      open
      title={title}
      confirmLabel={label}
      cancelLabel={t('close')}
      danger={decision === 'reject'}
      pending={decide.isPending}
      pendingLabel={pendingLabel}
      error={error}
      onCancel={() => (decide.isPending ? undefined : onClose())}
      onConfirm={() => void confirm()}
    >
      <div className="space-y-4">
        <p>{body}</p>
        {decision === 'cancel' ? null : (
          <Field
            id={`${id}-note`}
            label={decision === 'reject' ? t('note') : t('noteOptional')}
            hint={t('noteHint')}
            error={noteMessage}
          >
            <textarea
              id={`${id}-note`}
              rows={3}
              maxLength={NOTE_MAX + 50}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required={decision === 'reject'}
              aria-invalid={Boolean(noteMessage) || undefined}
              aria-describedby={describedBy(`${id}-note`, {
                hint: true,
                error: Boolean(noteMessage),
              })}
              className={cn(inputClass, 'min-h-24 py-2')}
            />
          </Field>
        )}
      </div>
    </ConfirmDialog>
  );
}

/** Effect if approved (pending only); translated by stable key, values formatted, money as text. */
export function ImpactList({
  impact,
  title,
}: {
  impact: NonNullable<ChangeRequest['impact']>;
  title?: string;
}) {
  const t = useTranslations('approvals');
  const labels = useChangeLabels();
  const valueText = useValueText();
  const deltaText = useDeltaText();
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title ?? t('detail.impact')}</h2>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {impact.map((line) => {
          const field = fieldOfImpact(line.key);
          const kind = kindOfImpact(line);
          const note = labels.note(line);
          return (
            <li key={line.key} className="space-y-1 px-4 py-3 text-sm">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{labels.impact(line)}</span>
                <span className="tabular-nums">
                  {'before' in line ? valueText(field, line.before, kind) : null}
                  {'before' in line && 'after' in line ? ' → ' : null}
                  {'after' in line ? (
                    <span className="font-semibold">{valueText(field, line.after, kind)}</span>
                  ) : null}
                  {line.delta ? (
                    <span className="ml-2 text-xs text-fg-muted">
                      ({deltaText(line.delta, kind)})
                    </span>
                  ) : null}
                </span>
              </p>
              {note ? <p className="text-fg-muted">{note}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
