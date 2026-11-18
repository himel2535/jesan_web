'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { passwordRuleError, type PasswordRuleError } from '@/core/auth/password-rules';
import { useDynamicT } from '@/core/i18n/use-dynamic-t';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { Modal } from '@/core/ui/modal';
import { PasswordInput } from '@/core/ui/password-input';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { lookupUser, useChangeRole, useCreateUser, useGrantAccess, useResetPassword } from './api';
import { useErrorMessage } from '@/core/api/field-errors';
import { ApiError } from '@/core/api/errors';
import {
  ASSIGNABLE_ROLE_KEYS,
  type CreateUserInput,
  type SettingsUser,
  type UserLookup,
} from './types';

/** Server error inside a dialog (role="alert"), already translated by its API code. */
function DialogError({ message, children }: { message: string | null; children?: ReactNode }) {
  return (
    <div role="alert">
      {message ? (
        <div className="space-y-2 rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger">
          <p>{message}</p>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function DialogButtons({
  onCancel,
  pending,
  submitLabel,
  pendingLabel,
}: {
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
}) {
  const t = useTranslations('settings.users');
  return (
    <div className="flex flex-wrap justify-end gap-2 pt-2">
      <Button variant="secondary" onClick={onCancel} disabled={pending}>
        {t('cancel')}
      </Button>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}

function RoleSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  const dt = useDynamicT();
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {options.map((key) => (
        <option key={key} value={key}>
          {dt(`settings.roleNames.${key}`, key)}
        </option>
      ))}
    </select>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 01XXXXXXXXX, 8801XXXXXXXXX or +8801XXXXXXXXX (the API normalizes all three). */
const BD_PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;

type CreateErrors = Partial<Record<'name' | 'contact' | 'email' | 'phone' | 'password', string>>;

export function CreateUserDialog({
  open,
  onClose,
  onCreated,
  onAddExisting,
  slug,
  businessId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
  /** 409 USER_ALREADY_EXISTS: offer to add that existing user instead (users/lookup). */
  onAddExisting?: (identifier: string) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('settings.users');
  const errorMessage = useErrorMessage();
  const [existing, setExisting] = useState<string | null>(null);
  const id = useId();
  const mutation = useCreateUser(slug, businessId);
  const empty = {
    name: '',
    email: '',
    phone: '',
    password: '',
    roleKey: ASSIGNABLE_ROLE_KEYS[0] as string,
  };
  // The password lives only in this component's state; it is cleared on success and on close.
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<CreateErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const close = () => {
    if (mutation.isPending) return;
    setValues(empty);
    setErrors({});
    setServerError(null);
    setExisting(null);
    onClose();
  };

  const set = (field: keyof typeof empty) => (value: string) =>
    setValues((v) => ({ ...v, [field]: value }));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const name = values.name.trim();
    const email = values.email.trim();
    const phone = values.phone.trim().replace(/[\s-]/g, '');
    const found: CreateErrors = {};
    if (!name) found.name = t('create.required');
    if (!email && !phone) found.contact = t('create.contactRequired');
    if (email && !EMAIL_RE.test(email)) found.email = t('create.emailInvalid');
    if (phone && !BD_PHONE_RE.test(phone)) found.phone = t('create.phoneInvalid');
    const pwError: PasswordRuleError | undefined = passwordRuleError(values.password, {
      email,
      phone,
    });
    if (pwError) found.password = t(`passwordError.${pwError}`);
    setErrors(found);
    setServerError(null);
    setExisting(null);
    if (Object.keys(found).length) return;

    // Only filled fields: the API rejects undeclared and empty ones (docs/API.md §1).
    const input: CreateUserInput = { name, password: values.password, roleKey: values.roleKey };
    if (email) input.email = email;
    if (phone) input.phone = phone;

    inFlight.current = true;
    try {
      await mutation.mutateAsync(input);
      setValues(empty);
      onCreated(name);
      onClose();
    } catch (error) {
      setValues((v) => ({ ...v, password: '' }));
      // By the API's stable code (docs/API.md §11): field errors under their field.
      const split = errorMessage.split(error, ['name', 'email', 'phone', 'password'] as const);
      const code = error instanceof ApiError ? error.code : '';
      if (code === 'EMAIL_OR_PHONE_REQUIRED') {
        setErrors({ ...split.fields, contact: errorMessage.message(error) });
      } else {
        setErrors(split.fields);
        setServerError(split.form);
      }
      if (code === 'USER_ALREADY_EXISTS') setExisting(email || phone);
    } finally {
      inFlight.current = false;
    }
  };

  const fid = (f: string) => `${id}-${f}`;
  return (
    <Modal open={open} onClose={close} title={t('create.title')}>
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <DialogError message={serverError}>
          {existing && onAddExisting ? (
            <Button
              variant="secondary"
              onClick={() => {
                const identifier = existing;
                close();
                onAddExisting(identifier);
              }}
            >
              {t('lookup.addInstead')}
            </Button>
          ) : null}
        </DialogError>
        <Field id={fid('name')} label={t('name')} error={errors.name}>
          <input
            id={fid('name')}
            className={inputClass}
            autoComplete="off"
            value={values.name}
            onChange={(e) => set('name')(e.target.value)}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={describedBy(fid('name'), { error: Boolean(errors.name) })}
          />
        </Field>
        <div
          className="space-y-4"
          role="group"
          aria-describedby={errors.contact ? fid('contact-error') : undefined}
        >
          <Field id={fid('email')} label={t('create.email')} error={errors.email}>
            <input
              id={fid('email')}
              type="email"
              inputMode="email"
              autoComplete="off"
              className={inputClass}
              value={values.email}
              onChange={(e) => set('email')(e.target.value)}
              aria-invalid={Boolean(errors.email || errors.contact) || undefined}
              aria-describedby={describedBy(fid('email'), { error: Boolean(errors.email) })}
            />
          </Field>
          <Field id={fid('phone')} label={t('create.phone')} error={errors.phone}>
            <input
              id={fid('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              className={inputClass}
              value={values.phone}
              onChange={(e) => set('phone')(e.target.value)}
              aria-invalid={Boolean(errors.phone || errors.contact) || undefined}
              aria-describedby={describedBy(fid('phone'), { error: Boolean(errors.phone) })}
            />
          </Field>
          {errors.contact ? (
            <p id={fid('contact-error')} className="text-sm font-medium text-danger">
              {errors.contact}
            </p>
          ) : null}
        </div>
        <Field
          id={fid('password')}
          label={t('create.password')}
          hint={t('create.passwordHint')}
          error={errors.password}
        >
          <PasswordInput
            id={fid('password')}
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => set('password')(e.target.value)}
            aria-invalid={Boolean(errors.password) || undefined}
            aria-describedby={describedBy(fid('password'), {
              hint: true,
              error: Boolean(errors.password),
            })}
          />
        </Field>
        <Field id={fid('role')} label={t('create.role')}>
          <RoleSelect
            id={fid('role')}
            value={values.roleKey}
            onChange={set('roleKey')}
            options={ASSIGNABLE_ROLE_KEYS}
          />
        </Field>
        <DialogButtons
          onCancel={close}
          pending={mutation.isPending}
          submitLabel={t('create.submit')}
          pendingLabel={t('create.saving')}
        />
      </form>
    </Modal>
  );
}

export function ChangeRoleDialog({
  user,
  onClose,
  onDone,
  slug,
  businessId,
}: {
  user: SettingsUser;
  onClose: () => void;
  onDone: (message: string) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('settings');
  const dt = useDynamicT();
  const id = useId();
  const mutation = useChangeRole(slug, businessId);
  const options = ASSIGNABLE_ROLE_KEYS as readonly string[];
  const [roleKey, setRoleKey] = useState(options.includes(user.role) ? user.role : options[0]!);
  const [serverError, setServerError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();
  const inFlight = useRef(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    if (roleKey === user.role) return onClose();
    inFlight.current = true;
    setServerError(null);
    try {
      await mutation.mutateAsync({ userId: user.id, roleKey });
      onDone(
        t('users.roleDialog.success', {
          name: user.name,
          role: dt(`settings.roleNames.${roleKey}`, roleKey),
        }),
      );
      onClose();
    } catch (error) {
      setServerError(errorMessage.message(error));
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Modal
      open
      onClose={() => (mutation.isPending ? undefined : onClose())}
      title={t('users.roleDialog.title', { name: user.name })}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <DialogError message={serverError} />
        <Field id={`${id}-role`} label={t('users.role')}>
          <RoleSelect id={`${id}-role`} value={roleKey} onChange={setRoleKey} options={options} />
        </Field>
        <DialogButtons
          onCancel={onClose}
          pending={mutation.isPending}
          submitLabel={t('users.roleDialog.submit')}
          pendingLabel={t('users.roleDialog.saving')}
        />
      </form>
    </Modal>
  );
}

export function ResetPasswordDialog({
  user,
  onClose,
  onDone,
  slug,
  businessId,
}: {
  user: SettingsUser;
  onClose: () => void;
  onDone: (message: string) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('settings.users');
  const id = useId();
  const mutation = useResetPassword(slug, businessId);
  // Never logged, never in the URL or a cache: component state only, cleared after sending.
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();
  const inFlight = useRef(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    // The new password must not be the TARGET user's email or phone.
    const rule = passwordRuleError(password, user);
    setError(rule ? t(`passwordError.${rule}`) : undefined);
    setServerError(null);
    if (rule) return;
    inFlight.current = true;
    try {
      await mutation.mutateAsync({ userId: user.id, newPassword: password });
      setPassword('');
      onDone(t('resetDialog.success', { name: user.name }));
      onClose();
    } catch (cause) {
      setPassword('');
      const split = errorMessage.split(cause, ['newPassword'] as const);
      setError(split.fields.newPassword);
      setServerError(split.form);
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Modal
      open
      onClose={() => (mutation.isPending ? undefined : onClose())}
      title={t('resetDialog.title', { name: user.name })}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-fg-muted">{t('resetDialog.intro')}</p>
        <DialogError message={serverError} />
        <Field
          id={`${id}-pw`}
          label={t('resetDialog.password')}
          hint={t('create.passwordHint')}
          error={error}
        >
          <PasswordInput
            id={`${id}-pw`}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy(`${id}-pw`, { hint: true, error: Boolean(error) })}
          />
        </Field>
        <DialogButtons
          onCancel={onClose}
          pending={mutation.isPending}
          submitLabel={t('resetDialog.submit')}
          pendingLabel={t('resetDialog.saving')}
        />
      </form>
    </Modal>
  );
}

/**
 * Add a user who already exists (works in another business) to this one: look up by email or
 * phone (`POST users/lookup`), then give a role (`POST users/:id/access`). The identifier lives
 * only in this dialog's state — never in the URL or a cache — and is cleared on close.
 */
export function AddExistingUserDialog({
  initialIdentifier = '',
  onClose,
  onDone,
  slug,
  businessId,
}: {
  initialIdentifier?: string;
  onClose: () => void;
  onDone: (message: string) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('settings');
  const dt = useDynamicT();
  const format = useFormat();
  const id = useId();
  const errorMessage = useErrorMessage();
  const grant = useGrantAccess(slug, businessId);
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [found, setFound] = useState<UserLookup | null>(null);
  const [roleKey, setRoleKey] = useState<string>(ASSIGNABLE_ROLE_KEYS[0]);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const inFlight = useRef(false);
  const pending = searching || grant.isPending;
  const roleLabel = (key: string) => dt(`settings.roleNames.${key}`, key);

  const close = () => {
    if (pending) return;
    setIdentifier('');
    setFound(null);
    onClose();
  };

  const search = async () => {
    const value = identifier.trim();
    setFieldError(undefined);
    setServerError(null);
    setFound(null);
    if (!value) return setFieldError(t('users.lookup.required'));
    setSearching(true);
    try {
      setFound(await lookupUser(slug, value));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setFieldError(t('users.lookup.notFound'));
      } else if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds) {
        setServerError(
          t('users.lookup.rateLimited', { seconds: format.number(error.retryAfterSeconds) }),
        );
      } else setServerError(errorMessage.message(error));
    } finally {
      setSearching(false);
    }
  };

  const add = async (user: UserLookup) => {
    setServerError(null);
    try {
      await grant.mutateAsync({ userId: user.id, roleKey });
      setIdentifier('');
      onDone(t('users.lookup.success', { name: user.name, role: roleLabel(roleKey) }));
      onClose();
    } catch (error) {
      setServerError(errorMessage.message(error));
    }
  };

  const canAdd = found && !found.isPlatformOwner && !found.hasAccess;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      if (canAdd) await add(found);
      else await search();
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Modal open onClose={close} title={t('users.lookup.title')}>
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-fg-muted">{t('users.lookup.intro')}</p>
        <DialogError message={serverError} />
        <Field
          id={`${id}-identifier`}
          label={t('users.lookup.identifier')}
          hint={t('users.lookup.identifierHint')}
          error={fieldError}
        >
          <div className="flex gap-2">
            <input
              id={`${id}-identifier`}
              className={inputClass}
              autoComplete="off"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setFound(null);
              }}
              aria-invalid={Boolean(fieldError) || undefined}
              aria-describedby={describedBy(`${id}-identifier`, {
                hint: true,
                error: Boolean(fieldError),
              })}
            />
            {canAdd ? (
              <Button variant="secondary" onClick={() => void search()} disabled={pending}>
                {t('users.lookup.search')}
              </Button>
            ) : null}
          </div>
        </Field>

        <div role="status" aria-live="polite">
          {found ? (
            <div className="space-y-2 rounded-lg border border-border px-3 py-3 text-sm">
              <p className="font-medium text-fg">{found.name}</p>
              <p className={found.isActive ? 'text-success' : 'text-danger'}>
                {found.isActive ? t('users.active') : t('users.inactive')}
              </p>
              {found.isPlatformOwner ? (
                <p className="text-fg-muted">{t('users.lookup.platformOwner')}</p>
              ) : found.hasAccess ? (
                <p className="text-fg-muted">
                  {t('users.lookup.alreadyMember', {
                    role: found.role ? roleLabel(found.role) : '—',
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {canAdd ? (
          <Field id={`${id}-role`} label={t('users.role')}>
            <RoleSelect
              id={`${id}-role`}
              value={roleKey}
              onChange={setRoleKey}
              options={ASSIGNABLE_ROLE_KEYS}
            />
          </Field>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={close} disabled={pending}>
            {t('users.cancel')}
          </Button>
          {!found || canAdd ? (
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {canAdd
                ? grant.isPending
                  ? t('users.lookup.saving')
                  : t('users.lookup.submit')
                : searching
                  ? t('users.lookup.searching')
                  : t('users.lookup.search')}
            </Button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
