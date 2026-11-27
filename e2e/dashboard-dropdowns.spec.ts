import { expect, test, type Locator, type Page } from '@playwright/test';

/** Test-only account of e2e/mock-api.mjs (no real password). */
const OWNER = ['owner@example.com', 'e2e-owner-pass'] as const;

const TEXT = {
  en: {
    cookie: 'en',
    emailLabel: 'Email or phone',
    passwordLabel: 'Password',
    signIn: 'Sign in',
    collection: 'Total Collection',
    todayCollection: "Today's Collection",
    summary: 'Financial Summary',
    month: (title: string) => `Choose month for ${title}`,
    year: (title: string) => `Choose year for ${title}`,
    period: (title: string) => `Period for ${title}`,
    yesterday: 'Yesterday',
  },
  bn: {
    cookie: 'bn',
    emailLabel: 'ইমেইল বা ফোন',
    passwordLabel: 'পাসওয়ার্ড',
    signIn: 'লগইন',
    collection: 'মোট আদায়',
    todayCollection: 'আজকের আদায়',
    summary: 'আর্থিক সারসংক্ষেপ',
    month: (title: string) => `${title}-এর মাস বাছুন`,
    year: (title: string) => `${title}-এর বছর বাছুন`,
    period: (title: string) => `${title}-এর সময়কাল`,
    yesterday: 'গতকাল',
  },
} as const;

/** The `<select>` with this accessible name (the All Time pill group can share the same label). */
const selectNamed = (scope: Locator, name: string) =>
  scope.locator('select').and(scope.getByLabel(name));

async function openDashboard(page: Page, lang: 'en' | 'bn', theme: 'light' | 'dark') {
  const text = TEXT[lang];
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: text.cookie, url: 'http://localhost:3000' },
    { name: 'theme', value: theme, url: 'http://localhost:3000' },
  ]);
  await page.goto('/login?next=%2Fb%2Fexample-cement');
  await page.getByLabel(text.emailLabel).fill(OWNER[0]);
  await page.getByLabel(text.passwordLabel, { exact: true }).fill(OWNER[1]);
  await page.getByRole('button', { name: text.signIn }).click();
  await page.waitForURL((url) => url.pathname === '/b/example-cement');
  await expect(page.getByRole('main').getByRole('link').first()).toBeVisible();
}

/**
 * A real pointer click. Playwright's `click()` first checks that the element is the one that
 * receives the pointer at its centre, so a decorative overlay painted over it (the bug this guards)
 * fails here, which `selectOption` would never notice.
 */
async function realClick(select: Locator) {
  await select.click({ timeout: 3000 });
  // The native popup is not part of the page; close it so the next step starts clean.
  await select.page().keyboard.press('Escape');
}

/** Nothing but the select (or its own label) may sit on top of it, in the middle or on its edges. */
async function expectSelectIsTopmost(select: Locator) {
  const result = await select.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = (y: number) => {
      const top = document.elementFromPoint(box.left + box.width / 2, y);
      return top === el;
    };
    return { centre: hit(box.top + box.height / 2), nearTop: hit(box.top + 3) };
  });
  expect(result).toEqual({ centre: true, nearTop: true });
}

for (const lang of ['en', 'bn'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`dashboard dropdowns take a real click (${lang}, ${theme})`, async ({ page }) => {
      const text = TEXT[lang];
      await openDashboard(page, lang, theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const main = page.getByRole('main');

      // KPI card, month and year.
      const month = selectNamed(main, text.month(text.collection));
      const year = selectNamed(main, text.year(text.collection));
      await expectSelectIsTopmost(month);
      await realClick(month);
      await realClick(year);
      const card = main.getByRole('link', {
        name: lang === 'en' ? 'Total Collection: open page' : /মোট আদায়/,
      });
      const before = await card.first().getAttribute('href');
      await month.selectOption('1');
      await expect(page).toHaveURL(/\/b\/example-cement$/);
      await expect(card.first()).not.toHaveAttribute('href', before ?? '');

      // KPI day card, Today / Yesterday.
      const day = selectNamed(main, text.period(text.todayCollection));
      await expectSelectIsTopmost(day);
      await realClick(day);
      const dayCard = main.getByRole('link', {
        name: lang === 'en' ? "Today's Collection: open page" : /আজকের আদায়/,
      });
      const dayBefore = await dayCard.first().getAttribute('href');
      await day.selectOption({ label: text.yesterday });
      await expect(dayCard.first()).not.toHaveAttribute('href', dayBefore ?? '');

      // Financial Summary panel, month and year.
      const summaryMonth = selectNamed(main, text.month(text.summary));
      const summaryYear = selectNamed(main, text.year(text.summary));
      await expectSelectIsTopmost(summaryMonth);
      await realClick(summaryMonth);
      await realClick(summaryYear);
    });
  }
}
