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

const emptyBucket = {
  opening: '0.00',
  collectionsIn: '0.00',
  in: '0.00',
  out: '0.00',
  closing: '0.00',
};

/** Every endpoint the dashboard calls, with plausible, self-consistent numbers. */
const dashboardRoutes = ({ purchaseForbidden = false }: { purchaseForbidden?: boolean } = {}) => ({
  [`GET ${B}/accounts/summary`]: () =>
    json(200, {
      from: MONTH_START,
      to: TODAY,
      totalIn: '1000.00',
      totalOut: '200.00',
      net: '800.00',
      totalDue: '145000.00',
      totalAdvance: '0.00',
      byType: [
        { type: 'collection', in: '1000.00', out: '0.00' },
        { type: 'expense', in: '0.00', out: '200.00' },
        { type: 'commission_receipt', in: '300.00', out: '0.00' },
      ],
    }),
  [`GET ${B}/reports/sales`]: () =>
    json(200, {
      totalAmount: '4000.00',
      totalQuantity: '50',
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    }),
  [`GET ${B}/reports/collections`]: () =>
    json(200, { totalAmount: '1000.00', items: [], page: 1, pageSize: 10, total: 0 }),
  [`GET ${B}/purchases/summary`]: () =>
    purchaseForbidden
      ? json(403, { statusCode: 403, code: 'ACCESS_DENIED' })
      : json(200, {
          from: MONTH_START,
          to: TODAY,
          count: 1,
          totalQuantity: '100',
          totalAmount: '50000.00',
        }),
  [`GET ${B}/dashboard/cashbook`]: () =>
    json(200, {
      from: MONTH_START,
      to: TODAY,
      cash: {
        ...emptyBucket,
        opening: '12000.00',
        collectionsIn: '1000.00',
        in: '1000.00',
        out: '200.00',
        closing: '12800.00',
      },
      bank: { ...emptyBucket, opening: '5000.00', closing: '5000.00' },
      unassigned: { ...emptyBucket, in: '300.00', closing: '300.00' },
      availableCashAndBank: '17800.00',
    }),
  [`GET ${B}/dashboard/monthly-series`]: () =>
    json(200, {
      year: Number(YEAR),
      months: Array.from({ length: 12 }, (_, i) => ({
        month: `${YEAR}-${String(i + 1).padStart(2, '0')}`,
        collection: '1000.00',
        sales: '4000.00',
        salesQuantity: '50.000',
        purchaseQuantity: '100.000',
        ...(purchaseForbidden ? {} : { purchaseAmount: '50000.00' }),
      })),
    }),
  [`GET ${B}/dashboard/commission-series`]: () =>
    json(200, {
      year: Number(YEAR),
      months: Array.from({ length: 12 }, (_, i) => ({
        month: `${YEAR}-${String(i + 1).padStart(2, '0')}`,
        calculated: '389500.00',
        received: '300.00',
      })),
      yearCalculated: '389500.00',
      yearReceived: '300.00',
      lifetimeCalculated: '389500.00',
      lifetimeReceived: '300.00',
      receivable: '389200.00',
    }),
  [`GET ${B}/product-units`]: () =>
    json(200, {
      defaultUnitKey: 'bag',
      items: [{ key: 'bag', nameEn: 'Bag', nameBn: 'বস্তা', decimals: 0 }],
    }),
  [`GET ${B}/change-requests/pending-count`]: () => json(200, { count: 2 }),
});

const linkByName = (name: string) => screen.getByRole('link', { name });

describe('<DashboardView>', () => {
  it('renders the reference sections for an owner and passes an accessibility check', async () => {
    mockApi(dashboardRoutes());
    const { container } = renderInBusiness(
      <DashboardView slug="example-cement" businessId={BID} />,
      {
        me: ownerMe,
      },
    );
    expect(await screen.findByRole('heading', { name: 'This Month' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today', level: 2 })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sales & Collection Overview' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Commission Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cash Position' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financial Summary' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Monthly / Daily Summary' })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('points each monthly KPI at its parent page with the selected month', async () => {
    mockApi(dashboardRoutes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const collection = await screen.findByRole('link', { name: 'Total Collection: open page' });
    expect(collection).toHaveAttribute('href', `${B}/collections?from=${MONTH_START}&to=${TODAY}`);
    expect(linkByName('Total Sales: open page')).toHaveAttribute(
      'href',
      `${B}/sales?from=${MONTH_START}&to=${TODAY}`,
    );
    expect(linkByName('Sales Quantity: open page')).toHaveAttribute(
      'href',
      `${B}/reports/sales?from=${MONTH_START}&to=${TODAY}`,
    );
    expect(linkByName('Purchase Quantity: open page')).toHaveAttribute(
      'href',
      `${B}/purchases?from=${MONTH_START}&to=${TODAY}`,
    );
  });

  it('points each daily KPI at its parent page with today as the date', async () => {
    mockApi(dashboardRoutes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    expect(
      await screen.findByRole('link', { name: "Today's Collection: open page" }),
    ).toHaveAttribute('href', `${B}/collections?from=${TODAY}&to=${TODAY}`);
  });

  it('changing a card period updates its target and never navigates', async () => {
    mockApi(dashboardRoutes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const user = userEvent.setup();
    const card = (await screen.findByRole('link', { name: 'Total Collection: open page' })).closest(
      'article',
    )!;
    const select = within(card).getByRole('combobox', { name: 'Period for Total Collection' });
    // The period control sits outside the navigation link, so choosing a period is never a click
    // on the card.
    expect(card.querySelector('a')!.contains(select)).toBe(false);
    await user.selectOptions(select, 'lifetime');
    expect(card.querySelector('a')).toHaveAttribute(
      'href',
      `${B}/collections?from=2000-01-01&to=${TODAY}`,
    );
  });

  it('the This Month / All Time pills change all four monthly cards together', async () => {
    mockApi(dashboardRoutes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const user = userEvent.setup();
    await screen.findByRole('link', { name: 'Total Sales: open page' });
    const pills = screen.getByRole('group', { name: 'Monthly period' });
    await user.click(within(pills).getByRole('button', { name: 'All Time' }));
    expect(linkByName('Total Sales: open page')).toHaveAttribute(
      'href',
      `${B}/sales?from=2000-01-01&to=${TODAY}`,
    );
    expect(linkByName('Total Collection: open page')).toHaveAttribute(
      'href',
      `${B}/collections?from=2000-01-01&to=${TODAY}`,
    );
  });

  it('hides the Purchase Quantity card when purchase totals are forbidden', async () => {
    mockApi(dashboardRoutes({ purchaseForbidden: true }));
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    await screen.findByRole('link', { name: 'Total Collection: open page' });
    await screen.findByRole('heading', { name: 'Sales & Collection Overview' });
    expect(screen.queryByRole('link', { name: /Purchase Quantity/ })).not.toBeInTheDocument();
  });

  it('hides the Commission Overview and the commission row from a manager (owner-only)', async () => {
    mockApi({
      ...dashboardRoutes(),
      [`GET ${B}/dashboard/commission-series`]: () =>
        json(403, { statusCode: 403, code: 'ACCESS_DENIED' }),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(managerMe, MANAGER_PERMISSIONS),
    });
    await screen.findByRole('heading', { name: 'Financial Summary' });
    expect(screen.queryByRole('heading', { name: 'Commission Overview' })).not.toBeInTheDocument();
    expect(screen.queryByText('Supplier Commission Received')).not.toBeInTheDocument();
  });

  it('shows Net Profit as awaiting approval rather than inventing a number', async () => {
    mockApi(dashboardRoutes());
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, { me: ownerMe });
    const summary = await screen.findByRole('heading', { name: 'Financial Summary' });
    const section = summary.closest('section')!;
    expect(within(section).getAllByText('Awaiting costing approval').length).toBeGreaterThan(0);
  });
});
