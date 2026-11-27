import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { businessToday } from '@/core/i18n/format';
import type { Me } from '@/core/auth/types';
import { MANAGER_PERMISSIONS, business, managerMe, ownerMe } from '../../../../test/fixtures/me';
import { json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { BID } from '../reports/fixtures';
import { DashboardView } from './dashboard-view';

const B = '/b/example-cement';
const TODAY = businessToday();
const MONTH_START = `${TODAY.slice(0, 8)}01`;
const YEAR = TODAY.slice(0, 4);

const meWith = (base: Me, permissions: string[]): Me => ({
  ...base,
  businesses: [business({ permissions })],
});

const bucket = {
  opening: '0.00',
  collectionsIn: '0.00',
  in: '0.00',
  out: '0.00',
  closing: '0.00',
};

/** Every endpoint the dashboard calls, with self-consistent figures. */
const routes = ({ withProfit = true }: { withProfit?: boolean } = {}) => ({
  [`GET ${B}/reports/sales`]: () =>
    json(200, {
      totalAmount: '485200.00',
      totalQuantity: '1250',
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    }),
  [`GET ${B}/reports/collections`]: () =>
    json(200, { totalAmount: '325750.00', items: [], page: 1, pageSize: 10, total: 0 }),
  [`GET ${B}/purchases/summary`]: () =>
    json(200, {
      from: MONTH_START,
      to: TODAY,
      count: 3,
      totalQuantity: '980',
      totalAmount: '310000.00',
    }),
  [`GET ${B}/dashboard/finance-summary`]: () =>
    json(200, {
      from: MONTH_START,
      to: TODAY,
      sales: '485200.00',
      collection: '325750.00',
      customerDue: '275000.00',
      expenses: '95000.00',
      commissionReceived: '125000.00',
      ...(withProfit
        ? {
            totalPurchase: '310000.00',
            currentStockQuantity: '980.000',
            currentStockValue: '588000.00',
            cogs: '454750.00',
            netProfit: '60450.00',
            uncostedQuantityDelivered: '0.000',
            uncostedQuantityOnHand: '0.000',
            uncostedDeliveryLines: 0,
          }
        : {}),
    }),
  [`GET ${B}/dashboard/cashbook`]: () =>
    json(200, {
      from: MONTH_START,
      to: TODAY,
      cash: { ...bucket, closing: '350000.00' },
      bank: bucket,
      unassigned: bucket,
      availableCashAndBank: '350000.00',
    }),
  [`GET ${B}/dashboard/monthly-series`]: () =>
    json(200, {
      year: Number(YEAR),
      months: Array.from({ length: 12 }, (_, i) => ({
        month: `${YEAR}-${String(i + 1).padStart(2, '0')}`,
        collection: '325750.00',
        sales: '485200.00',
        salesQuantity: '1250.000',
        purchaseQuantity: '980.000',
        purchaseAmount: '310000.00',
      })),
    }),
  [`GET ${B}/dashboard/commission-series`]: () =>
    json(200, {
      year: Number(YEAR),
      months: Array.from({ length: 12 }, (_, i) => ({
        month: `${YEAR}-${String(i + 1).padStart(2, '0')}`,
        received: '125000.00',
      })),
      yearReceived: '1250000.00',
      lifetimeReceived: '1250000.00',
    }),
  [`GET ${B}/product-units`]: () =>
    json(200, {
      defaultUnitKey: 'bag',
      items: [{ key: 'bag', nameEn: 'Bag', nameBn: 'বস্তা', decimals: 0 }],
    }),
  [`GET ${B}/change-requests/pending-count`]: () => json(200, { count: 3 }),
});

const cardFor = (name: string) =>
  screen.getByRole('link', { name: `${name}: open page` }).closest('article') as HTMLElement;

describe('<DashboardView>', () => {
  it('renders every panel of the reference and passes an accessibility check', async () => {
    mockApi(routes());
    const { container } = renderInBusiness(
      <DashboardView slug="example-cement" businessId={BID} />,
      { me: ownerMe },
    );
    expect(await screen.findByRole('heading', { name: 'This Month' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today', level: 2 })).toBeInTheDocument();
    for (const name of [
      'Sales & Collection Overview',
      'Commission Overview',
      'Key Information',
      'Financial Summary',
      'Monthly / Daily Summary',
      'Cash Flow Snapshot',
    ]) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    await expectNoA11yViolations(container);
  });

  it('shows the eight KPI cards, each linking to its parent page for the chosen period', async () => {
    mockApi(routes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    await screen.findByRole('link', { name: 'Total Collection: open page' });

    const monthly: [string, string][] = [
      ['Total Collection', 'collections'],
      ['Total Sales', 'sales'],
      ['Sales Quantity', 'reports/sales'],
      ['Purchase Quantity', 'purchases'],
    ];
    for (const [name, parent] of monthly) {
      expect(screen.getByRole('link', { name: `${name}: open page` })).toHaveAttribute(
        'href',
        `${B}/${parent}?from=${MONTH_START}&to=${TODAY}`,
      );
    }
    const daily: [string, string][] = [
      ["Today's Collection", 'collections'],
      ["Today's Sales", 'sales'],
      ["Today's Sales Qty", 'reports/sales'],
      ["Today's Purchase Qty", 'purchases'],
    ];
    for (const [name, parent] of daily) {
      expect(screen.getByRole('link', { name: `${name}: open page` })).toHaveAttribute(
        'href',
        `${B}/${parent}?from=${TODAY}&to=${TODAY}`,
      );
    }
  });

  it('changes only its own card when a period pill is used, and never navigates', async () => {
    mockApi(routes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const user = userEvent.setup();
    await screen.findByRole('link', { name: 'Total Collection: open page' });

    const collection = cardFor('Total Collection');
    // The pills sit outside the navigation link, so using one is not a click
    // on the card.
    const allTime = within(collection).getByRole('button', { name: 'All Time' });
    expect(collection.querySelector('a')?.contains(allTime)).toBe(false);

    await user.click(allTime);
    expect(collection.querySelector('a')).toHaveAttribute(
      'href',
      `${B}/collections?from=2000-01-01&to=${TODAY}`,
    );
    // Its neighbour is untouched: each card carries its own period.
    expect(cardFor('Total Sales').querySelector('a')).toHaveAttribute(
      'href',
      `${B}/sales?from=${MONTH_START}&to=${TODAY}`,
    );
  });

  it('has no welcome text, only a screen-reader page title', async () => {
    mockApi(routes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    await screen.findByRole('link', { name: 'Total Collection: open page' });
    expect(screen.queryByText(/welcome/i)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
  });

  it('lists collection, sales and purchase in the overview chart legend', async () => {
    mockApi(routes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const heading = await screen.findByRole('heading', { name: 'Sales & Collection Overview' });
    const panel = heading.closest('section') as HTMLElement;
    const legend = within(panel).getByRole('list');
    expect(within(legend).getAllByRole('listitem')).toHaveLength(3);
  });

  it('filters the panels with the same pastel dropdowns as the KPI cards', async () => {
    mockApi(routes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const user = userEvent.setup();
    const heading = await screen.findByRole('heading', { name: 'Financial Summary' });
    const panel = heading.closest('section') as HTMLElement;
    await user.selectOptions(
      within(panel).getByLabelText('Choose month for Financial Summary'),
      '2',
    );
    expect(within(panel).getByRole('button', { name: 'All Time' })).toBeInTheDocument();
    const daily = (await screen.findByRole('heading', { name: 'Monthly / Daily Summary' })).closest(
      'section',
    ) as HTMLElement;
    await user.selectOptions(within(daily).getByRole('combobox'), 'today');
    expect(within(daily).getByRole('combobox')).toHaveValue('today');
    expect(
      within(
        screen
          .getByRole('heading', { name: 'Sales & Collection Overview' })
          .closest('section') as HTMLElement,
      ).getByRole('combobox'),
    ).toBeInTheDocument();
  });

  it('picks a month and year from the dropdowns and keeps All Time at the bottom', async () => {
    mockApi(routes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const user = userEvent.setup();
    await screen.findByRole('link', { name: 'Total Collection: open page' });

    const collection = cardFor('Total Collection');
    expect(within(collection).queryByRole('button', { name: 'Last Month' })).toBeNull();
    const month = within(collection).getByLabelText('Choose month for Total Collection');
    const year = within(collection).getByLabelText('Choose year for Total Collection');
    expect(collection.querySelector('a')?.contains(month)).toBe(false);
    // Month, year and All Time sit together in the card's bottom row, not in its header.
    const allTimeButton = within(collection).getByRole('button', { name: 'All Time' });
    const row = month.closest('div') as HTMLElement;
    expect(row.contains(year)).toBe(true);
    expect(row.contains(allTimeButton)).toBe(true);

    await user.selectOptions(year, '2025');
    await user.selectOptions(month, '2');
    expect(collection.querySelector('a')).toHaveAttribute(
      'href',
      `${B}/collections?from=2025-02-01&to=2025-02-28`,
    );
    expect(cardFor('Total Sales').querySelector('a')).toHaveAttribute(
      'href',
      `${B}/sales?from=${MONTH_START}&to=${TODAY}`,
    );
  });

  it('shows the net profit the backend computed, with its change', async () => {
    mockApi(routes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const heading = await screen.findByRole('heading', { name: 'Financial Summary' });
    const panel = heading.closest('section') as HTMLElement;

    expect(await within(panel).findByText('Total Net Profit')).toBeInTheDocument();
    expect(within(panel).getByText('৳ 60,450')).toBeInTheDocument();
    // The four rows that make up the profit, and the two that do not.
    for (const row of ['Total Sales', 'Purchase Cost of Sales', 'Partial Expense', 'Commission']) {
      expect(within(panel).getByText(row)).toBeInTheDocument();
    }
    expect(within(panel).getByText('Collection')).toBeInTheDocument();
    expect(within(panel).getByText('Due')).toBeInTheDocument();
    // No placeholder text anywhere: the figure is real.
    expect(within(panel).queryByText(/Awaiting/i)).toBeNull();
  });

  it('hides cost and profit from a manager, who has no profit.view', async () => {
    mockApi(routes({ withProfit: false }));
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(managerMe, MANAGER_PERMISSIONS),
    });
    const heading = await screen.findByRole('heading', { name: 'Financial Summary' });
    const panel = heading.closest('section') as HTMLElement;
    await within(panel).findByText('Total Sales');
    expect(within(panel).queryByText('Total Net Profit')).toBeNull();
    expect(within(panel).queryByText('Purchase Cost of Sales')).toBeNull();
    // The rest of the summary is still there.
    expect(await within(panel).findByText('Total Sales')).toBeInTheDocument();
  });

  it('keeps the Commission Overview out of a manager’s dashboard (owner-only)', async () => {
    mockApi({
      ...routes({ withProfit: false }),
      [`GET ${B}/dashboard/commission-series`]: () =>
        json(403, { statusCode: 403, code: 'ACCESS_DENIED' }),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(managerMe, MANAGER_PERMISSIONS),
    });
    await screen.findByRole('heading', { name: 'Financial Summary' });
    expect(screen.queryByRole('heading', { name: 'Commission Overview' })).toBeNull();
    // Key Information drops its two commission rows but keeps the due.
    const keyInfo = screen
      .getByRole('heading', { name: 'Key Information' })
      .closest('section') as HTMLElement;
    expect(within(keyInfo).queryByText('Total Commission')).toBeNull();
    expect(within(keyInfo).getByText('Total Due')).toBeInTheDocument();
  });

  it('warns when some delivered bags had no cost basis', async () => {
    mockApi({
      ...routes(),
      [`GET ${B}/dashboard/finance-summary`]: () =>
        json(200, {
          from: MONTH_START,
          to: TODAY,
          sales: '485200.00',
          collection: '325750.00',
          customerDue: '275000.00',
          expenses: '95000.00',
          commissionReceived: '125000.00',
          totalPurchase: '310000.00',
          currentStockQuantity: '980.000',
          currentStockValue: '588000.00',
          cogs: '454750.00',
          netProfit: '60450.00',
          uncostedQuantityDelivered: '12.000',
          uncostedQuantityOnHand: '12.000',
          uncostedDeliveryLines: 1,
        }),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const heading = await screen.findByRole('heading', { name: 'Financial Summary' });
    const panel = heading.closest('section') as HTMLElement;
    expect(await within(panel).findByText(/no cost basis/i)).toBeInTheDocument();
  });
});
