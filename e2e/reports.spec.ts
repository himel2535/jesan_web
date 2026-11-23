import { expect, test, type Browser, type Page } from '@playwright/test';

/** Test-only accounts of e2e/mock-api.mjs (no real passwords). */
const ACCOUNTS = {
  owner: ['owner@example.com', 'e2e-owner-pass'],
} as const;

async function as(browser: Browser, who: keyof typeof ACCOUNTS, next: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3000' }]);
  const page = await context.newPage();
  const [email, password] = ACCOUNTS[who];
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email or phone').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === next.split('?')[0]);
  return page;
}

// The sidebar's "Reports" entry is gated by `reports.finance.view` (a separate, owner/finance-only
// nav stub for a future profit report — see docs/API.md and DECISIONS.md), so these pages
// are reached directly by URL here, same as a manager or accountant holding only `report.view`
// would reach them in production.

test('owner opens the sales report and switches groupBy', async ({ browser }) => {
  const owner = await as(browser, 'owner', '/b/example-cement/reports/sales');
  await expect(owner.getByRole('heading', { name: 'Sales report' })).toBeVisible();
  const groupBy = owner.getByLabel('Group by');
  await expect(groupBy).toHaveValue('date');
  await groupBy.selectOption('customer');
  await expect(owner).toHaveURL(/groupBy=customer/);
  await expect(groupBy).toHaveValue('customer');
});

test('owner sees the dues report with the three aging columns', async ({ browser }) => {
  const owner = await as(browser, 'owner', '/b/example-cement/reports/dues');
  await expect(owner.getByRole('heading', { name: 'Dues report' })).toBeVisible();
  await expect(owner.getByRole('columnheader', { name: '0-7 days' })).toBeVisible();
  await expect(owner.getByRole('columnheader', { name: '8-30 days' })).toBeVisible();
  await expect(owner.getByRole('columnheader', { name: '30+ days' })).toBeVisible();
  // Seeded customers: C-00001 owes, C-00002 is in advance (both have a non-zero balance).
  const dueRow = owner.getByRole('row', { name: /C-00001/ });
  await expect(dueRow).toBeVisible();
  const advanceRow = owner.getByRole('row', { name: /C-00002/ });
  await expect(advanceRow).toBeVisible();
});

test('owner sees every KPI card on the dashboard', async ({ browser }) => {
  const owner = await as(browser, 'owner', '/b/example-cement');
  const main = owner.getByRole('main');
  // Cash: owner has `cashbook.view`, so the daily summary's cash figures show too.
  await expect(main.getByText('Cash Balance')).toBeVisible();
  await expect(main.getByText('Closing Balance')).toBeVisible();
  // One KPI card per metric the owner has permission for.
  await expect(main.getByText('Total Due')).toBeVisible();
  await expect(main.getByText('Total Advance')).toBeVisible();
  await expect(main.getByText('Total Sales')).toBeVisible();
  await expect(main.getByText('Total Orders')).toBeVisible();
  await expect(main.getByText('Total Deliveries')).toBeVisible();
  await expect(main.getByText('Total Purchase')).toBeVisible();
  await expect(main.getByText('Total Stock')).toBeVisible();
  await expect(main.getByText('Total Product')).toBeVisible();
  await expect(main.getByText("This Month's Sales")).toBeVisible();
  await expect(main.getByText("This Month's Purchase")).toBeVisible();
  // Owner-only.
  await expect(main.getByText('Total Commission')).toBeVisible();
  await expect(main.getByText("This Month's Commission")).toBeVisible();
});
