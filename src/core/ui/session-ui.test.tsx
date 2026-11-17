import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { managerMe, ownerMe } from '../../../test/fixtures/me';
import { expectNoA11yViolations, renderWithIntl } from '../../../test/utils';
import { apiFetch } from '@/core/api/client';
import { Can, useCan } from '@/core/auth/can';
import { BusinessProvider, SessionProvider } from '@/core/auth/session-context';
import type { Me } from '@/core/auth/types';
import { BusinessCard } from './business-card';
import { BusinessSwitcher } from './business-switcher';
import { UserMenu } from './user-menu';

const nav = vi.hoisted(() => ({ navigateTo: vi.fn() }));
vi.mock('@/core/lib/navigation', () => nav);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/b/example-cement',
}));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  nav.navigateTo.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const inBusiness = (me: Me, ui: React.ReactElement, locale: 'en' | 'bn' = 'en') =>
  renderWithIntl(
    <SessionProvider me={me}>
      <BusinessProvider business={me.businesses[0]!}>{ui}</BusinessProvider>
    </SessionProvider>,
    { locale },
  );

describe('session over → back to login', () => {
  it('a client API call: 401, one refresh (401), one retry (401) → /login?next=current page', async () => {
    window.history.pushState({}, '', '/b/example-cement/sales?page=2');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ statusCode: 401 }), { status: 401 }));
    inBusiness(managerMe, <p>page</p>);

    await expect(apiFetch('/b/example-cement/users')).rejects.toMatchObject({ status: 401 });
    const paths = fetchMock.mock.calls.map(([url]) => url);
    expect(paths).toEqual([
      '/api/v1/b/example-cement/users',
      '/api/v1/auth/refresh',
      '/api/v1/b/example-cement/users',
    ]);
    expect(nav.navigateTo).toHaveBeenCalledWith(
      '/login?next=%2Fb%2Fexample-cement%2Fsales%3Fpage%3D2',
    );
  });
});

describe('useCan / <Can> (UI convenience only)', () => {
  function Probe() {
    return <span>{useCan('commission.view') ? 'yes' : 'no'}</span>;
  }

  it('follows the current business permissions', () => {
    inBusiness(
      managerMe,
      <>
        <Probe />
        <Can permission="sale.create">
          <button type="button">New sale</button>
        </Can>
        <Can permission="profit.view" fallback={<span>hidden</span>}>
          <span>profit</span>
        </Can>
      </>,
    );
    expect(screen.getByText('no')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New sale' })).toBeInTheDocument();
    expect(screen.queryByText('profit')).not.toBeInTheDocument();
    expect(screen.getByText('hidden')).toBeInTheDocument();
  });

  it('platform owner gets commission/profit', () => {
    inBusiness(ownerMe, <Can permission="profit.view">{'profit'}</Can>);
    expect(screen.getByText('profit')).toBeInTheDocument();
  });
});

describe('<UserMenu>', () => {
  it('shows name and the role in this business; opens with the keyboard, Esc closes', async () => {
    inBusiness(managerMe, <UserMenu theme="system" />);
    const toggle = screen.getByRole('button', { name: 'User menu' });
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Rahim Uddin')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change password' })).toHaveAttribute(
      'href',
      '/account/password',
    );
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('role in Bengali in bn', async () => {
    inBusiness(managerMe, <UserMenu theme="light" />, 'bn');
    await userEvent.click(screen.getByRole('button', { name: 'ব্যবহারকারী মেনু' }));
    expect(screen.getByText('ম্যানেজার')).toBeInTheDocument();
  });

  it('signs out: POST /auth/logout, then a full load of /login', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    inBusiness(managerMe, <UserMenu theme="light" />);
    await userEvent.click(screen.getByRole('button', { name: 'User menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/auth/logout');
    expect(nav.navigateTo).toHaveBeenCalledWith('/login');
  });

  it('has no basic accessibility violations when open', async () => {
    const { container } = inBusiness(managerMe, <UserMenu theme="light" />);
    await userEvent.click(screen.getByRole('button', { name: 'User menu' }));
    await expectNoA11yViolations(container);
  });
});

describe('<BusinessSwitcher>', () => {
  it('lists the user’s businesses by locale and marks the current one', async () => {
    inBusiness(managerMe, <BusinessSwitcher />, 'bn');
    await userEvent.click(screen.getByRole('button', { name: 'ব্যবসা বদলান' }));
    const current = screen.getByRole('link', { name: 'উদাহরণ সিমেন্ট' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveAttribute('href', '/b/example-cement');
    expect(screen.getByRole('link', { name: 'উদাহরণ রড' })).toHaveAttribute(
      'href',
      '/b/example-rod',
    );
    expect(screen.getByRole('link', { name: 'সব ব্যবসা' })).toHaveAttribute('href', '/');
  });

  it('closes on a click outside', async () => {
    inBusiness(managerMe, <BusinessSwitcher />);
    const toggle = screen.getByRole('button', { name: 'Switch business' });
    await userEvent.click(toggle);
    await userEvent.click(document.body);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('<BusinessCard>', () => {
  it('is one link named by its content', async () => {
    const { container } = renderWithIntl(
      <ul>
        <li>
          <BusinessCard
            href="/b/example-cement"
            name="Example Cement"
            typeLabel="Dealership"
            roleText="Your role: Manager"
          />
        </li>
      </ul>,
    );
    const link = screen.getByRole('link', { name: /Example Cement/ });
    expect(link).toHaveAttribute('href', '/b/example-cement');
    expect(within(link).getByText('Dealership')).toBeInTheDocument();
    expect(within(link).getByText('Your role: Manager')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
