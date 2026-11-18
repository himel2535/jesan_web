import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { managerMe } from '../../../../test/fixtures/me';
import { expectNoA11yViolations, renderWithIntl } from '../../../../test/utils';
import { SessionProvider } from '../session-context';
import { ChangePasswordForm, validatePasswords } from './change-password-form';

vi.mock('@/core/lib/navigation', () => ({ navigateTo: vi.fn() }));

const identity = { email: 'manager@example.com', phone: '+8801712345678' };

describe('validatePasswords (API rules, checked before sending)', () => {
  const v = (current: string, next: string, confirm = next) =>
    validatePasswords({ current, new: next, confirm }, identity);

  it('accepts 10–128 characters', () => {
    expect(v('old', 'long-enough-1')).toEqual({});
    expect(v('old', 'x'.repeat(128))).toEqual({});
  });

  it('rejects empty, too short, too long, mismatched', () => {
    expect(v('', '', '')).toEqual({ current: 'required', new: 'required', confirm: 'required' });
    expect(v('old', 'short-9ch')).toMatchObject({ new: 'tooShort' });
    expect(v('old', 'x'.repeat(129))).toMatchObject({ new: 'tooLong' });
    expect(v('old', 'long-enough-1', 'long-enough-2')).toEqual({ confirm: 'mismatch' });
  });

  it('rejects the own email or phone (any phone format)', () => {
    expect(v('old', 'Manager@Example.com')).toMatchObject({ new: 'sameAsIdentity' });
    expect(v('old', '01712345678')).toMatchObject({ new: 'sameAsIdentity' });
    expect(v('old', '+8801712345678')).toMatchObject({ new: 'sameAsIdentity' });
  });
});

describe('<ChangePasswordForm>', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const render = () =>
    renderWithIntl(
      <SessionProvider me={managerMe}>
        <ChangePasswordForm />
      </SessionProvider>,
    );
  const fill = async (current: string, next: string, confirm = next) => {
    await userEvent.type(screen.getByLabelText('Current password'), current);
    await userEvent.type(screen.getByLabelText('New password'), next);
    await userEvent.type(screen.getByLabelText('Confirm new password'), confirm);
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
  };

  it('sends POST /auth/change-password and confirms success', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    render();
    await fill('old-password-1', 'new-password-1');
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/change-password');
    expect(JSON.parse(String(init.body))).toEqual({
      currentPassword: 'old-password-1',
      newPassword: 'new-password-1',
    });
    expect(screen.getByRole('status')).toHaveTextContent('Other devices have been signed out');
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('CURRENT_PASSWORD_INCORRECT → "current password is wrong" on the field', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: 'Current password is incorrect',
          statusCode: 400,
          code: 'CURRENT_PASSWORD_INCORRECT',
          field: 'currentPassword',
        }),
        { status: 400 },
      ),
    );
    render();
    await fill('wrong-current-1', 'new-password-1');
    expect(screen.getByRole('alert')).toHaveTextContent('The current password is wrong');
    expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('another code (e.g. PASSWORD_MATCHES_IDENTITY) shows its own message', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ statusCode: 400, message: 'x', code: 'PASSWORD_MATCHES_IDENTITY' }),
        { status: 400 },
      ),
    );
    render();
    await fill('old-password-1', 'new-password-1');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The password cannot be the user’s own email or phone.',
    );
  });

  it('shows rule errors on the fields and sends nothing', async () => {
    render();
    await fill('old', 'short', 'other');
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
      /at least 10 characters/,
    );
    expect(screen.getByLabelText('Confirm new password')).toHaveAccessibleDescription(
      /do not match/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('has no basic accessibility violations', async () => {
    const { container } = render();
    await expectNoA11yViolations(container);
  });
});
