import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Me } from '@/core/auth/types';
import { OWNER_PERMISSIONS, business, managerMe } from '../../../../test/fixtures/me';
import { json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { BID, dailySummaryResponse } from '../reports/fixtures';
import { DashboardView } from './dashboard-view';

const B = '/b/example-cement';

const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});

/** Mock endpoints every dashboard panel (KPI cards, Revenue Overview, Top 5, Sales Summary) needs. */
const dashboardRoutes = () =>
  Object.fromEntries([
    [
      `GET ${B}/accounts/summary`,
      () =>
        json(200, { totalDue: '500', totalAdvance: '9300', totalIn: '0', totalOut: '0', net: '0' }),
    ],
    [
      `GET ${B}/reports/sales`,
      () =>
        json(200, {
          totalAmount: '36000',
          totalQuantity: '0',
          items: [],
          page: 1,
          pageSize: 10,
          total: 0,
        }),
    ],
    [
      `GET ${B}/reports/collections`,
      () => json(200, { totalAmount: '0', items: [], page: 1, pageSize: 10, total: 0 }),
    ],
    [
      `GET ${B}/reports/expenses`,
      () => json(200, { totalAmount: '0', items: [], page: 1, pageSize: 10, total: 0 }),
    ],
    [
      `GET ${B}/purchases/summary`,
      () => json(200, { totalAmount: '0', totalQuantity: '0', count: 0 }),
    ],
    [
      `GET ${B}/commission-summary`,
      () => json(200, { totalCalculated: '0', totalReceived: '0', totalPending: '0' }),
    ],
  ]);

describe('<DashboardView>', () => {
  it('shows the Cash & Bank KPI card when cashbook.view is granted', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...dashboardRoutes(),
    });
    const { container } = renderInBusiness(
      <DashboardView slug="example-cement" businessId={BID} />,
      { me: meWith(['cashbook.view', 'report.view']) },
    );
    expect(await screen.findByText('৳18,500.00')).toBeInTheDocument(); // closing balance
    expect(screen.getByText('Cash & Bank')).toBeInTheDocument(); // KPI card label

    await expectNoA11yViolations(container);
  });

  it('hides the Cash & Bank KPI card when cashbook.view is not granted', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () =>
        json(200, dailySummaryResponse({ cash: undefined })),
      ...dashboardRoutes(),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(['report.view']),
    });
    await screen.findByText('Total Sales'); // KPI card renders
    expect(screen.queryByText('Cash & Bank')).not.toBeInTheDocument();
  });

  it('shows KPI cards and chart panels for all accessible metrics', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...dashboardRoutes(),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    expect(await screen.findByText('Total Sales')).toBeInTheDocument();
    expect(screen.getByText('Total Purchase')).toBeInTheDocument();
    expect(screen.getByText('Total Collection')).toBeInTheDocument();
    expect(screen.getByText('Customer Due')).toBeInTheDocument();
    expect(await screen.findByText('Cash & Bank')).toBeInTheDocument();
    expect(screen.getByText('Commission')).toBeInTheDocument();
    expect(screen.getByText('Net Profit')).toBeInTheDocument();
    expect(screen.getByText('Revenue Overview')).toBeInTheDocument();
    expect(screen.getByText('Top 5 Customers')).toBeInTheDocument();
    expect(screen.getByText('Sales Summary')).toBeInTheDocument();
  });
});
