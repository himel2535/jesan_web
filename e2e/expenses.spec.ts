import { expect, test, type Browser, type Page } from '@playwright/test';

/** Test-only accounts of e2e/mock-api.mjs (no real passwords). */
const ACCOUNTS = {
  owner: ['owner@example.com', 'e2e-owner-pass'],
  manager: ['manager@example.com', 'e2e-manager-pass'],
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

test('record an expense → the cash book counts it → void it → the cash book drops it', async ({
  browser,
}) => {
  const manager = await as(browser, 'manager', '/b/example-cement/expenses');
  await expect(manager.getByText('Total Partial Expenses')).toBeVisible();
  await expect(manager.getByText("Today's Expenses")).toBeVisible();
  await manager.getByRole('link', { name: 'Record an expense' }).click();
  await expect(manager.getByRole('heading', { name: 'Record an expense' })).toBeVisible();
  await manager.getByLabel('Amount').fill('2500');
  await manager.getByRole('button', { name: 'Save' }).click();
  await expect(manager.getByText('The expense was saved.')).toBeVisible();
  const heading = await manager.getByRole('heading', { name: /Expense EXP-\d+/ }).textContent();
  const code = heading!.replace('Expense ', '').trim();

  // Staff without `expense.void` never see the button; they can only ask for a correction.
  await expect(manager.getByRole('button', { name: 'Void' })).toHaveCount(0);

  await manager.goto('/b/example-cement/cashbook');
  await expect(manager.getByText('৳2,500.00').first()).toBeVisible();

  await manager.goto('/b/example-cement/expenses');
  await expect(
    manager.locator('[class*="rounded-card"]').filter({ hasText: "Today's Expenses" }).getByText('৳2,500.00'),
  ).toBeVisible();

  // Voiding needs `expense.void` (owner-level by default).
  const owner = await as(browser, 'owner', '/b/example-cement/expenses');
  await owner.getByRole('link', { name: code, exact: true }).click();
  await owner.getByRole('button', { name: 'Void' }).click();
  await owner.getByLabel('Reason for the change').fill('Entered by mistake');
  await owner.getByRole('button', { name: 'Void the expense' }).click();
  await expect(owner.getByText('The expense was voided.')).toBeVisible();

  await owner.goto('/b/example-cement/cashbook');
  await expect(owner.getByText('৳2,500.00')).toHaveCount(0);
});
