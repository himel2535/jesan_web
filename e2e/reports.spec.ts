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

test('owner sees every KPI card and chart panel on the dashboard', async ({ browser }) => {
  const owner = await as(browser, 'owner', '/b/example-cement');
  const main = owner.getByRole('main');
  // Cash: owner has `cashbook.view`, so the daily summary's cash figures show too.
  await expect(main.getByText('Cash Balance')).toBeVisible();
  await expect(main.getByText('Closing Balance')).toBeVisible();
  await expect(main.getByText('Net Cash')).toBeVisible();
  // Accounts: income/expense/net across all three windows, plus due/advance.
  await expect(main.getByText('Total Income')).toBeVisible();
  await expect(main.getByText("Today's Income")).toBeVisible();
  await expect(main.getByText("This Month's Income")).toBeVisible();
  await expect(main.getByText('Total Expense')).toBeVisible();
  await expect(main.getByText('Total Net')).toBeVisible();
  await expect(main.getByText('Total Due')).toBeVisible();
  await expect(main.getByText('Total Advance')).toBeVisible();
  // Sales.
  await expect(main.getByText('Total Sales')).toBeVisible();
  await expect(main.getByText("Today's Sales")).toBeVisible();
  await expect(main.getByText("This Month's Sales")).toBeVisible();
  // Purchases: Total Quantity never needs product.cost.view; the owner has it too.
  await expect(main.getByText('Total Quantity')).toBeVisible();
  await expect(main.getByText('Total Purchase Amount')).toBeVisible();
  await expect(main.getByText("This Year's Purchases")).toBeVisible();
  // Collections.
  await expect(main.getByText('Total Collection Amount')).toBeVisible();
  await expect(main.getByText("This Month's Collection")).toBeVisible();
  // Partial expenses.
  await expect(main.getByText('Total Partial Expenses')).toBeVisible();
  await expect(main.getByText("Previous Month's Expenses")).toBeVisible();
  // Commission: owner-only.
  await expect(main.getByText('Total Calculated')).toBeVisible();
  await expect(main.getByText('Total Received')).toBeVisible();
  await expect(main.getByText('Pending Commission')).toBeVisible();
  // Excluded metrics must not appear anywhere as KPI cards.
  await expect(main.getByText('Total Orders')).toHaveCount(0);
  await expect(main.getByText('Total Deliveries')).toHaveCount(0);
  await expect(main.getByText('Total Stock')).toHaveCount(0);
  await expect(main.getByText('Total Customers')).toHaveCount(0);

  // The three chart/table panels below the KPI grid.
  await expect(main.getByText('Revenue Overview')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Last Month' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'This Year' })).toBeVisible();
  await expect(main.getByText('Top 5 Customers')).toBeVisible();
  await expect(main.getByText('Sales Summary')).toBeVisible();
});

test('Bengali and dark theme: the dashboard renders without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'bn', url: 'http://localhost:3000' },
    { name: 'theme', value: 'dark', url: 'http://localhost:3000' },
  ]);
  const [email, password] = ACCOUNTS.owner;
  await page.goto('/login?next=%2Fb%2Fexample-cement');
  await page.getByLabel('ইমেইল বা ফোন').fill(email);
  await page.getByLabel('পাসওয়ার্ড', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'লগইন' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText('নগদ ব্যালেন্স')).toBeVisible(); // Cash Balance
  await expect(page.getByText('আয়ের সারসংক্ষেপ')).toBeVisible(); // Revenue Overview
  await expect(page.getByText('শীর্ষ ৫ গ্রাহক')).toBeVisible(); // Top 5 Customers
  await expect(page.getByText('বিক্রয় সারসংক্ষেপ')).toBeVisible(); // Sales Summary
  expect(errors).toEqual([]);
});
