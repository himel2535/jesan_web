'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { passwordRuleError, type PasswordRuleError } from '@/core/auth/password-rules';
import { useDynamicT } from '@/core/i18n/use-dynamic-t';
import { Button } from '@/core/ui/button';
import { Modal } from '@/core/ui/modal';
import { PasswordInput } from '@/core/ui/password-input';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { useChangeRole, useCreateUser, useResetPassword } from './api';
import { settingsErrorKind, type SettingsErrorKind } from './errors';
import { ASSIGNABLE_ROLE_KEYS, type CreateUserInput, type SettingsUser } from './types';

/** Server error inside a dialog (role="alert"); one translated message per error kind. */
function DialogError({ kind }: { kind: SettingsErrorKind | null }) {
  const t = useTranslations('settings.users.error');
  return (
    <div role="alert">
      {kind ? (
        <p className="rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger">
          {t(kind)}
        </p>
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
  slug,
  businessId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('settings.users');
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
  const [serverError, setServerError] = useState<SettingsErrorKind | null>(null);
  const inFlight = useRef(false);

  const close = () => {
    if (mutation.isPending) return;
    setValues(empty);
    setErrors({});
    setServerError(null);
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
      setServerError(settingsErrorKind(error));
    } finally {
      inFlight.current = false;
    }
  };

  const fid = (f: string) => `${id}-${f}`;
  return (
    <Modal open={open} onClose={close} title={t('create.title')}>
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <DialogError kind={serverError} />
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
  const [serverError, setServerError] = useState<SettingsErrorKind | null>(null);
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
      setServerError(settingsErrorKind(error));
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
        <DialogError kind={serverError} />
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
  const [serverError, setServerError] = useState<SettingsErrorKind | null>(null);
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
      setServerError(settingsErrorKind(cause));
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
        <DialogError kind={serverError} />
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
