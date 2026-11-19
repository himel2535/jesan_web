import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Link from 'next/link';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ownerMe } from '../../../test/fixtures/me';
import { json, mockApi, renderInBusiness, rolesMatrix } from '../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../test/utils';
import { RolesMatrix } from './roles-matrix';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/b/example-cement/settings/roles',
  useSearchParams: () => new URLSearchParams(),
}));

const BID = 'b1';
const ROLES = 'GET /b/example-cement/roles/permissions';
const putPath = (role: string) => `PUT /b/example-cement/roles/${role}/permissions`;

beforeEach(() => router.push.mockReset());
afterEach(() => vi.unstubAllGlobals());

const renderMatrix = (locale: 'en' | 'bn' = 'en') =>
  renderInBusiness(<RolesMatrix slug="example-cement" businessId={BID} />, { me: ownerMe, locale });

const cell = (permission: string, role: string) =>
  screen.getByRole('checkbox', { name: `${permission} for ${role}` });

describe('<RolesMatrix>', () => {
  it('shows a skeleton, then the matrix grouped by module and subject', async () => {
    mockApi({ [ROLES]: () => json(200, rolesMatrix()) });
    renderMatrix();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: /Manager/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Sales' })).toBeInTheDocument();
    expect(cell('View all sales', 'Manager')).toBeChecked();
  });

  it('locks the owner role and owner-only permissions, with the reason announced', async () => {
    mockApi({ [ROLES]: () => json(200, rolesMatrix()) });
    renderMatrix();
    const ownerCell = await screen.findByRole('checkbox', {
      name: 'View products and categories for Owner',
    });
    expect(ownerCell).toBeDisabled();
    expect(ownerCell).toHaveAccessibleDescription(/owner role always has every permission/);
    const commission = cell('View commission', 'Manager');
    expect(commission).toBeDisabled();
    expect(commission).toHaveAccessibleDescription(/Only the platform owner has this/);
    for (const role of ['Accountant', 'Salesman']) expect(cell('View profit', role)).toBeDisabled();
  });

  it('save → summary of added/removed → one PUT with the full list → success; only roles key refreshed', async () => {
    const { calls } = mockApi({
      [ROLES]: () => json(200, rolesMatrix()),
      [putPath('manager')]: () =>
        json(200, { role: 'manager', added: ['sale.void'], removed: ['users.view'] }),
    });
    const { invalidate } = renderMatrix();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Void sales for Manager' }));
    await userEvent.click(cell('View users', 'Manager'));
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog', { name: 'Save these changes?' });
    const managerSection = within(dialog).getByRole('region', { name: 'Manager' });
    expect(within(managerSection).getByText('Will be added').nextSibling).toHaveTextContent(
      'Void sales',
    );
    expect(within(managerSection).getByText('Will be removed').nextSibling).toHaveTextContent(
      'View users',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Saved: Manager.')).toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT')!;
    const sent = (put.body as { permissions: string[] }).permissions;
    expect(sent).toContain('sale.void');
    expect(sent).not.toContain('users.view');
    expect(sent).toContain('sale.view.all'); // full list, not a delta
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['settings', BID, 'roles'] });
    expect(
      invalidate.mock.calls.every(
        ([f]) =>
          JSON.stringify(f?.queryKey?.slice(0, 3)) === JSON.stringify(['settings', BID, 'roles']),
      ),
    ).toBe(true);
  });

  it('partial failure: names saved and failed roles; retry sends only the failed role', async () => {
    let salesmanAttempts = 0;
    const { calls } = mockApi({
      [ROLES]: () => json(200, rolesMatrix()),
      [putPath('manager')]: () => json(200, { role: 'manager', added: ['sale.void'], removed: [] }),
      [putPath('salesman')]: () =>
        ++salesmanAttempts === 1
          ? json(400, {
              message: '"profit.view" is owner-only and cannot be given to a role',
              statusCode: 400,
            })
          : json(200, { role: 'salesman', added: ['customer.due.view'], removed: [] }),
    });
    renderMatrix();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Void sales for Manager' }));
    await userEvent.click(cell('View customer dues and credit limits', 'Salesman'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved: Manager.')).toBeInTheDocument();
    const alert = screen.getByText('Not saved: Salesman.').closest('[role="alert"]') as HTMLElement;
    expect(alert).toHaveTextContent('the server refused it');
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument();

    const before = calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Retry the roles that failed' }));
    expect(await screen.findByText('Saved: Salesman.')).toBeInTheDocument();
    const retried = calls
      .slice(before)
      .filter((c) => c.method === 'PUT')
      .map((c) => c.path);
    expect(retried).toEqual(['/b/example-cement/roles/salesman/permissions']);
  });

  it('warns before leaving through a link with unsaved changes', async () => {
    mockApi({ [ROLES]: () => json(200, rolesMatrix()) });
    renderInBusiness(
      <>
        <Link href="/b/example-cement/settings/users">Users</Link>
        <RolesMatrix slug="example-cement" businessId={BID} />
      </>,
      { me: ownerMe },
    );
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Void sales for Manager' }));
    await userEvent.click(screen.getByRole('link', { name: 'Users' }));
    const dialog = screen.getByRole('dialog', { name: 'Leave without saving?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(router.push).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('link', { name: 'Users' }));
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(router.push).toHaveBeenCalledWith('/b/example-cement/settings/users');
  });

  it('keyboard: arrows move between cells, skipping locked ones; Space toggles', async () => {
    mockApi({ [ROLES]: () => json(200, rolesMatrix()) });
    renderMatrix();
    const start = await screen.findByRole('checkbox', { name: 'Void sales for Manager' });
    start.focus();
    await userEvent.keyboard('{ArrowLeft}'); // Owner column is locked: nowhere to go
    expect(start).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(cell('Void sales', 'Accountant')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(cell('Correct an order, directly or by approval', 'Accountant')).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(cell('Correct an order, directly or by approval', 'Accountant')).toBeChecked();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}'); // past sale.void to the next row (delivery.view)
    expect(cell('See deliveries', 'Accountant')).toHaveFocus();
  });

  it('load error shows retry', async () => {
    let fail = true;
    mockApi({ [ROLES]: () => (fail ? json(503, { statusCode: 503 }) : json(200, rolesMatrix())) });
    renderMatrix();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    fail = false;
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('columnheader', { name: /Manager/ })).toBeInTheDocument();
  });

  it('phones: one role at a time with a role chooser', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    mockApi({ [ROLES]: () => json(200, rolesMatrix()) });
    renderMatrix('bn');
    const chooser = await screen.findByRole('group', { name: 'কোন রোল বদলাবেন' });
    await userEvent.click(within(chooser).getByRole('button', { name: 'বিক্রয়কর্মী' }));
    expect(
      screen.getByRole('checkbox', { name: 'বিক্রয়কর্মী-এর জন্য বিক্রির invoice তৈরি' }),
    ).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /ম্যানেজার-এর জন্য/ })).not.toBeInTheDocument();
  });

  it('has no basic accessibility violations (en and bn)', async () => {
    mockApi({ [ROLES]: () => json(200, rolesMatrix()) });
    const { container, unmount } = renderMatrix();
    await screen.findByRole('columnheader', { name: /Manager/ });
    await expectNoA11yViolations(container);
    unmount();
    const bnRender = renderMatrix('bn');
    await screen.findByRole('columnheader', { name: /ম্যানেজার/ });
    await expectNoA11yViolations(bnRender.container);
  });
});
