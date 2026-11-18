import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/core/auth/types';
import {
  MANAGER_PERMISSIONS,
  OWNER_PERMISSIONS,
  SALESMAN_PERMISSIONS,
  business,
  managerMe,
} from '../../../../../test/fixtures/me';
import { json, mockApi, renderInBusiness } from '../../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../../test/utils';
import type { Customer } from '../types';
import { CustomerDetail } from './customer-detail';
import { CustomerForm } from './customer-form';
import { CustomersList } from './customers-list';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn(), push: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: nav.replace,
    push: nav.push,
    back: nav.back,
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/b/example-cement/customers',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => {
  nav.search = '';
  nav.replace.mockReset();
  nav.push.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const BID = 'b1';
const B = '/b/example-cement';
const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});
const salesmanMe = meWith(SALESMAN_PERMISSIONS);
const ownerMe = meWith(OWNER_PERMISSIONS);

function customer(overrides: Partial<Customer> = {}, withDue = true): Customer {
  const c: Customer = {
    id: 'cu1',
    code: 'C-00002',
    nameEn: 'Sample Store Two',
    nameBn: 'নমুনা স্টোর দুই',
    phone: '+8801000000002',
    address: null,
    area: 'Sample Area',
    openingBalance: '12500.00',
    currentBalance: '1250000.00',
    creditLimit: null,
    isActive: true,
    createdAt: '2026-11-17T08:38:04.236Z',
    updatedAt: '2026-11-17T08:38:04.236Z',
    ...overrides,
  };
  if (!withDue) {
    delete c.openingBalance;
    delete c.currentBalance;
    delete c.creditLimit;
  }
  return c;
}
const page = (items: Customer[], total = items.length) => ({ items, page: 1, pageSize: 10, total });

describe('<CustomersList>', () => {
  it('manager (customer.due.view): due with lakh grouping, "no limit", advance label', async () => {
    mockApi({
      [`GET ${B}/customers`]: () =>
        json(
          200,
          page([
            customer(),
            customer({
              id: 'cu2',
              nameEn: 'Advance Shop',
              nameBn: null,
              currentBalance: '-200.50',
              creditLimit: '50000.00',
            }),
          ]),
        ),
    });
    renderInBusiness(<CustomersList slug="example-cement" businessId={BID} />, { me: managerMe });
    expect(await screen.findByRole('columnheader', { name: 'Current due' })).toBeInTheDocument();
    const first = screen.getByRole('rowheader', { name: /Sample Store Two/ }).closest('tr')!;
    expect(first).toHaveTextContent('৳12,50,000.00');
    expect(first).toHaveTextContent('No limit');
    const advance = screen.getByRole('rowheader', { name: /Advance Shop/ }).closest('tr')!;
    expect(advance).toHaveTextContent('৳200.50');
    expect(advance).toHaveTextContent('Advance');
    expect(advance).not.toHaveTextContent('-৳');
    expect(advance).toHaveTextContent('৳50,000.00');
  });

  it('salesman (no customer.due.view): no due or credit-limit column, no amounts', async () => {
    mockApi({ [`GET ${B}/customers`]: () => json(200, page([customer({}, false)])) });
    const { container } = renderInBusiness(
      <CustomersList slug="example-cement" businessId={BID} />,
      { me: salesmanMe },
    );
    await screen.findByRole('rowheader', { name: /Sample Store Two/ });
    expect(screen.queryByRole('columnheader', { name: 'Current due' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Credit limit' })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('৳');
    // salesman has customer.manage: may add customers
    expect(screen.getByRole('link', { name: 'New customer' })).toBeInTheDocument();
  });

  it('search by name, phone or code goes to the API from the URL; paging', async () => {
    nav.search = 'search=01000000002&page=2';
    const { calls } = mockApi({
      [`GET ${B}/customers`]: () => json(200, { ...page([customer()], 12), page: 2 }),
    });
    renderInBusiness(<CustomersList slug="example-cement" businessId={BID} />, { me: managerMe });
    await screen.findByRole('rowheader', { name: /Sample Store Two/ });
    expect(calls[0]!.url).toBe('/api/v1/b/example-cement/customers?search=01000000002&page=2');
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('01000000002');
    expect(screen.getByRole('link', { name: 'Page 1' })).toHaveAttribute(
      'href',
      '/b/example-cement/customers?search=01000000002',
    );
  });

  it('is in Bengali and has no basic a11y violations', async () => {
    mockApi({
      [`GET ${B}/customers`]: () => json(200, page([customer({ currentBalance: '-1500.00' })])),
    });
    const { container } = renderInBusiness(
      <CustomersList slug="example-cement" businessId={BID} />,
      { me: managerMe, locale: 'bn' },
    );
    const row = (await screen.findByRole('rowheader', { name: /নমুনা স্টোর দুই/ })).closest('tr')!;
    expect(row).toHaveTextContent('৳১,৫০০.০০');
    expect(row).toHaveTextContent('অগ্রিম');
    await expectNoA11yViolations(container);
  });
});

describe('<CustomerForm> create', () => {
  const fill = async (phone: string) => {
    await userEvent.type(screen.getByLabelText('Name (English)'), 'Karim Store');
    await userEvent.type(screen.getByLabelText('Phone'), phone);
  };

  it('phone required and checked; duplicate phone (409) shown on the phone field', async () => {
    const { calls } = mockApi({
      [`POST ${B}/customers`]: () =>
        json(409, { message: 'A customer with this phone number already exists', statusCode: 409 }),
    });
    renderInBusiness(<CustomerForm slug="example-cement" businessId={BID} />, { me: managerMe });
    await userEvent.type(screen.getByLabelText('Name (English)'), 'Karim Store');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByLabelText('Phone')).toHaveAccessibleDescription(/This field is required/);
    await userEvent.type(screen.getByLabelText('Phone'), '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByLabelText('Phone')).toHaveAccessibleDescription(
      /Enter a valid phone number/,
    );
    expect(calls).toHaveLength(0);

    await userEvent.clear(screen.getByLabelText('Phone'));
    await userEvent.type(screen.getByLabelText('Phone'), '01000000002');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(
      await screen.findByText('A customer with this phone number already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toHaveAttribute('aria-invalid', 'true');
  });

  it('manager: opening due (negative = advance) and credit limit sent as strings', async () => {
    const { calls } = mockApi({
      [`POST ${B}/customers`]: () => json(201, customer({ id: 'cu9' })),
    });
    renderInBusiness(<CustomerForm slug="example-cement" businessId={BID} />, { me: managerMe });
    await fill('০১৭০০০০০০০০');
    await userEvent.type(screen.getByLabelText('Opening due'), '-200.50');
    expect(screen.getByText('Advance')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Credit limit'), '50,000');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(calls[0]!.body).toEqual({
      nameEn: 'Karim Store',
      phone: '০১৭০০০০০০০০',
      openingBalance: '-200.50',
      creditLimit: '50000',
    });
    expect(nav.push).toHaveBeenCalledWith('/b/example-cement/customers/cu9?saved=created');
  });

  it('salesman: only name, phone, address; no due fields shown or sent; one request on double click', async () => {
    let resolve: (r: Response) => void = () => {};
    const { calls } = mockApi({
      [`POST ${B}/customers`]: () => new Promise<Response>((r) => (resolve = r)),
    });
    renderInBusiness(<CustomerForm slug="example-cement" businessId={BID} />, { me: salesmanMe });
    expect(screen.queryByLabelText('Opening due')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Credit limit')).not.toBeInTheDocument();
    await fill('01700000000');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Create' }));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ nameEn: 'Karim Store', phone: '01700000000' });
    await act(async () => resolve(json(201, customer({}, false))));
  });
});

describe('<CustomerForm> edit', () => {
  it('manager (no customer.balance.edit): balances read-only; cleared area → null; same phone in another format not sent', async () => {
    const { calls } = mockApi({ [`PATCH ${B}/customers/cu1`]: () => json(200, customer()) });
    renderInBusiness(
      <CustomerForm slug="example-cement" businessId={BID} customer={customer()} />,
      { me: managerMe },
    );
    expect(screen.getByText('Changing these needs owner-level permission.')).toBeInTheDocument();
    expect(screen.getByLabelText('Opening due')).toHaveAttribute('readonly');
    await userEvent.clear(screen.getByLabelText('Phone'));
    await userEvent.type(screen.getByLabelText('Phone'), '01000000002');
    await userEvent.clear(screen.getByLabelText('Area'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(calls[0]!.body).toEqual({ area: null });
  });

  it('owner: changing opening due or removing the credit limit needs a reason', async () => {
    const { calls } = mockApi({ [`PATCH ${B}/customers/cu1`]: () => json(200, customer()) });
    renderInBusiness(
      <CustomerForm
        slug="example-cement"
        businessId={BID}
        customer={customer({ creditLimit: '50000.00' })}
      />,
      { me: ownerMe },
    );
    await userEvent.clear(screen.getByLabelText('Opening due'));
    await userEvent.type(screen.getByLabelText('Opening due'), '13000');
    await userEvent.clear(screen.getByLabelText('Credit limit'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByLabelText('Reason for the change')).toHaveAccessibleDescription(/Write why/);
    expect(calls).toHaveLength(0);
    await userEvent.type(
      screen.getByLabelText('Reason for the change'),
      'opening balance was mistyped',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(calls[0]!.body).toEqual({
      openingBalance: '13000',
      creditLimit: null,
      reason: 'opening balance was mistyped',
    });
  });
});

describe('<CustomerDetail>', () => {
  it('salesman: no due rows; manager without customer.deactivate: no deactivate button', async () => {
    mockApi({ [`GET ${B}/customers/cu1`]: () => json(200, customer({}, false)) });
    const { container, unmount } = renderInBusiness(
      <CustomerDetail slug="example-cement" businessId={BID} id="cu1" />,
      { me: salesmanMe },
    );
    await screen.findByRole('heading', { name: 'Sample Store Two' });
    expect(container).not.toHaveTextContent('Current due');
    expect(container).not.toHaveTextContent('Opening due');
    unmount();

    mockApi({
      [`GET ${B}/customers/cu1`]: () => json(200, customer({ openingBalance: '-500.00' })),
    });
    renderInBusiness(<CustomerDetail slug="example-cement" businessId={BID} id="cu1" />, {
      me: meWith(MANAGER_PERMISSIONS),
    });
    const opening = (await screen.findByText('Opening due')).nextSibling as HTMLElement;
    expect(opening).toHaveTextContent('৳500.00');
    expect(opening).toHaveTextContent('Advance');
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  it('owner deactivates with reason; only customers refreshed', async () => {
    const { calls } = mockApi({
      [`GET ${B}/customers/cu1`]: () => json(200, customer()),
      [`PATCH ${B}/customers/cu1`]: () => json(200, customer({ isActive: false })),
    });
    const { invalidate } = renderInBusiness(
      <CustomerDetail slug="example-cement" businessId={BID} id="cu1" />,
      { me: ownerMe },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Reason for the change'), 'shop closed');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Status saved.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      isActive: false,
      reason: 'shop closed',
    });
    expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      ['dealership', BID, 'customers'],
    ]);
  });
});

describe('row Details and Actions (customers)', () => {
  const routes = { [`GET ${B}/customers`]: () => json(200, page([customer()])) };

  it('salesman: Details link and an Actions menu with Edit only', async () => {
    mockApi(routes);
    renderInBusiness(<CustomersList slug="example-cement" businessId={BID} />, {
      me: salesmanMe,
    });
    expect(
      await screen.findByRole('link', { name: 'Details of Sample Store Two' }),
    ).toHaveAttribute('href', `${B}/customers/cu1`);
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Sample Store Two' }));
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `${B}/customers/cu1/edit`,
    );
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  it('no manage and no deactivate permission → no Actions menu', async () => {
    mockApi(routes);
    renderInBusiness(<CustomersList slug="example-cement" businessId={BID} />, {
      me: meWith(['customer.view']),
    });
    await screen.findByRole('link', { name: 'Details of Sample Store Two' });
    expect(
      screen.queryByRole('button', { name: 'Actions for Sample Store Two' }),
    ).not.toBeInTheDocument();
  });

  it('owner: deactivate from the menu sends the reason; Bengali; a11y', async () => {
    const { calls } = mockApi({
      ...routes,
      [`PATCH ${B}/customers/cu1`]: () => json(200, customer({ isActive: false })),
    });
    const { container, invalidate } = renderInBusiness(
      <CustomersList slug="example-cement" businessId={BID} />,
      { me: ownerMe, locale: 'bn' },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'নমুনা স্টোর দুই-এর কাজ' }));
    await userEvent.click(screen.getByRole('button', { name: 'নিষ্ক্রিয় করুন' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'shop closed');
    await userEvent.click(within(dialog).getByRole('button', { name: 'নিষ্ক্রিয় করুন' }));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      isActive: false,
      reason: 'shop closed',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dealership', BID, 'customers'] });
    await expectNoA11yViolations(container);
  });
});
