import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/core/auth/types';
import {
  MANAGER_PERMISSIONS,
  OWNER_PERMISSIONS,
  business,
  managerMe,
} from '../../../test/fixtures/me';
import { apiError, json, mockApi, renderInBusiness } from '../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../test/utils';
import { RequestChangeButton, type RequestTarget } from './request-dialog';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/b/example-cement/products/p1',
  useSearchParams: () => new URLSearchParams(),
}));
afterEach(() => vi.unstubAllGlobals());

const BASE = '/b/example-cement/change-requests';
const staffMe: Me = {
  ...managerMe,
  businesses: [
    business({ permissions: [...MANAGER_PERMISSIONS, 'change.request', 'change.view.own'] }),
  ],
};
const target: RequestTarget = {
  entityType: 'product',
  entityId: 'p1',
  name: 'Sample OPC 50kg',
  fields: [{ key: 'purchasePrice', type: 'money', current: '540.00' }],
  status: { currentlyActive: true },
};
const preview = {
  entityLabel: 'P-0001 Sample OPC 50kg',
  impact: [
    { key: 'product.purchasePrice', label: 'Purchase price', before: '540.00', after: '545.00' },
  ],
};

function setup(me: Me = staffMe, routes = {}, locale: 'en' | 'bn' = 'en') {
  const onSent = vi.fn();
  const api = mockApi({ [`POST ${BASE}/preview`]: () => json(200, preview), ...routes });
  const view = renderInBusiness(
    <RequestChangeButton slug="example-cement" target={target} onSent={onSent} />,
    { me, locale },
  );
  return { ...api, ...view, onSent };
}

async function fillAndReview(price = '545') {
  await userEvent.click(screen.getByRole('button', { name: 'Request a correction' }));
  const dialog = screen.getByRole('dialog', { name: 'Request a correction: Sample OPC 50kg' });
  await userEvent.click(within(dialog).getByLabelText(/Change Purchase price/));
  await userEvent.clear(within(dialog).getByLabelText('New Purchase price'));
  await userEvent.type(within(dialog).getByLabelText('New Purchase price'), price);
  await userEvent.type(within(dialog).getByLabelText('Reason for the request'), 'Supplier rate');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Review' }));
  return dialog;
}

describe('<RequestChangeButton> / dialog', () => {
  it('review shows the effect (preview), then send with one Idempotency-Key; double click sends once', async () => {
    let resolve: (r: Response) => void = () => {};
    const { calls, onSent, container } = setup(staffMe, {
      [`POST ${BASE}`]: () => new Promise<Response>((r) => (resolve = r)),
    });
    const dialog = await fillAndReview();
    expect(await within(dialog).findByText('Effect if approved')).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith('/preview'))!.body).toEqual({
      entityType: 'product',
      entityId: 'p1',
      kind: 'edit',
      proposedChange: { purchasePrice: '545' },
    });
    await expectNoA11yViolations(container);

    await userEvent.dblClick(within(dialog).getByRole('button', { name: 'Send request' }));
    const sends = calls.filter((c) => c.method === 'POST' && c.path === BASE);
    expect(sends).toHaveLength(1);
    expect(sends[0]!.body).toEqual({
      entityType: 'product',
      entityId: 'p1',
      kind: 'edit',
      reason: 'Supplier rate',
      proposedChange: { purchasePrice: '545' },
    });
    expect(sends[0]!.headers.get('Idempotency-Key')).toMatch(/^[\w-]{8,64}$/);
    await act(async () => resolve(json(201, { id: 'cr1' })));
    expect(onSent).toHaveBeenCalledWith(
      'Request sent. It takes effect when the owner approves it.',
    );
  });

  it('changing a value after review asks for a new review; nothing chosen → message', async () => {
    const { calls } = setup();
    const dialog = await fillAndReview();
    await within(dialog).findByText('Effect if approved');
    await userEvent.type(within(dialog).getByLabelText('New Purchase price'), '0');
    expect(within(dialog).queryByRole('button', { name: 'Send request' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Review the effect before sending.')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByLabelText(/Change Purchase price/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Review' }));
    expect(within(dialog).getByText('Choose at least one change.')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.endsWith('/preview'))).toHaveLength(1);
  });

  it('a failed send keeps values and reason; the retry reuses the same key', async () => {
    let fail = true;
    const { calls, onSent } = setup(staffMe, {
      [`POST ${BASE}`]: () =>
        fail ? apiError(503, 'SERVICE_UNAVAILABLE') : json(201, { id: 'x' }),
    });
    const dialog = await fillAndReview();
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Send request' }));
    expect(
      await within(dialog).findByText('The server is not available right now. Try again soon.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('New Purchase price')).toHaveValue('545');
    expect(within(dialog).getByLabelText('Reason for the request')).toHaveValue('Supplier rate');
    fail = false;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));
    await vi.waitFor(() => expect(onSent).toHaveBeenCalled());
    const keys = calls
      .filter((c) => c.method === 'POST' && c.path === BASE)
      .map((c) => c.headers.get('Idempotency-Key'));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('409 pending exists (staff): links to their own pending request', async () => {
    setup(staffMe, {
      [`POST ${BASE}`]: () => apiError(409, 'CHANGE_REQUEST_PENDING_EXISTS'),
      [`GET ${BASE}/mine`]: () =>
        json(200, { items: [{ id: 'cr9', entityId: 'p1' }], page: 1, pageSize: 10, total: 1 }),
    });
    const dialog = await fillAndReview();
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Send request' }));
    expect(
      await within(dialog).findByRole('link', { name: 'See the pending request' }),
    ).toHaveAttribute('href', '/b/example-cement/approvals/cr9');
    expect(
      within(dialog).getByText('This record already has a pending request.'),
    ).toBeInTheDocument();
  });

  it('409 pending exists with change.view.all: link to the filtered inbox', async () => {
    const viewer: Me = {
      ...managerMe,
      businesses: [
        business({ permissions: [...MANAGER_PERMISSIONS, 'change.request', 'change.view.all'] }),
      ],
    };
    setup(viewer, { [`POST ${BASE}`]: () => apiError(409, 'CHANGE_REQUEST_PENDING_EXISTS') });
    const dialog = await fillAndReview();
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Send request' }));
    expect(
      await within(dialog).findByRole('link', { name: 'See pending requests for this record' }),
    ).toHaveAttribute('href', '/b/example-cement/approvals/all?entityId=p1&status=pending');
  });

  it('server field error under its field; status request; Bengali', async () => {
    setup(
      staffMe,
      {
        [`POST ${BASE}/preview`]: () =>
          apiError(400, 'PURCHASE_PRICE_INVALID', 'proposedChange.purchasePrice'),
      },
      'bn',
    );
    await userEvent.click(screen.getByRole('button', { name: 'সংশোধনের অনুরোধ' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('নিষ্ক্রিয় করার অনুরোধ')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByLabelText(/কেনা-দাম বদলান/));
    await userEvent.clear(within(dialog).getByLabelText('নতুন কেনা-দাম'));
    await userEvent.type(within(dialog).getByLabelText('নতুন কেনা-দাম'), '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'পর্যালোচনা' }));
    await vi.waitFor(() =>
      expect(within(dialog).getByLabelText('নতুন কেনা-দাম')).toHaveAccessibleDescription(
        'কেনা-দাম লিখুন যেমন 570 বা 570.50।',
      ),
    );
  });

  it('owner-like users get no button when the module passes no target (nothing to render here)', () => {
    mockApi({});
    const { container } = renderInBusiness(
      <RequestChangeButton
        slug="example-cement"
        target={{ ...target, fields: [], status: undefined }}
        onSent={() => {}}
      />,
      { me: { ...managerMe, businesses: [business({ permissions: OWNER_PERMISSIONS })] } },
    );
    expect(container).toBeEmptyDOMElement();
  });
});
