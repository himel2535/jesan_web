import { screen, waitFor } from '@testing-library/react';
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

/** Every endpoint besides daily-summary that the dashboard's sections call, all forbidden. */
const forbiddenRoutes = () =>
  Object.fromEntries(
    [
      'GET /accounts/summary',
      'GET /reports/sales',
      'GET /orders',
      'GET /deliveries',
      'GET /reports/collections',
      'GET /reports/expenses',
      'GET /purchases/summary',
      'GET /customers',
      'GET /products',
      'GET /commission-summary',
    ].map((route) => [
      route.replace('GET ', `GET ${B}`),
      () => json(403, { statusCode: 403, code: 'FORBIDDEN' }),
    ]),
  );

describe('<DashboardView>', () => {
  it('shows the cash section, hiding every other section for a user with no permissions', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...forbiddenRoutes(),
    });
    const { container } = renderInBusiness(
      <DashboardView slug="example-cement" businessId={BID} />,
      { me: meWith([]) },
    );
    expect(await screen.findByText('৳12,000.00')).toBeInTheDocument(); // cash opening balance
    expect(screen.getByText('৳18,500.00')).toBeInTheDocument(); // cash closing balance

    // Sections gated on their own permission (the query's 403, or `commission.view` for
    // Commission) hide entirely once settled; Sales always shows (today's deliveries alone
    // needs no extra permission beyond the page itself).
    await waitFor(() => {
      expect(screen.queryByText('Accounts')).not.toBeInTheDocument();
      expect(screen.queryByText('Purchases')).not.toBeInTheDocument();
      expect(screen.queryByText('Collections')).not.toBeInTheDocument();
      expect(screen.queryByText('Partial Expenses')).not.toBeInTheDocument();
      expect(screen.queryByText('Customers')).not.toBeInTheDocument();
      expect(screen.queryByText('Stock')).not.toBeInTheDocument();
      expect(screen.queryByText('Commission')).not.toBeInTheDocument();
    });

    await expectNoA11yViolations(container);
  });

  it('shows no cash section when the API omits `cash` (no cashbook.view)', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () =>
        json(200, dailySummaryResponse({ cash: undefined })),
      ...forbiddenRoutes(),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    await screen.findByText('Sales'); // dashboard finished rendering
    expect(screen.queryByText('৳12,000.00')).not.toBeInTheDocument();
  });

  it("shows today's delivery count from the daily summary in the Sales section", async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...forbiddenRoutes(),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    expect(await screen.findByText('Sales')).toBeInTheDocument();
    expect(await screen.findByText('৳36,000.00')).toBeInTheDocument();
    expect(screen.getByText("Today's Deliveries")).toBeInTheDocument();
  });
});
