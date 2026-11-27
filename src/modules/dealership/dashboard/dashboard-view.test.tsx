import { screen, waitFor, within } from '@testing-library/react';
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
const kpiWindow = {
  from: MONTH_START,
  to: TODAY,
  collection: '325750.00',
  sales: '485200.00',
  salesQuantity: '1250.000',
  purchaseQuantity: '980.000',
};

const routes = ({ withProfit = true }: { withProfit?: boolean } = {}) => ({
  [`GET ${B}/dashboard/kpis`]: () => json(200, { current: kpiWindow }),
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
      // The chart panels load their code lazily, so wait for them.
      expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
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

  it('asks for the KPI figures once per row, not once per card and window', async () => {
    const { calls } = mockApi(routes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    await screen.findByRole('link', { name: 'Total Collection: open page' });
    const paths = calls.map((call) => call.path);
    // This Month row and Today row: one request each, for the selected window only.
    expect(paths.filter((p) => p === `${B}/dashboard/kpis`)).toHaveLength(2);
    // Nothing is compared with last month or yesterday, so nothing is asked for.
    expect(calls.some((call) => call.url.includes('prevFrom') || call.url.includes('prevTo'))).toBe(
      false,
    );
    expect(paths).not.toContain(`${B}/reports/sales`);
    expect(paths).not.toContain(`${B}/reports/collections`);
    expect(paths).not.toContain(`${B}/purchases/summary`);
  });

  it('shows no comparison line on any KPI card', async () => {
    mockApi(routes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    await screen.findByRole('link', { name: 'Total Collection: open page' });
    for (const name of ['Total Collection', 'Total Sales', "Today's Sales"]) {
      const card = cardFor(name);
      expect(within(card).queryByText(/vs Last Month|vs Yesterday/)).toBeNull();
      expect(card.textContent).not.toMatch(/[▲▼]/);
    }
  });

  it('hides the bags-bought cards when the answer has no purchase quantity', async () => {
    mockApi({
      ...routes(),
      [`GET ${B}/dashboard/kpis`]: () => {
        const { purchaseQuantity: _omitted, ...withoutPurchase } = kpiWindow;
        return json(200, { current: withoutPurchase });
      },
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    await screen.findByRole('link', { name: 'Total Collection: open page' });
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Purchase Quantity: open page' })).toBeNull(),
    );
    expect(screen.getByRole('link', { name: 'Total Sales: open page' })).toBeInTheDocument();
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
    await user.click(
      within(panel).getByRole('combobox', { name: 'Choose month for Financial Summary' }),
    );
    await user.click(await screen.findByRole('option', { name: 'Feb' }));
    expect(within(panel).getByRole('button', { name: 'All Time' })).toBeInTheDocument();
    expect(
      within(panel).getByRole('combobox', { name: 'Choose month for Financial Summary' }),
    ).toHaveTextContent('Feb');
    const daily = (await screen.findByRole('heading', { name: 'Monthly / Daily Summary' })).closest(
      'section',
    ) as HTMLElement;
    await user.click(within(daily).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Today' }));
    expect(within(daily).getByRole('combobox')).toHaveTextContent('Today');
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

    await user.click(year);
    await user.click(await screen.findByRole('option', { name: '25' }));
    await user.click(month);
    await user.click(await screen.findByRole('option', { name: 'Feb' }));
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
    // The same warning sits beside the cost-of-sales row itself, with the counts the API sent.
    expect(
      within(panel).getByText(
        '12 bags (1 delivery line) have no known cost, so this cost of sales is incomplete.',
      ),
    ).toBeInTheDocument();
  });

  const summaryWith = (extra: Record<string, string | number>) => ({
    ...routes(),
    [`GET ${B}/dashboard/finance-summary`]: () =>
      json(200, {
        from: MONTH_START,
        to: TODAY,
        sales: '485200.00',
        collection: '0.00',
        customerDue: '485200.00',
        expenses: '0.00',
        commissionReceived: '0.00',
        totalPurchase: '310000.00',
        currentStockQuantity: '980.000',
        currentStockValue: '588000.00',
        cogs: '454750.00',
        netProfit: '30450.00',
        uncostedQuantityDelivered: '0.000',
        uncostedQuantityOnHand: '0.000',
        uncostedDeliveryLines: 0,
        ...extra,
      }),
  });

  it('never shows a bare ৳0 cost of sales as verified when sales exist', async () => {
    mockApi(summaryWith({ cogs: '0.00', netProfit: '485200.00' }));
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const heading = await screen.findByRole('heading', { name: 'Financial Summary' });
    const panel = heading.closest('section') as HTMLElement;
    expect(
      await within(panel).findByText(
        'Sales exist but the cost of sales is zero, so the cost has not been verified.',
      ),
    ).toBeInTheDocument();
  });

  it('says so when the API reports an incomplete cost for lines that were never costed', async () => {
    mockApi(summaryWith({ costComplete: false as unknown as string, uncostedDeliveryLines: 2 }));
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const heading = await screen.findByRole('heading', { name: 'Financial Summary' });
    const panel = heading.closest('section') as HTMLElement;
    expect(
      await within(panel).findByText(
        '2 delivery lines were delivered with no recorded cost, so this cost of sales is incomplete.',
      ),
    ).toBeInTheDocument();
  });

  it('shows no cost warning when the cost of sales is complete', async () => {
    mockApi(summaryWith({}));
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const heading = await screen.findByRole('heading', { name: 'Financial Summary' });
    const panel = heading.closest('section') as HTMLElement;
    await within(panel).findByText('Total Net Profit');
    expect(within(panel).queryByRole('note')).toBeNull();
  });

  it('does not call a legitimate zero cost unverified when nothing was sold', async () => {
    mockApi(summaryWith({ sales: '0.00', cogs: '0.00', netProfit: '0.00' }));
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const heading = await screen.findByRole('heading', { name: 'Financial Summary' });
    const panel = heading.closest('section') as HTMLElement;
    await within(panel).findByText('Total Net Profit');
    expect(within(panel).queryByRole('note')).toBeNull();
  });
});
