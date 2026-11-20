import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations, renderWithIntl } from '../../../../test/utils';
import { LoginForm } from './login-form';

const nav = vi.hoisted(() => ({ navigateTo: vi.fn() }));
vi.mock('@/core/lib/navigation', () => nav);

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  nav.navigateTo.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

async function fillAndSubmit(identifier = 'manager@example.com', password = 'test-pass-123') {
  await userEvent.type(screen.getByLabelText('Email or phone'), identifier);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('<LoginForm>', () => {
  it('signs in through the same-origin API and goes to `next`', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { user: { id: 'u2' } }));
    renderWithIntl(<LoginForm next="/b/example-cement/sales" />);
    await fillAndSubmit('  Manager@Example.com ');

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/login');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(String(init.body))).toEqual({
      identifier: 'Manager@Example.com',
      password: 'test-pass-123',
    });
    expect(nav.navigateTo).toHaveBeenCalledWith('/b/example-cement/sales');
  });

  it('wrong credentials (or a locked account): one general message, never a refresh', async () => {
    fetchMock.mockResolvedValue(json(401, { message: 'Invalid credentials', statusCode: 401 }));
    renderWithIntl(<LoginForm next="/" />);
    await fillAndSubmit();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Wrong email/phone or password, or the account is temporarily locked',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(screen.getByLabelText('Email or phone')).toHaveAttribute('aria-invalid', 'true');
    expect(nav.navigateTo).not.toHaveBeenCalled();
  });

  it('429: a separate message with the Retry-After seconds', async () => {
    fetchMock.mockResolvedValueOnce(json(429, { statusCode: 429 }, { 'Retry-After': '42' }));
    renderWithIntl(<LoginForm next="/" />);
    await fillAndSubmit();
    expect(screen.getByRole('alert')).toHaveTextContent('Try again in 42 seconds');
  });

  // A sleeping free-tier backend, not a wrong password: say so, keep what was typed, and offer
  // one button that sends it again.
  it('server down (network error or 5xx): the waking message and a retry button', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    renderWithIntl(<LoginForm next="/" />);
    await fillAndSubmit();
    expect(screen.getByRole('alert')).toHaveTextContent('The server is waking up');
    expect(screen.getByLabelText('Password')).toHaveValue('test-pass-123');

    fetchMock.mockResolvedValueOnce(json(500, { statusCode: 500 }));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert')).toHaveTextContent('The server is waking up');

    // It really resent the password that was still in the field, unchanged.
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      identifier: 'manager@example.com',
      password: 'test-pass-123',
    });
  });

  it('a wrong password is still cleared, and no retry button is offered', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401 }));
    renderWithIntl(<LoginForm next="/" />);
    await fillAndSubmit();
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('submits only once on a double click', async () => {
    let resolve: (r: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<Response>((r) => (resolve = r)));
    renderWithIntl(<LoginForm next="/" />);
    await userEvent.type(screen.getByLabelText('Email or phone'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'pass-12345');
    const button = screen.getByRole('button', { name: 'Sign in' });
    await userEvent.dblClick(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    await act(async () => resolve(json(200, {})));
  });

  it('empty fields: errors announced on the fields, nothing sent', async () => {
    renderWithIntl(<LoginForm next="/" />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const identifier = screen.getByLabelText('Email or phone');
    expect(identifier).toHaveAttribute('aria-invalid', 'true');
    expect(identifier).toHaveAccessibleDescription(/This field is required/);
    expect(identifier).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('toggles password visibility with a labelled, pressed-state button', async () => {
    renderWithIntl(<LoginForm next="/" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('is fully in Bengali in bn', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401 }));
    renderWithIntl(<LoginForm next="/" />, { locale: 'bn' });
    await userEvent.type(screen.getByLabelText('ইমেইল বা ফোন'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('পাসওয়ার্ড'), 'x-12345678');
    await userEvent.click(screen.getByRole('button', { name: 'লগইন' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ইমেইল/ফোন বা পাসওয়ার্ড ভুল');
  });

  it.each(['en', 'bn'] as const)(
    'has no basic accessibility violations (%s, with an error)',
    async (locale) => {
      fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401 }));
      const { container } = renderWithIntl(<LoginForm next="/" />, { locale });
      await userEvent.click(
        screen.getByRole('button', { name: locale === 'en' ? 'Sign in' : 'লগইন' }),
      );
      await expectNoA11yViolations(container);
    },
  );
});
