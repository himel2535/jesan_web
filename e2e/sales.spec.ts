import { expect, test, type Browser, type Page } from '@playwright/test';

/** Test-only accounts of e2e/mock-api.mjs (no real passwords). */
const ACCOUNTS = {
  owner: ['owner@example.com', 'e2e-owner-pass'],
  manager: ['manager@example.com', 'e2e-manager-pass'],
  salesman: ['salesman@example.com', 'e2e-salesman-pass'],
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

/** Stock has to exist before anything can be delivered: buy some first. */
async function buyStock(page: Page, product: RegExp, quantity: string) {
  await page.goto('/b/example-cement/purchases/new');
  await page.getByRole('searchbox', { name: 'Add a product' }).fill(product.source.slice(8));
  await page.getByRole('button', { name: product }).click();
  await page.getByLabel('Quantity (Bag)').fill(quantity);
  await page.getByLabel('Unit price').fill('500');
  await page.getByRole('button', { name: 'Save purchase' }).click();
  await expect(page.getByText('Purchase saved.')).toBeVisible();
}

async function newOrder(page: Page, product: RegExp, quantity: string, price: string) {
  await page.goto('/b/example-cement/sales/new');
  await page.getByRole('searchbox', { name: 'Customer' }).fill('Sample Store One');
  await page.getByRole('button', { name: /C-00001/ }).click();
  await page.getByRole('searchbox', { name: 'Add a product' }).fill(product.source.slice(8));
  await page.getByRole('button', { name: product }).click();
  await page.getByLabel('Quantity (Bag)').fill(quantity);
  await page.getByLabel('Unit price').fill(price);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('The order was saved.')).toBeVisible();
  const heading = await page.getByRole('heading', { name: /Order ORD-\d+/ }).textContent();
  return heading!.replace('Order ', '').trim();
}

test('order → partial delivery → collection → the ledger adds up', async ({ browser }) => {
  const manager = await as(browser, 'manager', '/b/example-cement/sales');
  await buyStock(manager, /P-0001 Sample PCC 01/, '500');
  const code = await newOrder(manager, /P-0001 Sample PCC 01/, '100', '565');
  await expect(manager.getByText('৳56,500.00').first()).toBeVisible();

  // Part of the order goes out; the rest stays open.
  await manager.getByRole('link', { name: 'Deliver', exact: true }).click();
  await expect(manager.getByRole('heading', { name: 'New delivery' })).toBeVisible();
  await manager.getByLabel('Quantity (Bag)').fill('40');
  await manager.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(manager.getByText('The delivery was saved.')).toBeVisible();
  await expect(manager.getByRole('heading', { name: /Delivery DEL-\d+/ })).toBeVisible();

  await manager.goto('/b/example-cement/sales');
  const row = manager.getByRole('row', { name: new RegExp(code) });
  await expect(row).toContainText('Part delivered');
  await expect(row).toContainText('60');

  // Money collected against the order.
  await manager.goto('/b/example-cement/collections/new');
  await manager.getByRole('searchbox', { name: 'Customer' }).fill('Sample Store One');
  await manager.getByRole('button', { name: /C-00001/ }).click();
  await manager.getByLabel('Amount').fill('20000');
  await manager.getByLabel('Method').selectOption('bkash');
  await manager.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(manager.getByText('The collection was saved.')).toBeVisible();

  // The ledger: a delivery line, a collection line, and the summary the server computed.
  await manager.goto('/b/example-cement/customers/cu1/ledger');
  await expect(manager.getByRole('row', { name: /Delivery/ })).toContainText('−৳22,600.00');
  await expect(manager.getByRole('row', { name: /Collection/ })).toContainText('+৳20,000.00');
  await expect(manager.getByText('৳22,600.00').first()).toBeVisible();
  // opening 12,500 + delivered 22,600 − collected 20,000 = 15,100
  await expect(manager.getByText('৳15,100.00')).toBeVisible();
});

test('a delivery above the stock is refused with the real numbers', async ({ browser }) => {
  const manager = await as(browser, 'manager', '/b/example-cement/sales');
  await buyStock(manager, /P-0002 Sample OPC 02/, '10');
  await newOrder(manager, /P-0002 Sample OPC 02/, '50', '600');
  await manager.getByRole('link', { name: 'Deliver', exact: true }).click();
  await manager.getByLabel('Quantity (Bag)').fill('50');
  await manager.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(manager.getByText(/Only 10 Bag are in stock/)).toBeVisible();
  // Nothing was delivered: the order is still untouched.
  await manager.goto('/b/example-cement/deliveries');
  await expect(manager.getByRole('row', { name: /Sample OPC 02/ })).toHaveCount(0);
});

test('collecting more than is due shows the balance as an advance', async ({ browser }) => {
  const manager = await as(browser, 'manager', '/b/example-cement/collections/new');
  await manager.getByRole('searchbox', { name: 'Customer' }).fill('Advance Shop');
  await manager.getByRole('button', { name: /C-00002/ }).click();
  await manager.getByLabel('Amount').fill('5000');
  await manager.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(manager.getByText('The collection was saved.')).toBeVisible();
  await manager.goto('/b/example-cement/customers/cu2/ledger');
  await expect(manager.getByText('Advance').first()).toBeVisible();
  await expect(manager.getByText('৳5,200.50')).toBeVisible();
});

test('a salesman has no deliveries or collections, and is refused their URLs', async ({
  browser,
}) => {
  const salesman = await as(browser, 'salesman', '/b/example-cement/sales');
  const sidebar = salesman.getByRole('navigation').first();
  await expect(sidebar.getByRole('link', { name: 'Deliveries' })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Collections' })).toHaveCount(0);
  await salesman.goto('/b/example-cement/deliveries');
  await expect(salesman.getByRole('heading', { name: 'No access' })).toBeVisible();
  await salesman.goto('/b/example-cement/collections');
  await expect(salesman.getByRole('heading', { name: 'No access' })).toBeVisible();
  // Their own order, and the order's deliveries as a summary inside it.
  const code = await newOrder(salesman, /P-0003 Sample PCC 03/, '20', '570');
  await salesman.goto('/b/example-cement/sales');
  await expect(salesman.getByRole('row', { name: new RegExp(code) })).toBeVisible();
  await expect(salesman.getByRole('link', { name: 'Deliver', exact: true })).toHaveCount(0);
});

test('manager asks to void an order; owner sees the effect and approves', async ({ browser }) => {
  const manager = await as(browser, 'manager', '/b/example-cement/sales');
  const code = await newOrder(manager, /P-0004 Sample OPC 04/, '30', '555');
  // A manager may not void directly (no sale.void): they ask.
  await expect(manager.getByRole('button', { name: 'Void' })).toHaveCount(0);
  await manager.getByRole('button', { name: 'Request a correction' }).click();
  const dialog = manager.getByRole('dialog', { name: `Request a correction: ${code}` });
  await dialog.getByLabel('Void this record').check();
  await dialog.getByLabel('Reason for the request').fill('e2e: the shop cancelled');
  await dialog.getByRole('button', { name: 'Review' }).click();
  await expect(dialog.getByText('Left to deliver')).toBeVisible();
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(
    manager.getByText('Request sent. It takes effect when the owner approves it.'),
  ).toBeVisible();

  const owner = await as(browser, 'owner', '/b/example-cement/approvals/all');
  await owner.getByLabel('Record type').selectOption('sales_order');
  await owner.getByRole('link', { name: `Details of the request for ${code}` }).click();
  await expect(owner.getByText('Asks to void this record.')).toBeVisible();
  await owner.getByRole('button', { name: 'Approve' }).click();
  await owner
    .getByRole('dialog', { name: 'Approve this request?' })
    .getByRole('button', { name: 'Approve' })
    .click();
  await expect(owner.getByText('Approved; the change is now in effect.')).toBeVisible();
  await owner.getByRole('link', { name: 'Open the record' }).click();
  await expect(owner.getByText('This record is void')).toBeVisible();
  await expect(owner.getByRole('link', { name: 'Deliver', exact: true })).toHaveCount(0);
});

test('Bengali and dark theme: the new pages render without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'bn', url: 'http://localhost:3000' },
    { name: 'theme', value: 'dark', url: 'http://localhost:3000' },
  ]);
  const [email, password] = ACCOUNTS.manager;
  await page.goto('/login?next=%2Fb%2Fexample-cement%2Fsales');
  await page.getByLabel('ইমেইল বা ফোন').fill(email);
  await page.getByLabel('পাসওয়ার্ড', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'লগইন' }).click();
  await expect(page.getByRole('heading', { name: 'অর্ডার', exact: true })).toBeVisible();
  for (const [path, heading] of [
    ['/b/example-cement/sales/new', 'নতুন অর্ডার'],
    ['/b/example-cement/deliveries', 'ডেলিভারি'],
    ['/b/example-cement/collections', 'আদায়'],
    ['/b/example-cement/collections/new', 'আদায় নিন'],
    ['/b/example-cement/customers/cu1/ledger', 'খাতা'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
