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
  // The dashboard's 8 primary KPI cards.
  await expect(main.getByText('Total Sales')).toBeVisible();
  await expect(main.getByText('Total Purchase')).toBeVisible();
  await expect(main.getByText('Total Collection')).toBeVisible();
  await expect(main.getByText('Customer Due')).toBeVisible();
  // Cash & Bank: owner has `cashbook.view`, so the daily summary's cash figure shows too.
  await expect(main.getByText('Cash & Bank')).toBeVisible();
  // Commission and Commission Target: owner-only.
  await expect(main.getByText('Commission', { exact: true })).toBeVisible();
  await expect(main.getByText('Net Profit')).toBeVisible();
  await expect(main.getByText('Commission Target')).toBeVisible();
  // Excluded metrics must not appear anywhere as KPI cards.
  await expect(main.getByText('Total Orders')).toHaveCount(0);
  await expect(main.getByText('Total Deliveries')).toHaveCount(0);
  await expect(main.getByText('Total Customers')).toHaveCount(0);
  // No page title/heading above the KPI grid.
  await expect(main.getByRole('heading', { name: 'Example Cement' })).toHaveCount(0);

  // The three chart/table panels below the KPI grid.
  await expect(main.getByText('Revenue Overview')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Last Month' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'This Year' })).toBeVisible();
  await expect(main.getByText('Top 5 Customers')).toBeVisible();
  await expect(main.getByText('Sales Summary')).toBeVisible();

  // The operational row: Target & Commission Progress, Stock Overview, Sales & Delivery
  // Overview, Recent Transactions.
  await expect(main.getByText('Target & Commission Progress')).toBeVisible();
  await expect(main.getByText('Stock Overview')).toBeVisible();
  await expect(main.getByText('OPC')).toBeVisible();
  await expect(main.getByText('PCC')).toBeVisible();
  await expect(main.getByText('Total Stock')).toBeVisible();
  await expect(main.getByText('Sales & Delivery Overview')).toBeVisible();
  await expect(main.getByText('Recent Transactions')).toBeVisible();
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
  await expect(page.getByText('নগদ ও ব্যাংক')).toBeVisible(); // Cash & Bank
  await expect(page.getByText('আয়ের সারসংক্ষেপ')).toBeVisible(); // Revenue Overview
  await expect(page.getByText('শীর্ষ ৫ গ্রাহক')).toBeVisible(); // Top 5 Customers
  await expect(page.getByText('বিক্রয় সারসংক্ষেপ')).toBeVisible(); // Sales Summary
  await expect(page.getByText('লক্ষ্যমাত্রা ও কমিশন অগ্রগতি')).toBeVisible(); // Target & Commission Progress
  await expect(page.getByText('স্টক সারসংক্ষেপ')).toBeVisible(); // Stock Overview
  await expect(page.getByText('সাম্প্রতিক লেনদেন')).toBeVisible(); // Recent Transactions
  expect(errors).toEqual([]);
});
