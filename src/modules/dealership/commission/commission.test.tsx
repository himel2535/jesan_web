import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ownerMe } from '../../../../test/fixtures/me';
import { apiError, json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { CommissionView } from './commission-view';
import { EntryDetail } from './entry-detail';
import { EntryForm } from './entry-form';
import type {
  CommissionEntryDetail,
  CommissionScheme,
  CommissionSummary,
  SuggestionResponse,
} from './types';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn(), push: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: nav.replace,
    push: nav.push,
    back: nav.back,
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/b/example-cement/commission',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => {
  nav.search = '';
  nav.replace.mockReset();
  nav.push.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const BID = 'b1';
const B = '/b/example-cement';

const units = () =>
  json(200, {
    defaultUnitKey: 'bag',
    items: [{ key: 'bag', nameEn: 'Bag', nameBn: 'বস্তা', decimals: 0 }],
  });

const scheme = (o: Partial<CommissionScheme> = {}): CommissionScheme => ({
  rateBase: '10.00',
  targetQty: '10',
  bonusRate: '1.00',
  updatedAt: '2024-01-01T10:00:00Z',
  ...o,
});

const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 10, total: items.length });

const entry = (o: Partial<CommissionEntryDetail> = {}): CommissionEntryDetail => ({
  id: 'e1',
  fromDate: '2024-01-01',
  toDate: '2024-01-31',
  quantity: '38500',
  calculatedAmount: '389500.00',
  receivedAmount: '350000.00',
  pendingAmount: '39500.00',
  note: null,
  createdAt: '2024-01-20T10:00:00Z',
  receipts: [],
  ...o,
});

const summary = (o: Partial<CommissionSummary> = {}): CommissionSummary => ({
  year: 2026,
  totalCalculated: '2500000.00',
  totalReceived: '2100000.00',
  totalPending: '400000.00',
  entryCount: 12,
  receiptCount: 8,
  ...o,
});

const suggestion = (o: Partial<SuggestionResponse> = {}): SuggestionResponse => ({
  from: '2024-01-01',
  to: '2024-01-31',
  quantity: '40200',
  ...o,
});

const baseRoutes = {
  [`GET ${B}/product-units`]: units,
};

describe('<CommissionView>: scheme card', () => {
  it('no scheme yet: prompt to set one; owner can open the form and save it', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      [`GET ${B}/commission-scheme`]: () => json(200, { scheme: null }),
      [`GET ${B}/commission-entries`]: () => json(200, page([])),
      [`GET ${B}/commission-summary`]: () => json(200, summary()),
      [`PUT ${B}/commission-scheme`]: () => json(200, scheme()),
    });
    const { invalidate } = renderInBusiness(
      <CommissionView slug="example-cement" businessId={BID} />,
      { me: ownerMe },
    );
    expect(await screen.findByText('No scheme has been set yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Set the scheme' }));
    const dialog = screen.getByRole('dialog', { name: 'Set the commission scheme' });
    await userEvent.type(within(dialog).getByLabelText('Base rate (BDT/Bag)'), '10');
    await userEvent.type(within(dialog).getByLabelText('Target quantity (Bag)'), '10');
    await userEvent.type(within(dialog).getByLabelText('Bonus rate (BDT/Bag, above target)'), '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({
      rateBase: '10',
      targetQty: '10',
      bonusRate: '1',
    });
    const keys = invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey));
    expect(keys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['dealership', BID, 'commissionScheme']),
        JSON.stringify(['dealership', BID, 'commissionSummary']),
      ]),
    );
  });

  it('shows the current scheme lines', async () => {
    mockApi({
      ...baseRoutes,
      [`GET ${B}/commission-scheme`]: () => json(200, { scheme: scheme() }),
      [`GET ${B}/commission-entries`]: () => json(200, page([])),
      [`GET ${B}/commission-summary`]: () => json(200, summary()),
    });
    const { container } = renderInBusiness(
      <CommissionView slug="example-cement" businessId={BID} />,
      { me: ownerMe },
    );
    expect(await screen.findByText('Base rate: ৳10.00/Bag')).toBeInTheDocument();
    expect(screen.getByText('Target: 10 Bag')).toBeInTheDocument();
    expect(screen.getByText('Bonus: ৳1.00/Bag (above target)')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe('<CommissionView>: yearly summary and entries list', () => {
  it('summary tiles; entries list with page from the URL; New entry button', async () => {
    nav.search = 'page=2';
    const { calls } = mockApi({
      ...baseRoutes,
      [`GET ${B}/commission-scheme`]: () => json(200, { scheme: scheme() }),
      [`GET ${B}/commission-entries`]: () => json(200, page([entry()])),
      [`GET ${B}/commission-summary`]: () => json(200, summary()),
    });
    renderInBusiness(<CommissionView slug="example-cement" businessId={BID} />, { me: ownerMe });
    expect(await screen.findByText('৳25,00,000.00')).toBeInTheDocument();
    expect(screen.getByText('12 entries')).toBeInTheDocument();
    expect(screen.getByText('৳21,00,000.00')).toBeInTheDocument();
    expect(screen.getByText('৳4,00,000.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /1 Jan 2024/ })).toBeInTheDocument();
    expect(screen.getByText('38,500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New entry' })).toBeInTheDocument();
    const entriesCall = calls.find((c) => c.path === `${B}/commission-entries`)!;
    expect(entriesCall.url).toContain('page=2');
  });

  it('no entries yet: empty state', async () => {
    mockApi({
      ...baseRoutes,
      [`GET ${B}/commission-scheme`]: () => json(200, { scheme: scheme() }),
      [`GET ${B}/commission-entries`]: () => json(200, page([])),
      [`GET ${B}/commission-summary`]: () => json(200, summary()),
    });
    renderInBusiness(<CommissionView slug="example-cement" businessId={BID} />, { me: ownerMe });
    expect(await screen.findByText('No entries yet')).toBeInTheDocument();
  });
});

describe('<EntryForm>: suggestion and live preview', () => {
  it('both dates filled → suggestion loads; "Use this" fills the quantity field', async () => {
    mockApi({
      ...baseRoutes,
      [`GET ${B}/commission-entries/suggestion`]: () => json(200, suggestion()),
    });
    renderInBusiness(
      <EntryForm
        entry={null}
        scheme={scheme()}
        unitName="Bag"
        slug="example-cement"
        businessId={BID}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { me: ownerMe },
    );
    await userEvent.type(screen.getByLabelText('From date'), '2024-01-01');
    await userEvent.type(screen.getByLabelText('To date'), '2024-01-31');
    expect(await screen.findByText(/Purchase records show 40,200 Bag/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use this' }));
    expect(screen.getByLabelText('Quantity (Bag)')).toHaveValue('40200');
  });

  it('preview math matches the server formula (half-up): qty=15, target=10, base rate=10, bonus rate=1', async () => {
    mockApi(baseRoutes);
    renderInBusiness(
      <EntryForm
        entry={null}
        scheme={scheme()}
        unitName="Bag"
        slug="example-cement"
        businessId={BID}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { me: ownerMe },
    );
    await userEvent.type(screen.getByLabelText('Quantity (Bag)'), '15');
    expect(await screen.findByText('Base: 15 Bag × ৳10.00 = ৳150.00')).toBeInTheDocument();
    expect(screen.getByText('Bonus: 5 Bag × ৳1.00 = ৳5.00')).toBeInTheDocument();
    expect(screen.getByText('Total: ৳155.00')).toBeInTheDocument();
  });

  it('toDate before fromDate, and toDate in the future, are both rejected', async () => {
    mockApi(baseRoutes);
    renderInBusiness(
      <EntryForm
        entry={null}
        scheme={scheme()}
        unitName="Bag"
        slug="example-cement"
        businessId={BID}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { me: ownerMe },
    );
    await userEvent.type(screen.getByLabelText('From date'), '2024-01-20');
    await userEvent.type(screen.getByLabelText('To date'), '2024-01-10');
    await userEvent.type(screen.getByLabelText('Quantity (Bag)'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(
      await screen.findByText('The end date cannot be before the start date.'),
    ).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('To date'));
    await userEvent.type(screen.getByLabelText('To date'), '2099-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('The end date cannot be in the future.')).toBeInTheDocument();
  });
});

describe('<EntryDetail>: edit and receipts', () => {
  it('edit an entry → entry detail refreshed', async () => {
    mockApi({
      ...baseRoutes,
      [`GET ${B}/commission-scheme`]: () => json(200, { scheme: scheme() }),
      [`GET ${B}/commission-entries/e1`]: () => json(200, entry()),
      [`PATCH ${B}/commission-entries/e1`]: () => json(200, entry({ quantity: '40000' })),
    });
    const { invalidate } = renderInBusiness(
      <EntryDetail slug="example-cement" businessId={BID} id="e1" />,
      { me: ownerMe },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit entry' });
    const qty = within(dialog).getByLabelText('Quantity (Bag)');
    await userEvent.clear(qty);
    await userEvent.type(qty, '40000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    const keys = invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey));
    expect(keys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['dealership', BID, 'commissionEntries']),
        JSON.stringify(['dealership', BID, 'commissionSummary']),
        JSON.stringify(['dealership', BID, 'commissionEntry', 'detail', 'e1']),
      ]),
    );
  });

  it('add a receipt → entry detail and summary refreshed', async () => {
    mockApi({
      ...baseRoutes,
      [`GET ${B}/commission-scheme`]: () => json(200, { scheme: scheme() }),
      [`GET ${B}/commission-entries/e1`]: () => json(200, entry()),
      [`POST ${B}/commission-entries/e1/receipts`]: () =>
        json(201, {
          id: 'r1',
          amount: '350000.00',
          receivedDate: '2024-01-25',
          reference: null,
          note: null,
        }),
    });
    const { invalidate } = renderInBusiness(
      <EntryDetail slug="example-cement" businessId={BID} id="e1" />,
      { me: ownerMe },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Add a receipt' }));
    const dialog = screen.getByRole('dialog', { name: 'New receipt' });
    await userEvent.type(within(dialog).getByLabelText('Amount (BDT)'), '350000');
    await userEvent.clear(within(dialog).getByLabelText('Date received'));
    await userEvent.type(within(dialog).getByLabelText('Date received'), '2024-01-25');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Created.')).toBeInTheDocument();
    const keys = invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey));
    expect(keys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['dealership', BID, 'commissionEntry']),
        JSON.stringify(['dealership', BID, 'commissionSummary']),
        JSON.stringify(['dealership', BID, 'commissionEntry', 'detail', 'e1']),
      ]),
    );
  });
});

describe('<EntryForm>: create', () => {
  it('without a scheme: creation is blocked with a clear message', async () => {
    mockApi({
      ...baseRoutes,
      [`POST ${B}/commission-entries`]: () => apiError(400, 'COMMISSION_SCHEME_NOT_SET'),
    });
    renderInBusiness(
      <EntryForm
        entry={null}
        scheme={null}
        unitName="Bag"
        slug="example-cement"
        businessId={BID}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
      { me: ownerMe },
    );
    expect(await screen.findByText('Set the commission scheme first.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });
});
