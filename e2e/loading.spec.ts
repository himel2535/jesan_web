import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

/**
 * The loading contract (docs/plans/loading-fix.md): a navigation shows at most ONE skeleton, in
 * the shape of the page that follows, the shell never flickers, and paging or filtering a list
 * dims the rows instead of clearing them.
 *
 * The failure guarded against is a sequence, not an overlap: a route `loading.tsx` showed three
 * cards and the page then replaced them with its own shape, so one click changed the shape twice.
 *
 * The mock API is slowed down for this spec, otherwise every phase is over before a single sample
 * can see it. GET /auth/me has to be slow too — that is what a page's server part waits for — and
 * it does not forward test cookies, hence the mock API's own `__test/delay`.
 */
const SLOW_MS = 400;
const DELAY_URL = 'http://localhost:4000/api/v1/__test/delay';

const setDelay = (request: APIRequestContext, ms: number) =>
  request.post(DELAY_URL, { data: { ms } });

async function signedIn(browser: Browser, next: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3000' }]);
  const page = await context.newPage();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email or phone').fill('owner@example.com');
  await page.getByLabel('Password', { exact: true }).fill('e2e-owner-pass');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === next);
  return page;
}

/** What the page looks like right now: busy regions, skeleton blocks, rows and dimming. */
const snapshot = (page: Page) =>
  page.evaluate(() => {
    const busy = [...document.querySelectorAll('[aria-busy="true"]')];
    return {
      // "13" is one list skeleton; "13+10" or two samples "13" then "10" mean two shapes.
      shape: busy.map((el) => el.querySelectorAll('.animate-pulse').length).join('+'),
      pulses: document.querySelectorAll('.animate-pulse').length,
      rows: document.querySelectorAll('tr').length,
      dimmed: document.querySelectorAll('.opacity-60').length,
      outsideMain: document.querySelectorAll('[aria-busy="true"]:not(main *)').length,
      sidebar: document.querySelectorAll('nav a[href$="/b/example-cement"]').length,
    };
  });

/** Samples a navigation from the click until `until` holds, or the budget runs out. */
async function trace(page: Page, click: Promise<unknown>, until: (s: Snapshot) => boolean) {
  const samples: Snapshot[] = [];
  for (let i = 0; i < 60; i += 1) {
    const sample = await snapshot(page);
    samples.push(sample);
    if (until(sample)) break;
    await page.waitForTimeout(25);
  }
  await click;
  return samples;
}
type Snapshot = Awaited<ReturnType<typeof snapshot>>;

const shapesIn = (samples: Snapshot[]) => [...new Set(samples.map((s) => s.shape))].filter(Boolean);

test.describe('loading states', () => {
  // Never leave the shared mock API slow for the other specs.
  test.afterEach(async ({ request }) => void (await setDelay(request, 0)));

  test('one skeleton per navigation, and the shell never goes away', async ({
    browser,
    request,
  }) => {
    const page = await signedIn(browser, '/b/example-cement/sales');
    await setDelay(request, SLOW_MS);

    for (const [link, heading] of [
      [/^Products & categories$/, 'Products'],
      [/^Stock$/, 'Stock'],
      [/^Customers$/, 'Customers'],
      // Anchored at the start only: the link's name also carries the pending-approvals count.
      [/^Approvals/, 'Approvals'],
    ] as const) {
      const samples = await trace(
        page,
        page.getByRole('link', { name: link }).click(),
        (s) => s.rows > 1,
      );
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();

      // At most one shape: zero when hovering the link already warmed the list.
      expect(
        shapesIn(samples),
        `${heading} changed skeleton shape more than once`,
      ).not.toHaveLength(2);
      expect(shapesIn(samples).length).toBeLessThanOrEqual(1);
      // The shell is outside the swapped content: it must be there in every single sample.
      for (const sample of samples) {
        expect(sample.sidebar).toBeGreaterThan(0);
        expect(sample.outsideMain).toBe(0);
      }
    }
  });

  test('a page with nothing warmed shows exactly one skeleton, the list shape', async ({
    browser,
    request,
  }) => {
    // Opened straight from the URL: no hover, so nothing is in the cache yet.
    await setDelay(request, SLOW_MS);
    const page = await signedIn(browser, '/b/example-cement/products');
    const samples = await trace(page, Promise.resolve(), (s) => s.rows > 1);

    // One shape, and it is the list skeleton: a toolbar and ten rows (3 + 10 blocks).
    expect(shapesIn(samples)).toEqual(['13']);
  });

  /**
   * The other half of "fast": hovering a sidebar link warms that page's first list query, so the
   * click itself needs no request at all and the page opens with its rows already there.
   */
  test('hovering a sidebar link warms its list, so the click asks for nothing', async ({
    browser,
  }) => {
    const page = await signedIn(browser, '/b/example-cement/sales');
    await page.waitForTimeout(300); // let the page settle, so only our requests are counted

    const asked: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.pathname.startsWith('/api/v1/')) asked.push(url.pathname + url.search);
    });

    const link = page.getByRole('link', { name: 'Customers', exact: true });
    await link.hover();
    await expect.poll(() => asked).toContain('/api/v1/b/example-cement/customers?page=1');

    asked.length = 0;
    await link.click();
    await expect(page.getByRole('row').nth(1)).toBeVisible();
    expect(asked, 'the click should be served from the cache').toEqual([]);
  });

  test('paging dims the rows instead of clearing them', async ({ browser, request }) => {
    const page = await signedIn(browser, '/b/example-cement/products');
    await expect(page.getByRole('row').nth(1)).toBeVisible();
    const before = (await snapshot(page)).rows;
    expect(before).toBeGreaterThan(2);

    await setDelay(request, SLOW_MS);
    const samples = await trace(
      page,
      page.getByRole('link', { name: 'Page 2' }).click(),
      (s) => s.rows > 1 && s.rows < before,
    );

    // No skeleton at any point, the rows never vanish, and the stale ones are dimmed meanwhile.
    expect(samples.every((s) => s.pulses === 0)).toBe(true);
    expect(samples.every((s) => s.rows >= 2)).toBe(true);
    expect(samples.some((s) => s.dimmed > 0)).toBe(true);
    await expect(page.getByText('Showing 11–12 of 12')).toBeVisible();
  });
});
