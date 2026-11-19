import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/core/auth/types';
import {
  MANAGER_PERMISSIONS,
  OWNER_PERMISSIONS,
  business,
  managerMe,
  ownerMe,
} from '../../../test/fixtures/me';
import { apiError, json, mockApi, renderInBusiness } from '../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../test/utils';
import { ChangeEntitiesProvider } from './context';
import { ApprovalDetail, noteError } from './detail';
import { ApprovalsList } from './list';
import type { ChangeRequest } from './types';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/b/example-cement/approvals/all',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => {
  nav.search = '';
  nav.replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const BASE = '/b/example-cement/change-requests';
const ENTITIES = {
  product: { path: 'products/:id', invalidate: ['products'] },
  customer: { path: 'customers/:id', invalidate: ['customers'] },
  product_category: { path: 'products/categories/:id', invalidate: ['categories', 'products'] },
  purchase: { path: 'purchases/:id', invalidate: ['purchases', 'stock', 'products'] },
  product_stock: { path: 'stock/:id', invalidate: ['stock'] },
};
const staffMe: Me = {
  ...managerMe,
  businesses: [
    business({ permissions: [...MANAGER_PERMISSIONS, 'change.request', 'change.view.own'] }),
  ],
};
const owner: Me = { ...ownerMe, businesses: [business({ permissions: OWNER_PERMISSIONS })] };

const render = (ui: ReactElement, me: Me, locale: 'en' | 'bn' = 'en') =>
  renderInBusiness(<ChangeEntitiesProvider entities={ENTITIES}>{ui}</ChangeEntitiesProvider>, {
    me,
    locale,
  });

function request(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: 'cr1',
    entityType: 'customer',
    entityId: 'cu1',
    entityLabel: 'C-00002 Sample Store Two',
    kind: 'edit',
    summary: 'Active: true → false; Credit limit: 50000.00 → 60000.00',
    status: 'pending',
    requestedBy: { id: managerMe.user.id, name: 'Rahim Uddin' },
    requestedAt: '2026-11-18T06:38:56.479Z',
    decidedBy: null,
    decidedAt: null,
    reason: 'Supplier changed the rate',
    snapshot: { isActive: true, creditLimit: '50000.00' },
    proposedChange: { isActive: false, creditLimit: '60000.00' },
    impact: [
      {
        key: 'customer.isActive',
        label: 'Active',
        before: true,
        after: false,
        note: 'While inactive it cannot be chosen for new entries; existing records stay.',
      },
      { key: 'customer.creditLimit', label: 'Credit limit', before: '50000.00', after: '60000.00' },
    ],
    isStale: false,
    decisionNote: null,
    appliedAt: null,
    ...overrides,
  };
}
const page = (items: ChangeRequest[]) => ({ items, page: 1, pageSize: 10, total: items.length });

describe('<ApprovalsList>', () => {
  it('owner inbox: who, what (label + summary), when, status; reason only on the detail page', async () => {
    const { calls, container } = (() => {
      const api = mockApi({ [`GET ${BASE}`]: () => json(200, page([request()])) });
      return { ...api, ...render(<ApprovalsList slug="example-cement" scope="all" />, owner) };
    })();
    const row = (
      await screen.findByRole('rowheader', { name: /C-00002 Sample Store Two/ })
    ).closest('tr')!;
    expect(row).toHaveTextContent('Customer · C-00002 Sample Store Two');
    expect(row).toHaveTextContent('Credit limit: 50000.00 → 60000.00');
    expect(row).toHaveTextContent('Rahim Uddin');
    expect(row).toHaveTextContent('Pending');
    expect(container).not.toHaveTextContent('Supplier changed the rate');
    expect(
      within(row).getByRole('link', {
        name: 'Details of the request for C-00002 Sample Store Two',
      }),
    ).toHaveAttribute('href', '/b/example-cement/approvals/cr1');
    expect(calls[0]!.url).toBe('/api/v1/b/example-cement/change-requests?page=1');
    await expectNoA11yViolations(container);
  });

  it('filters come from and go to the URL; mine has only the status filter', async () => {
    nav.search = 'status=pending&entityType=customer&entityId=cu1&page=2';
    const { calls } = mockApi({ [`GET ${BASE}`]: () => json(200, page([request()])) });
    render(<ApprovalsList slug="example-cement" scope="all" />, owner);
    expect(
      await screen.findByText('Only requests for: C-00002 Sample Store Two'),
    ).toBeInTheDocument();
    expect(calls[0]!.url).toBe(
      '/api/v1/b/example-cement/change-requests?status=pending&entityType=customer&entityId=cu1&page=2',
    );
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'approved');
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/b/example-cement/approvals/all?status=approved&entityType=customer&entityId=cu1',
      { scroll: false },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show all records' }));
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/b/example-cement/approvals/all?status=pending&entityType=customer',
      { scroll: false },
    );
  });

  it('mine: own endpoint, no type filter; empty vs no results (Bengali)', async () => {
    const { calls } = mockApi({ [`GET ${BASE}/mine`]: () => json(200, page([])) });
    const { unmount } = render(<ApprovalsList slug="example-cement" scope="mine" />, staffMe, 'bn');
    expect(await screen.findByText('কোনো অনুরোধ নেই')).toBeInTheDocument();
    expect(screen.queryByLabelText('রেকর্ডের ধরন')).not.toBeInTheDocument();
    expect(calls[0]!.url).toBe('/api/v1/b/example-cement/change-requests/mine?page=1');
    unmount();
    nav.search = 'status=rejected';
    render(<ApprovalsList slug="example-cement" scope="mine" />, staffMe, 'bn');
    expect(await screen.findByText('কিছু মেলেনি')).toBeInTheDocument();
  });

  it('error with retry; 403 shows the permission message without retry', async () => {
    let status = 503;
    mockApi({
      [`GET ${BASE}`]: () =>
        apiError(status, status === 403 ? 'ACCESS_DENIED' : 'SERVICE_UNAVAILABLE'),
    });
    const { unmount } = render(<ApprovalsList slug="example-cement" scope="all" />, owner);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    unmount();
    status = 403;
    render(<ApprovalsList slug="example-cement" scope="all" />, owner);
    expect(await screen.findByText('You do not have permission for this.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});

describe('<ApprovalDetail>', () => {
  const detail = (r: ChangeRequest) => ({ [`GET ${BASE}/cr1`]: () => json(200, r) });

  it('shows values, reason, translated impact; owner approves (note optional), only the request + products refresh', async () => {
    const { calls } = mockApi({
      ...detail(request()),
      [`POST ${BASE}/cr1/approve`]: () => json(200, request({ status: 'approved', impact: null })),
    });
    const { invalidate, container } = render(
      <ApprovalDetail slug="example-cement" id="cr1" />,
      owner,
    );
    expect(
      await screen.findByRole('heading', { name: 'C-00002 Sample Store Two' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Supplier changed the rate')).toBeInTheDocument();
    const values = screen.getByRole('rowheader', { name: 'Credit limit' }).closest('tr')!;
    expect(values).toHaveTextContent('৳50,000.00');
    expect(values).toHaveTextContent('৳60,000.00');
    expect(screen.getByText('Customer status')).toBeInTheDocument();
    expect(
      screen.getByText(
        'While inactive it cannot be chosen for new entries; existing records stay.',
      ),
    ).toBeInTheDocument();
    // Proposed values are not editable.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = screen.getByRole('dialog', { name: 'Approve this request?' });
    await userEvent.dblClick(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Approved; the change is now in effect.')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({});
    const keys = invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey));
    expect(keys).toEqual([
      JSON.stringify(['dealership', 'b1', 'change-requests']),
      JSON.stringify(['dealership', 'b1', 'customers']),
    ]);
  });

  it('reject needs a 3–500 character note; nothing is sent without it; record not refreshed', async () => {
    const { calls } = mockApi({
      ...detail(request()),
      [`POST ${BASE}/cr1/reject`]: () => json(200, request({ status: 'rejected', impact: null })),
    });
    const { invalidate } = render(<ApprovalDetail slug="example-cement" id="cr1" />, owner);
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = screen.getByRole('dialog', { name: 'Reject this request?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(within(dialog).getByLabelText('Note')).toHaveAccessibleDescription(
      /Write why it is rejected/,
    );
    await userEvent.type(within(dialog).getByLabelText('Note'), 'ok');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.type(within(dialog).getByLabelText('Note'), ' — new rate starts next month');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('Rejected; the record was not changed.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      note: 'ok — new rate starts next month',
    });
    const keys = invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey));
    expect(keys).toEqual([JSON.stringify(['dealership', 'b1', 'change-requests'])]);
  });

  it('own request: no approve or reject, even for an owner; withdraw instead', async () => {
    const mine = request({ requestedBy: { id: ownerMe.user.id, name: 'Jesan Owner' } });
    const { calls } = mockApi({
      ...detail(mine),
      [`POST ${BASE}/cr1/cancel`]: () => json(200, { ...mine, status: 'cancelled' }),
    });
    render(<ApprovalDetail slug="example-cement" id="cr1" />, owner);
    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw request' }));
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    expect(
      screen.getByText('This is your own request; someone else must approve or reject it.'),
    ).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'Withdraw your request?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Withdraw request' }));
    expect(await screen.findByText('Your request was withdrawn.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')!.url).toContain('/cr1/cancel');
  });

  it('staff without change.approve: no decision buttons on someone else’s request', async () => {
    mockApi(detail(request({ requestedBy: { id: 'u77', name: 'Other' } })));
    render(<ApprovalDetail slug="example-cement" id="cr1" />, staffMe);
    await screen.findByRole('heading', { name: 'C-00002 Sample Store Two' });
    expect(
      screen.queryByRole('button', { name: /Approve|Reject|Withdraw/ }),
    ).not.toBeInTheDocument();
  });

  it('stale: clear message, link to the record, no approve; a 409 on approve shows the same', async () => {
    mockApi(detail(request({ requestedBy: { id: 'u77', name: 'Other' }, isStale: true })));
    const { unmount } = render(<ApprovalDetail slug="example-cement" id="cr1" />, owner);
    expect(await screen.findByText('This request is out of date')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the record to request again' })).toHaveAttribute(
      'href',
      '/b/example-cement/customers/cu1',
    );
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    unmount();

    let stale = false;
    mockApi({
      [`GET ${BASE}/cr1`]: () =>
        json(
          200,
          request({
            requestedBy: { id: 'u77', name: 'Other' },
            isStale: stale,
            ...(stale ? { status: 'stale' } : {}),
          }),
        ),
      [`POST ${BASE}/cr1/approve`]: () => ((stale = true), apiError(409, 'STALE_REQUEST')),
    });
    render(<ApprovalDetail slug="example-cement" id="cr1" />, owner);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    const dialog = screen.getByRole('dialog', { name: 'Approve this request?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(
      await screen.findByText(
        'The record changed after this request was made; the request is now out of date.',
      ),
    ).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(within(dialog).getByRole('button', { name: 'Not now' }));
    });
    expect(await screen.findByText('This request is out of date')).toBeInTheDocument();
  });

  it('hidden fields stay hidden: only what the API sends; 404 → not found (Bengali)', async () => {
    mockApi(
      detail(
        request({
          summary: 'Credit limit changed',
          snapshot: { isActive: true },
          proposedChange: { isActive: false },
          impact: [{ key: 'customer.isActive', label: 'Active', before: true, after: false }],
        }),
      ),
    );
    const { container, unmount } = render(
      <ApprovalDetail slug="example-cement" id="cr1" />,
      staffMe,
      'bn',
    );
    expect(await screen.findByRole('rowheader', { name: 'অবস্থা' })).toBeInTheDocument();
    expect(container).not.toHaveTextContent('ঋণসীমা');
    expect(container).not.toHaveTextContent('৳');
    unmount();
    mockApi({ [`GET ${BASE}/cr1`]: () => apiError(404, 'CHANGE_REQUEST_NOT_FOUND') });
    render(<ApprovalDetail slug="example-cement" id="cr1" />, staffMe, 'bn');
    expect(await screen.findByRole('heading', { name: 'অনুরোধ পাওয়া যায়নি' })).toBeInTheDocument();
  });

  it('note rules', () => {
    expect(noteError('reject', '  ab ')).toBe('required');
    expect(noteError('reject', 'abc')).toBeNull();
    expect(noteError('approve', '')).toBeNull();
    expect(noteError('approve', 'x'.repeat(501))).toBe('tooLong');
  });
});

describe('purchase and stock requests in the inbox', () => {
  it('bags read as quantities, the date as a date; impact labels by key prefix; link to the purchase', async () => {
    const pr = request({
      entityType: 'purchase',
      entityId: 'pu1',
      entityLabel: 'PUR-0001',
      requestedBy: { id: 'u77', name: 'Other' },
      summary: 'Bags changed',
      snapshot: { 'items.01a1efa4-6b16.quantity': '500', purchaseDate: '2026-11-18' },
      proposedChange: { 'items.01a1efa4-6b16.quantity': '490', purchaseDate: '2026-11-17' },
      impact: [
        {
          key: 'stock.p1',
          label: 'Stock P-0001',
          before: '497',
          after: '487',
          delta: '-10',
          unit: 'bag',
        },
        {
          key: 'purchase.totalAmount',
          label: 'Purchase total',
          before: '394100.00',
          after: '388400.00',
          delta: '-5700.00',
        },
        { key: 'purchaseCounter.2026-11', label: 'Quantity bought in 2026-11', delta: '-10' },
      ],
    });
    mockApi({ [`GET ${BASE}/cr1`]: () => json(200, pr) });
    render(<ApprovalDetail slug="example-cement" id="cr1" />, owner);
    const qty = (await screen.findByRole('rowheader', { name: 'Line quantity · …6b16' })).closest(
      'tr',
    )!;
    expect(qty).toHaveTextContent('500');
    expect(qty).toHaveTextContent('490');
    expect(qty).not.toHaveTextContent('৳');
    expect(
      screen.getByRole('rowheader', { name: 'Purchase date' }).closest('tr'),
    ).toHaveTextContent('17 Nov 2026');
    const stock = screen.getByText('Stock P-0001').closest('li')!;
    expect(stock).toHaveTextContent('497 → 487');
    expect(stock).not.toHaveTextContent('৳');
    expect(screen.getByText('Purchase total').closest('li')).toHaveTextContent('৳3,94,100.00');
    expect(screen.getByText('Quantity bought in 2026-11').closest('li')).toHaveTextContent('(-10)');
    expect(screen.getByRole('link', { name: 'Open the record' })).toHaveAttribute(
      'href',
      '/b/example-cement/purchases/pu1',
    );
  });

  it('a void request on a purchase; approval refreshes purchases, stock and products', async () => {
    const pr = request({
      entityType: 'purchase',
      entityId: 'pu1',
      entityLabel: 'PUR-0001',
      kind: 'void',
      requestedBy: { id: 'u77', name: 'Other' },
      snapshot: null,
      proposedChange: null,
      impact: [],
    });
    mockApi({
      [`GET ${BASE}/cr1`]: () => json(200, pr),
      [`POST ${BASE}/cr1/approve`]: () => json(200, { ...pr, status: 'approved', impact: null }),
    });
    const { invalidate } = render(<ApprovalDetail slug="example-cement" id="cr1" />, owner);
    expect(await screen.findByText('Asks to void this record.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }),
    );
    expect(await screen.findByText('Approved; the change is now in effect.')).toBeInTheDocument();
    expect(invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))).toEqual([
      JSON.stringify(['dealership', 'b1', 'change-requests']),
      JSON.stringify(['dealership', 'b1', 'purchases']),
      JSON.stringify(['dealership', 'b1', 'stock']),
      JSON.stringify(['dealership', 'b1', 'products']),
    ]);
  });
});
