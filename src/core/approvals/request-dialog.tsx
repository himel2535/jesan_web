'use client';

import { FilePen } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '@/core/api/client';
import { ApiError } from '@/core/api/errors';
import { useErrorMessage } from '@/core/api/field-errors';
import { useCan } from '@/core/auth/can';
import { MONEY_PATTERN, SIGNED_MONEY_PATTERN, cleanMoneyInput } from '@/core/lib/money';
import { cleanQuantityInput, isPositiveQuantity, signedQuantity } from '@/core/lib/quantity';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { cn } from '@/core/ui/cn';
import { Modal } from '@/core/ui/modal';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { newIdempotencyKey, usePreviewChange, useSubmitChange } from './api';
import { ImpactList, NOTE_MAX, NOTE_MIN } from './detail';
import { useChangeLabels, useValueText } from './display';
import type { ChangePreview, ChangeRequestPage, ChangeRequestInput } from './types';

/**
 * A field the user may ask to change. The module offers only fields the API sent for this
 * record and the user may see but not change directly. Money and quantities stay strings.
 * - `money`: ≥ 0 · `signedMoney`: may be negative (opening due, advance)
 * - `moneyOrNone`: ≥ 0, or empty for "no limit" (credit limit → null)
 * - `quantity`: > 0 with the unit's `decimals` · `signedQuantity`: non-zero, with sign
 * - `date`: YYYY-MM-DD · `text`: free text up to `maxLength`
 */
export interface RequestField {
  key: string;
  type: 'money' | 'signedMoney' | 'moneyOrNone' | 'quantity' | 'signedQuantity' | 'date' | 'text';
  current: string | null;
  /** Shown instead of the generic field label (e.g. a purchase line's product). */
  label?: string;
  /** Quantities: allowed decimals of the unit (bags: 0). */
  decimals?: number;
  /** Text: maximum length. */
  maxLength?: number;
}

export interface RequestTarget {
  entityType: string;
  entityId: string;
  /** Shown in the title, e.g. the record's name. */
  name: string;
  fields: RequestField[];
  /** Offer "ask to deactivate/activate" (the user lacks the direct `*.deactivate`). */
  status?: { currentlyActive: boolean };
  /** Offer "ask to void this record" (`kind: void`, no proposed values). */
  voidable?: boolean;
  /** Start with these fields chosen and values/reason typed (e.g. from a refused adjustment). */
  initial?: { chosen?: string[]; values?: Record<string, string>; reason?: string };
}

/**
 * "Request a correction": opens the dialog. The module renders it only for someone with
 * `change.request` who lacks the direct permission (an owner never sees it).
 */
export function RequestChangeButton({
  slug,
  target,
  onSent,
  className,
}: {
  slug: string;
  target: RequestTarget;
  onSent: (message: string) => void;
  className?: string;
}) {
  const t = useTranslations('approvals.request');
  const [open, setOpen] = useState(false);
  if (target.fields.length === 0 && !target.status && !target.voidable) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className={className}>
        <FilePen aria-hidden className="size-4" />
        {t('button')}
      </Button>
      {/* Portal: the button may sit inside an edit form, and forms cannot nest. */}
      {open
        ? createPortal(
            <ChangeRequestDialog
              slug={slug}
              target={target}
              onClose={() => setOpen(false)}
              onSent={(message) => {
                setOpen(false);
                onSent(message);
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

type Errors = Record<string, string | undefined>;

export function ChangeRequestDialog({
  slug,
  target,
  onClose,
  onSent,
}: {
  slug: string;
  target: RequestTarget;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const t = useTranslations('approvals.request');
  const id = useId();
  const labels = useChangeLabels();
  const valueText = useValueText();
  const errorMessage = useErrorMessage();
  const canViewAll = useCan('change.view.all');
  const canViewOwn = useCan('change.view.own');
  const preview = usePreviewChange(slug);
  const submit = useSubmitChange(slug);
  // One key per open form: every attempt (double click, retry after an error) sends the same.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const inFlight = useRef(false);

  const format = useFormat();
  const onlyVoid = target.voidable && target.fields.length === 0 && !target.status;
  const [mode, setMode] = useState<'edit' | 'void'>(onlyVoid ? 'void' : 'edit');
  const [chosen, setChosen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((target.initial?.chosen ?? []).map((k) => [k, true])),
  );
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(target.fields.map((f) => [f.key, f.current ?? ''])),
    ...target.initial?.values,
  }));
  const [askStatus, setAskStatus] = useState(false);
  const [reason, setReason] = useState(target.initial?.reason ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingLink, setPendingLink] = useState<{ href: string; one: boolean } | null>(null);
  const [reviewed, setReviewed] = useState<{ key: string; result: ChangePreview } | null>(null);
  const base = `/b/${encodeURIComponent(slug)}/approvals`;

  /**
   * The proposed change from the form, or field errors. Money and quantities are cleaned but
   * stay strings; a void request proposes nothing.
   */
  const proposal = useMemo(() => {
    const change: Record<string, unknown> = {};
    const found: Errors = {};
    if (mode === 'void') return { change, found };
    for (const field of target.fields) {
      if (!chosen[field.key]) continue;
      const typed = values[field.key] ?? '';
      const decimals = field.decimals ?? 0;
      switch (field.type) {
        case 'quantity': {
          const v = cleanQuantityInput(typed);
          if (isPositiveQuantity(v, decimals)) change[field.key] = v;
          else found[field.key] = t('quantityInvalid');
          break;
        }
        case 'signedQuantity': {
          const v = signedQuantity(typed, decimals);
          if (v) change[field.key] = v;
          else found[field.key] = t('signedQuantityInvalid');
          break;
        }
        case 'date':
          if (/^\d{4}-\d{2}-\d{2}$/.test(typed)) change[field.key] = typed;
          else found[field.key] = t('dateInvalid');
          break;
        case 'text': {
          const v = typed.trim();
          if (v.length <= (field.maxLength ?? NOTE_MAX)) change[field.key] = v;
          else found[field.key] = t('textInvalid');
          break;
        }
        default: {
          const raw = cleanMoneyInput(typed);
          if (field.type === 'moneyOrNone' && raw === '') change[field.key] = null;
          else if ((field.type === 'signedMoney' ? SIGNED_MONEY_PATTERN : MONEY_PATTERN).test(raw))
            change[field.key] = raw;
          else found[field.key] = t('moneyInvalid');
        }
      }
    }
    if (askStatus && target.status) change.isActive = !target.status.currentlyActive;
    return { change, found };
  }, [askStatus, chosen, mode, t, target, values]);
  const proposalKey = `${mode}:${JSON.stringify(proposal.change)}`;
  const upToDate = reviewed?.key === proposalKey;

  const input = (): Omit<ChangeRequestInput, 'reason'> =>
    mode === 'void'
      ? { entityType: target.entityType, entityId: target.entityId, kind: 'void' }
      : {
          entityType: target.entityType,
          entityId: target.entityId,
          kind: 'edit',
          proposedChange: proposal.change,
        };

  const validate = (withReason: boolean): boolean => {
    const found: Errors = { ...proposal.found };
    const nothing = mode === 'edit' && Object.keys(proposal.change).length === 0;
    if (nothing && !Object.keys(found).length) setFormError(t('nothingChosen'));
    else setFormError(null);
    const n = reason.trim().length;
    if (withReason && (n < NOTE_MIN || n > NOTE_MAX)) found.reason = t('reasonRequired');
    setErrors(found);
    return Object.keys(found).length === 0 && !nothing;
  };

  /** The current value of a field, shown next to its checkbox. */
  const currentText = (field: RequestField) => {
    if (field.current === null || field.current === '') return valueText(field.key, field.current);
    if (field.type === 'quantity' || field.type === 'signedQuantity')
      return format.quantity(field.current);
    if (field.type === 'date') return format.date(`${field.current}T00:00:00+06:00`);
    if (field.type === 'text') return field.current;
    return valueText(field.key, field.current);
  };

  /** Field errors under their fields (`proposedChange.<field>`, `reason`); the rest on top. */
  const showError = (cause: unknown) => {
    const fieldKeys = [...target.fields.map((f) => `proposedChange.${f.key}`), 'reason'];
    const split = errorMessage.split(cause, fieldKeys);
    setErrors(
      Object.fromEntries(
        Object.entries(split.fields).map(([k, v]) => [k.replace('proposedChange.', ''), v]),
      ),
    );
    setFormError(split.form);
  };

  const onReview = async () => {
    if (inFlight.current || !validate(false)) return;
    inFlight.current = true;
    try {
      const result = await preview.mutateAsync(input());
      setReviewed({ key: proposalKey, result });
    } catch (cause) {
      showError(cause);
    } finally {
      inFlight.current = false;
    }
  };

  const findPendingLink = async (cause: ApiError) => {
    // The API names the pending request when the user may open it (own, or change.view.all).
    const pendingId = cause.body?.changeRequestId;
    if (typeof pendingId === 'string' && pendingId) {
      return { href: `${base}/${encodeURIComponent(pendingId)}`, one: true };
    }
    if (canViewAll) {
      return {
        href: `${base}/all?entityId=${encodeURIComponent(target.entityId)}&status=pending`,
        one: false,
      };
    }
    if (!canViewOwn) return null;
    try {
      const mine = await apiFetch<ChangeRequestPage>(
        `/b/${encodeURIComponent(slug)}/change-requests/mine`,
        { query: { status: 'pending', page: 1 } },
      );
      const own = mine.items.find((r) => r.entityId === target.entityId);
      return own ? { href: `${base}/${encodeURIComponent(own.id)}`, one: true } : null;
    } catch {
      return null;
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // React events bubble through portals: never let this submit reach a surrounding edit form.
    event.stopPropagation();
    if (inFlight.current || !validate(true)) return;
    if (!upToDate) return setFormError(t('reviewFirst'));
    inFlight.current = true;
    setPendingLink(null);
    try {
      await submit.mutateAsync({ input: { ...input(), reason: reason.trim() }, idempotencyKey });
      onSent(t('sent'));
    } catch (cause) {
      // Typed values and the reason stay; only the message changes.
      showError(cause);
      if (cause instanceof ApiError && cause.code === 'CHANGE_REQUEST_PENDING_EXISTS') {
        setPendingLink(await findPendingLink(cause));
      }
    } finally {
      inFlight.current = false;
    }
  };

  const busy = preview.isPending || submit.isPending;
  const fid = (key: string) => `${id}-${key}`;

  return (
    <Modal
      open
      onClose={() => (busy ? undefined : onClose())}
      title={t('title', { name: target.name })}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-fg-muted">{t('intro')}</p>
        <div role="alert">
          {formError ? (
            <div className="space-y-1 rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger">
              <p>{formError}</p>
              {pendingLink ? (
                <Link href={pendingLink.href} prefetch={false} className="text-fg underline">
                  {pendingLink.one ? t('viewPending') : t('viewPendingList')}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {target.voidable && !onlyVoid ? (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">{t('mode')}</legend>
            {(['edit', 'void'] as const).map((m) => (
              <label key={m} className="flex min-h-10 items-center gap-3 text-sm font-medium">
                <input
                  type="radio"
                  name={fid('mode')}
                  className="size-5"
                  checked={mode === m}
                  onChange={() => setMode(m)}
                />
                {m === 'edit' ? t('modeEdit') : t('modeVoid')}
              </label>
            ))}
          </fieldset>
        ) : null}

        {mode === 'void' ? (
          <p className="rounded-lg border border-warning px-3 py-2 text-sm">{t('voidNote')}</p>
        ) : (
          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-semibold">{t('choose')}</legend>
            {target.fields.map((field) => {
              const label = field.label ?? labels.field(field.key);
              const isText = field.type === 'text' || field.type === 'date';
              const on = Boolean(chosen[field.key]);
              const error = errors[field.key];
              return (
                <div key={field.key} className="space-y-2 rounded-lg border border-border p-3">
                  <label className="flex min-h-10 items-center gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={on}
                      onChange={(e) => setChosen((c) => ({ ...c, [field.key]: e.target.checked }))}
                    />
                    {t('change', { field: label })}
                    <span className="font-normal text-fg-muted">
                      {t('current', { value: currentText(field) })}
                    </span>
                  </label>
                  {on ? (
                    <Field
                      id={fid(field.key)}
                      label={t('newValue', { field: label })}
                      hint={field.type === 'moneyOrNone' ? t('creditLimitHint') : undefined}
                      error={error}
                    >
                      <input
                        id={fid(field.key)}
                        type={field.type === 'date' ? 'date' : 'text'}
                        inputMode={isText ? undefined : 'decimal'}
                        maxLength={
                          field.type === 'text' ? (field.maxLength ?? NOTE_MAX) : undefined
                        }
                        autoComplete="off"
                        className={inputClass}
                        value={values[field.key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                        aria-invalid={Boolean(error) || undefined}
                        aria-describedby={describedBy(fid(field.key), {
                          hint: field.type === 'moneyOrNone',
                          error: Boolean(error),
                        })}
                      />
                    </Field>
                  ) : null}
                </div>
              );
            })}
            {target.status ? (
              <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border p-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={askStatus}
                  onChange={(e) => setAskStatus(e.target.checked)}
                />
                {target.status.currentlyActive ? t('statusToggle') : t('statusToggleActivate')}
              </label>
            ) : null}
          </fieldset>
        )}

        <Field id={fid('reason')} label={t('reason')} hint={t('reasonHint')} error={errors.reason}>
          <textarea
            id={fid('reason')}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            aria-invalid={Boolean(errors.reason) || undefined}
            aria-describedby={describedBy(fid('reason'), {
              hint: true,
              error: Boolean(errors.reason),
            })}
            className={cn(inputClass, 'min-h-24 py-2')}
          />
        </Field>

        <div role="status" aria-live="polite">
          {upToDate && reviewed ? (
            reviewed.result.impact.length > 0 ? (
              <ImpactList impact={reviewed.result.impact} title={t('previewTitle')} />
            ) : null
          ) : reviewed ? (
            <p className="text-sm text-fg-muted">{t('reviewFirst')}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button
            variant={upToDate ? 'secondary' : 'primary'}
            onClick={() => void onReview()}
            disabled={busy}
            aria-busy={preview.isPending}
          >
            {preview.isPending ? t('reviewing') : t('review')}
          </Button>
          {upToDate ? (
            <Button type="submit" disabled={busy} aria-busy={submit.isPending}>
              {submit.isPending ? t('sending') : t('send')}
            </Button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
