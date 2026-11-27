import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { managerMe, ownerMe } from '../../../../test/fixtures/me';
import { apiError, json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { CommissionView } from './commission-view';
import { EntryForm } from './entry-form';
import type { CommissionEntry, CommissionSummary } from './types';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: nav.replace,
    push: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/b/example-cement/commission',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => {
  nav.search = '';
  nav.replace.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const BID = 'b1';
const B = '/b/example-cement';

const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 10, total: items.length });

const entry = (o: Partial<CommissionEntry> = {}): CommissionEntry => ({
  id: 'e1',
  amount: '25000.00',
  receivedDate: '2024-01-25',
  note: 'Monthly target bonus',
  createdAt: '2024-01-25T10:00:00Z',
  ...o,
});

const summary = (o: Partial<CommissionSummary> = {}): CommissionSummary => ({
  year: 2026,
  totalReceived: '2100000.00',
  entryCount: 8,
  ...o,
});

const series = (months: { month: string; received: string }[] = []) => ({
  year: 2026,
  months,
  yearReceived: '2100000.00',
  lifetimeReceived: '2100000.00',
});

const form = (e: CommissionEntry | null = null, onSaved = vi.fn(), onClose = vi.fn()) => (
  <EntryForm entry={e} slug="example-cement" businessId={BID} onClose={onClose} onSaved={onSaved} />
);

describe('<CommissionView>', () => {
  it('shows the year total, the list with its reason, and no scheme or calculation', async () => {
    nav.search = 'page=2';
    const { calls } = mockApi({
      [`GET ${B}/commission-entries`]: () => json(200, page([entry()])),
      [`GET ${B}/commission-summary`]: () => json(200, summary()),
      [`GET ${B}/dashboard/commission-series`]: () => json(200, series()),
    });
    const { container } = renderInBusiness(
      <CommissionView slug="example-cement" businessId={BID} />,
      { me: ownerMe },
    );
    expect(await screen.findByText('৳21,00,000.00')).toBeInTheDocument();
    expect(screen.getByText('8 entries')).toBeInTheDocument();
    expect(screen.getByText('Monthly target bonus')).toBeInTheDocument();
    expect(screen.getByText('৳25,000.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add commission' })).toBeInTheDocument();
    expect(screen.queryByText(/scheme|target quantity|bonus rate|pending/i)).toBeNull();
    expect(calls.find((c) => c.path === `${B}/commission-entries`)!.url).toContain('page=2');
    expect(calls.some((c) => c.path.includes('commission-scheme'))).toBe(false);
    await expectNoA11yViolations(container);
  });

  it('shows a yearly and a monthly card; the month dropdown reads that month from the series', async () => {
    nav.search = 'year=2025&month=3';
    const { calls } = mockApi({
      [`GET ${B}/commission-entries`]: () => json(200, page([entry()])),
      [`GET ${B}/commission-summary`]: () => json(200, summary({ year: 2025 })),
      [`GET ${B}/dashboard/commission-series`]: () =>
        json(200, series([{ month: '2025-03', received: '350000.00' }])),
    });
    const { container } = renderInBusiness(
      <CommissionView slug="example-cement" businessId={BID} />,
      { me: ownerMe },
    );
    expect(await screen.findByText('Total Yearly Commission')).toBeInTheDocument();
    expect(screen.getByText('Total Monthly Commission')).toBeInTheDocument();
    expect(await screen.findByText('৳3,50,000.00')).toBeInTheDocument();
    expect(screen.getByLabelText('Choose year')).toHaveValue('2025');
    expect(screen.getByLabelText('Choose month')).toHaveValue('3');
    expect(calls.find((c) => c.path === `${B}/dashboard/commission-series`)!.url).toContain(
      'year=2025',
    );
    await expectNoA11yViolations(container);
  });

  it('a month with no entries shows zero; choosing a month or year updates the URL', async () => {
    nav.search = 'year=2025&month=3';
    mockApi({
      [`GET ${B}/commission-entries`]: () => json(200, page([entry()])),
      [`GET ${B}/commission-summary`]: () => json(200, summary({ year: 2025 })),
      [`GET ${B}/dashboard/commission-series`]: () => json(200, series()),
    });
    renderInBusiness(<CommissionView slug="example-cement" businessId={BID} />, { me: ownerMe });
    expect(await screen.findByText('৳0.00')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Choose month'), '5');
    expect(nav.replace).toHaveBeenLastCalledWith('/b/example-cement/commission?year=2025&month=5', {
      scroll: false,
    });
    await userEvent.selectOptions(screen.getByLabelText('Choose year'), '2024');
    expect(nav.replace).toHaveBeenLastCalledWith('/b/example-cement/commission?year=2024&month=3', {
      scroll: false,
    });
  });

  it('no entries yet: empty state', async () => {
    mockApi({
      [`GET ${B}/commission-entries`]: () => json(200, page([])),
      [`GET ${B}/commission-summary`]: () => json(200, summary({ totalReceived: '0.00' })),
      [`GET ${B}/dashboard/commission-series`]: () => json(200, series()),
    });
    renderInBusiness(<CommissionView slug="example-cement" businessId={BID} />, { me: ownerMe });
    expect(await screen.findByText('No commission recorded yet')).toBeInTheDocument();
  });

  it('without commission.manage the list is read-only: no Add or Edit buttons', async () => {
    mockApi({
      [`GET ${B}/commission-entries`]: () => json(200, page([entry()])),
      [`GET ${B}/commission-summary`]: () => json(200, summary()),
      [`GET ${B}/dashboard/commission-series`]: () => json(200, series()),
    });
    renderInBusiness(<CommissionView slug="example-cement" businessId={BID} />, {
      me: {
        ...managerMe,
        businesses: managerMe.businesses.map((b) => ({
          ...b,
          permissions: ['commission.view'],
        })),
      },
    });
    expect(await screen.findByText('Monthly target bonus')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add commission' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit commission of/ })).toBeNull();
  });
});

describe('<EntryForm>', () => {
  it('creates with amount, date and reason; sends the idempotency key; refreshes the right keys', async () => {
    const onSaved = vi.fn();
    const { calls } = mockApi({
      [`POST ${B}/commission-entries`]: () => json(201, entry({ amount: '25000.50' })),
    });
    const view = renderInBusiness(form(null, onSaved), { me: ownerMe });
    await userEvent.type(screen.getByLabelText(/Amount received/), '25,000.50');
    fireEvent.change(screen.getByLabelText(/Date received/), { target: { value: '2024-01-25' } });
    await userEvent.type(screen.getByLabelText(/Reason/), '  Festival bonus ');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await vi.waitFor(() => onSaved.mock.calls.length > 0 && onSaved.mock.calls[0])).toEqual([
      'Created.',
    ]);
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toEqual({
      amount: '25000.50',
      receivedDate: '2024-01-25',
      note: 'Festival bonus',
    });
    expect(post.headers.get('idempotency-key')).toBeTruthy();
    const keys = view.invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey));
    expect(keys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['dealership', BID, 'commissionEntries']),
        JSON.stringify(['dealership', BID, 'commissionSummary']),
        JSON.stringify(['dealership', BID, 'dashboardFinance']),
        JSON.stringify(['dealership', BID, 'dashboardCommission']),
      ]),
    );
  });

  it('refuses a missing reason, a zero amount and a future date without calling the API', async () => {
    const { calls } = mockApi({});
    renderInBusiness(form(), { me: ownerMe });
    await userEvent.type(screen.getByLabelText(/Amount received/), '0');
    fireEvent.change(screen.getByLabelText(/Date received/), { target: { value: '2999-01-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Write the reason for this commission.')).toBeInTheDocument();
    expect(screen.getByText(/Enter an amount above zero/)).toBeInTheDocument();
    expect(screen.getByText('The date cannot be in the future.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('edit sends only the changed field; nothing changed → says so', async () => {
    const onSaved = vi.fn();
    const { calls } = mockApi({
      [`PATCH ${B}/commission-entries/e1`]: () => json(200, entry({ amount: '30000.00' })),
    });
    renderInBusiness(form(entry(), onSaved), { me: ownerMe });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Nothing has changed.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    const amount = screen.getByLabelText(/Amount received/);
    await userEvent.clear(amount);
    await userEvent.type(amount, '30000');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ amount: '30000' });
  });

  it('maps a server field error under the field and keeps what was typed', async () => {
    mockApi({
      [`POST ${B}/commission-entries`]: () => apiError(400, 'AMOUNT_TOO_SMALL', 'amount'),
    });
    renderInBusiness(form(), { me: ownerMe });
    await userEvent.type(screen.getByLabelText(/Amount received/), '5');
    await userEvent.type(screen.getByLabelText(/Reason/), 'Bonus');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason/)).toHaveValue('Bonus');
  });
});
