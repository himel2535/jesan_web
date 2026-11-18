import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { managerMe, ownerMe } from '../../../test/fixtures/me';
import { apiError, json, mockApi, renderInBusiness } from '../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../test/utils';
import type { SettingsUser, UsersPage } from './types';
import { UsersSection } from './users-section';

const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/b/example-cement/settings/users',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  nav.search = '';
});

const BID = 'b1';
const LIST = 'GET /b/example-cement/users';

const user = (overrides: Partial<SettingsUser>): SettingsUser => ({
  id: 'u9',
  name: 'Karim Seller',
  email: 'karim@example.com',
  phone: null,
  isActive: true,
  lastLoginAt: '2026-11-17T07:35:26.027Z',
  role: 'salesman',
  ...overrides,
});

const page = (items: SettingsUser[], total = items.length): UsersPage => ({
  items,
  page: 1,
  pageSize: 10,
  total,
});
const owner = user({
  id: ownerMe.user.id,
  name: 'Jesan Owner',
  email: 'owner@example.com',
  role: 'owner',
});
const karim = user({});

const renderUsers = (me = ownerMe, locale: 'en' | 'bn' = 'en') =>
  renderInBusiness(<UsersSection slug="example-cement" businessId={BID} />, { me, locale });

async function openAction(name: string, action: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  await userEvent.click(screen.getByRole('button', { name: action }));
}

describe('<UsersSection> list', () => {
  it('shows name, contact, role, status and last sign-in; own row has no actions', async () => {
    mockApi({ [LIST]: () => json(200, page([owner, karim])) });
    renderUsers();
    const row = (await screen.findByRole('rowheader', { name: 'Karim Seller' })).closest('tr')!;
    expect(row).toHaveTextContent('karim@example.com');
    expect(row).toHaveTextContent('Salesman');
    expect(row).toHaveTextContent('Active');
    expect(screen.getByRole('columnheader', { name: 'Last sign-in' })).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Actions for Jesan Owner' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Karim Seller' })).toBeInTheDocument();
  });

  it('drops the last sign-in column when the API does not send the field', async () => {
    const { lastLoginAt: _drop, ...noLogin } = karim;
    mockApi({ [LIST]: () => json(200, page([noLogin as SettingsUser])) });
    renderUsers();
    await screen.findByRole('rowheader', { name: 'Karim Seller' });
    expect(screen.queryByRole('columnheader', { name: 'Last sign-in' })).not.toBeInTheDocument();
  });

  it('requests the page from the URL and paginates by 10', async () => {
    nav.search = 'page=2';
    const { calls } = mockApi({ [LIST]: () => json(200, { ...page([karim], 13), page: 2 }) });
    renderUsers();
    await screen.findByRole('rowheader', { name: 'Karim Seller' });
    expect(calls[0]!.url).toBe('/api/v1/b/example-cement/users?page=2');
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  });

  it('empty state, and server error with retry', async () => {
    let fail = true;
    mockApi({ [LIST]: () => (fail ? json(500, { statusCode: 500 }) : json(200, page([]))) });
    renderUsers();
    expect(await screen.findByText(/server is not reachable/)).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No users yet')).toBeInTheDocument();
  });
});

describe('<UsersSection> manager (users.view only): view only', () => {
  it('no New user button, no actions, with a view-only note', async () => {
    mockApi({ [LIST]: () => json(200, page([karim])) });
    renderUsers(managerMe);
    await screen.findByRole('rowheader', { name: 'Karim Seller' });
    expect(screen.getByText(/View only/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New user' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
  });
});

describe('<UsersSection> owner actions', () => {
  it('creates a user: only filled fields sent, owner role not offered, list refreshed', async () => {
    const { calls } = mockApi({
      [LIST]: () => json(200, page([owner])),
      'POST /b/example-cement/users': () => json(201, { id: 'u10', role: 'accountant' }),
    });
    const { invalidate } = renderUsers();
    await userEvent.click(await screen.findByRole('button', { name: 'New user' }));
    const dialog = screen.getByRole('dialog', { name: 'New user' });
    const roleSelect = within(dialog).getByLabelText('Role');
    expect(within(roleSelect).queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Nadia Hisab');
    await userEvent.type(within(dialog).getByLabelText('Phone'), '01812345678');
    await userEvent.type(within(dialog).getByLabelText('Initial password'), 'nadia-initial-1');
    await userEvent.selectOptions(roleSelect, 'accountant');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create user' }));

    expect(await screen.findByText('Nadia Hisab was added.')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toEqual({
      name: 'Nadia Hisab',
      phone: '01812345678',
      password: 'nadia-initial-1',
      roleKey: 'accountant',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['settings', BID, 'users'] });
    expect(invalidate.mock.calls.some(([f]) => f?.queryKey?.[2] !== 'users')).toBe(false);
  });

  it('validates before sending: contact required, password rules against the new user’s email', async () => {
    const { calls } = mockApi({ [LIST]: () => json(200, page([owner])) });
    renderUsers();
    await userEvent.click(await screen.findByRole('button', { name: 'New user' }));
    const dialog = screen.getByRole('dialog', { name: 'New user' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create user' }));
    expect(within(dialog).getByLabelText('Name')).toHaveAccessibleDescription(
      'This field is required.',
    );
    expect(within(dialog).getByLabelText('Initial password')).toHaveAccessibleDescription(
      /This field is required/,
    );
    expect(within(dialog).getByText('Enter an email or a phone number.')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Email'), 'nadia@example.com');
    await userEvent.type(within(dialog).getByLabelText('Initial password'), 'nadia@example.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create user' }));
    expect(within(dialog).getByLabelText('Initial password')).toHaveAccessibleDescription(
      /cannot be the user’s email/,
    );
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('409 duplicate: message, password cleared, no double submit', async () => {
    let resolve: (r: Response) => void = () => {};
    const { calls } = mockApi({
      [LIST]: () => json(200, page([owner])),
      'POST /b/example-cement/users': () => new Promise<Response>((r) => (resolve = r)),
    });
    renderUsers();
    await userEvent.click(await screen.findByRole('button', { name: 'New user' }));
    const dialog = screen.getByRole('dialog', { name: 'New user' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Dup');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'manager@example.com');
    await userEvent.type(within(dialog).getByLabelText('Initial password'), 'dup-password-1');
    const submit = within(dialog).getByRole('button', { name: 'Create user' });
    await userEvent.dblClick(submit);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    resolve(apiError(409, 'USER_ALREADY_EXISTS'));
    expect(
      await within(dialog).findByText('A user with this email or phone already exists.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Initial password')).toHaveValue('');
    // Offer to add that existing user instead: opens the lookup with the same email.
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'Add the existing user to this business instead',
      }),
    );
    const lookup = await screen.findByRole('dialog', { name: 'Add an existing user' });
    expect(within(lookup).getByLabelText('Email or phone')).toHaveValue('manager@example.com');
  });

  it('changes a role (PATCH) without offering owner', async () => {
    const { calls } = mockApi({
      [LIST]: () => json(200, page([owner, karim])),
      'PATCH /b/example-cement/users/u9/role': () => json(200, { id: 'u9', role: 'accountant' }),
    });
    renderUsers();
    await openAction('Karim Seller', 'Change role');
    const dialog = screen.getByRole('dialog', { name: 'Change role of Karim Seller' });
    expect(within(dialog).queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'accountant');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change role' }));
    expect(await screen.findByText('Karim Seller is now Accountant.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ roleKey: 'accountant' });
  });

  it('removes access after confirming (DELETE)', async () => {
    const { calls } = mockApi({
      [LIST]: () => json(200, page([owner, karim])),
      'DELETE /b/example-cement/users/u9/access': () => json(204),
    });
    renderUsers();
    await openAction('Karim Seller', 'Remove from this business');
    const dialog = screen.getByRole('dialog', { name: 'Remove Karim Seller from this business?' });
    expect(dialog).toHaveTextContent('Their account is not deleted');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText('Karim Seller was removed from this business.'),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('deactivates after confirming (PATCH status false); cancel sends nothing', async () => {
    const { calls } = mockApi({
      [LIST]: () => json(200, page([owner, karim])),
      'PATCH /b/example-cement/users/u9/status': () => json(204),
    });
    renderUsers();
    await openAction('Karim Seller', 'Deactivate');
    let dialog = screen.getByRole('dialog', { name: 'Deactivate Karim Seller?' });
    expect(dialog).toHaveTextContent('cannot sign in to any business');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);

    await openAction('Karim Seller', 'Deactivate');
    dialog = screen.getByRole('dialog', { name: 'Deactivate Karim Seller?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Karim Seller was deactivated.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ isActive: false });
  });

  it('server refuses (400, e.g. a platform owner account): message inside the dialog', async () => {
    mockApi({
      [LIST]: () => json(200, page([owner, karim])),
      'PATCH /b/example-cement/users/u9/status': () => apiError(400, 'PLATFORM_OWNER_PROTECTED'),
    });
    renderUsers();
    await openAction('Karim Seller', 'Deactivate');
    const dialog = screen.getByRole('dialog', { name: 'Deactivate Karim Seller?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'A platform owner account cannot be changed here.',
    );
  });

  it('resets a password: rules vs the target user, POST body only, form cleared, devices signed out', async () => {
    const { calls } = mockApi({
      [LIST]: () => json(200, page([owner, karim])),
      'POST /b/example-cement/users/u9/reset-password': () => json(204),
    });
    renderUsers();
    await openAction('Karim Seller', 'Reset password');
    const dialog = screen.getByRole('dialog', { name: 'Reset password of Karim Seller' });
    const input = within(dialog).getByLabelText('New password');
    await userEvent.type(input, 'short');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }));
    expect(input).toHaveAccessibleDescription(/at least 10 characters/);

    await userEvent.clear(input);
    await userEvent.type(input, 'karim-new-pass-1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }));
    expect(
      await screen.findByText(/All their other devices have been signed out/),
    ).toBeInTheDocument();
    const call = calls.find((c) => c.path.endsWith('/reset-password'))!;
    expect(call.body).toEqual({ newPassword: 'karim-new-pass-1' });
    expect(call.url).not.toContain('karim-new-pass-1');
    expect(screen.queryByDisplayValue('karim-new-pass-1')).not.toBeInTheDocument();
  });

  it('is in Bengali in bn and has no basic accessibility violations', async () => {
    mockApi({ [LIST]: () => json(200, page([owner, karim])) });
    const { container } = renderUsers(ownerMe, 'bn');
    expect(await screen.findByRole('columnheader', { name: 'শেষ লগইন' })).toBeInTheDocument();
    const row = screen.getByRole('rowheader', { name: 'Karim Seller' }).closest('tr')!;
    expect(row).toHaveTextContent('বিক্রয়কর্মী');
    expect(row).toHaveTextContent('সক্রিয়');
    await expectNoA11yViolations(container);
  });
});

describe('<UsersSection> platform owner rows and existing users (§8)', () => {
  const LOOKUP = 'POST /b/example-cement/users/lookup';
  const found = {
    id: 'u7',
    name: 'Rahim Uddin',
    isActive: true,
    isPlatformOwner: false,
    hasAccess: false,
    role: null,
  };

  const openLookup = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Add existing user' }));
    return screen.getByRole('dialog', { name: 'Add an existing user' });
  };

  it('another platform owner’s row has no actions, only a note', async () => {
    mockApi({
      [LIST]: () =>
        json(
          200,
          page([owner, karim, user({ id: 'p2', name: 'Other Owner', isPlatformOwner: true })]),
        ),
    });
    renderUsers();
    const row = (await screen.findByRole('rowheader', { name: 'Other Owner' })).closest('tr')!;
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    expect(row).toHaveTextContent('A platform owner’s account cannot be changed here.');
    expect(screen.getByRole('button', { name: 'Actions for Karim Seller' })).toBeInTheDocument();
  });

  it('finds by email in the body (not the URL), then adds with the chosen role', async () => {
    const { calls } = mockApi({
      [LIST]: () => json(200, page([owner, karim])),
      [LOOKUP]: () => json(200, found),
      'POST /b/example-cement/users/u7/access': () => json(200, { id: 'u7', role: 'accountant' }),
    });
    const { invalidate } = renderUsers();
    const dialog = await openLookup();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
    expect(within(dialog).getByLabelText('Email or phone')).toHaveAccessibleDescription(
      /Enter an email or a phone number/,
    );
    await userEvent.type(within(dialog).getByLabelText('Email or phone'), 'Rahim@Example.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
    expect(await within(dialog).findByText('Rahim Uddin')).toBeInTheDocument();
    const lookupCall = calls.find((c) => c.url.endsWith('/users/lookup'))!;
    expect(lookupCall.body).toEqual({ identifier: 'Rahim@Example.com' });
    expect(lookupCall.url).not.toContain('Rahim');

    await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'accountant');
    await userEvent.dblClick(within(dialog).getByRole('button', { name: 'Add to this business' }));
    expect(await screen.findByText('Rahim Uddin was added as Accountant.')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.endsWith('/access'))).toHaveLength(1);
    expect(calls.find((c) => c.url.endsWith('/access'))!.body).toEqual({ roleKey: 'accountant' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['settings', BID, 'users'] });
  });

  it('already a member, or a platform owner: a message and no add button', async () => {
    let answer: object = { ...found, hasAccess: true, role: 'manager' };
    mockApi({ [LIST]: () => json(200, page([owner])), [LOOKUP]: () => json(200, answer) });
    renderUsers();
    const dialog = await openLookup();
    await userEvent.type(within(dialog).getByLabelText('Email or phone'), '01712345678');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
    expect(
      await within(dialog).findByText('Already in this business, as Manager.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Add to this business' }),
    ).not.toBeInTheDocument();

    answer = { ...found, isPlatformOwner: true, hasAccess: true };
    await userEvent.type(within(dialog).getByLabelText('Email or phone'), '9');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Search' }));
    expect(
      await within(dialog).findByText(/platform owner, who can already open every business/),
    ).toBeInTheDocument();
  });

  it('404 → not found under the field; 429 → wait seconds; Bengali; a11y', async () => {
    let status = 404;
    mockApi({
      [LIST]: () => json(200, page([owner])),
      [LOOKUP]: () =>
        status === 404
          ? apiError(404, 'USER_NOT_FOUND')
          : json(429, { statusCode: 429, code: 'RATE_LIMITED' }, { 'Retry-After': '42' }),
    });
    const { container } = renderUsers(ownerMe, 'bn');
    await userEvent.click(await screen.findByRole('button', { name: 'বিদ্যমান ইউজার যোগ করুন' }));
    const dialog = screen.getByRole('dialog', { name: 'বিদ্যমান ইউজারকে যোগ করুন' });
    await userEvent.type(within(dialog).getByLabelText('ইমেইল বা ফোন'), 'nobody@example.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'খুঁজুন' }));
    expect(within(dialog).getByLabelText('ইমেইল বা ফোন')).toHaveAccessibleDescription(
      /কোনো ইউজার পাওয়া যায়নি/,
    );
    status = 429;
    await userEvent.click(within(dialog).getByRole('button', { name: 'খুঁজুন' }));
    expect(await within(dialog).findByText(/৪২ সেকেন্ড/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('a manager (no users.manage) has no add-existing button', async () => {
    mockApi({ [LIST]: () => json(200, page([owner])) });
    renderUsers(managerMe);
    await screen.findByRole('rowheader', { name: /Jesan Owner|Owner/ });
    expect(screen.queryByRole('button', { name: 'Add existing user' })).not.toBeInTheDocument();
  });
});
