import { expect, test, type Page } from '@playwright/test';
import { EXTERNAL, GUIDE, SITE_TITLE, STEP, STEP1, STEP2, STEP3, STEP4, fixtureOnly } from './helpers.ts';

const prev = 'a[rel="prev"]';
const next = 'a[rel="next"]';

/** A link's href as a site path (`/a/b/`), whatever form the page wrote it in. */
async function hrefPath(page: Page, selector: string): Promise<string> {
  const href = (await page.locator(selector).getAttribute('href'))!;
  return new URL(href, page.url()).pathname;
}

test('the guide page has no "Previous"; its "Next" is the first step', async ({ page }) => {
  await page.goto(GUIDE);
  await expect(page.locator(prev)).toHaveCount(0);
  const first = await hrefPath(page, next);
  expect(first.startsWith(GUIDE) && first !== GUIDE).toBe(true);
  if (!EXTERNAL) {
    expect(first).toBe(STEP1);
    await expect(page.locator(next)).toContainText('Unpack the kit');
  }
  await page.locator(next).click();
  await expect(page).toHaveURL(first);
});

test("a step's Previous and Next pages link back to it", async ({ page }) => {
  await page.goto(STEP);
  const before = await hrefPath(page, prev);
  const after = (await page.locator(next).count()) > 0 ? await hrefPath(page, next) : undefined;

  await page.goto(before);
  expect(await hrefPath(page, next)).toBe(STEP);
  if (after?.startsWith(GUIDE)) {
    await page.goto(after);
    expect(await hrefPath(page, prev)).toBe(STEP);
  }
});

test('a step links to its neighbours; the first step leads back to the guide', async ({ page }) => {
  fixtureOnly();
  await page.goto(STEP2);
  await expect(page.locator(prev)).toHaveAttribute('href', STEP1);
  await expect(page.locator(prev)).toContainText('Unpack the kit');
  await expect(page.locator(next)).toHaveAttribute('href', STEP3);
  await expect(page.locator(next)).toContainText('Finish the build');
  await page.locator(next).click();
  await expect(page).toHaveURL(STEP3);

  await page.goto(STEP1);
  await expect(page.locator(prev)).toHaveAttribute('href', GUIDE);
  await expect(page.locator(prev)).toContainText('Kit guide');
});

test("the last step's next is the sidebar entry after the guide", async ({ page }) => {
  fixtureOnly();
  await page.goto(STEP4);
  await expect(page.locator(next)).toHaveAttribute('href', '/protocol/');
});

test('an unknown URL gets 404.html, which carries the site title', async ({ page, request }) => {
  // The fixture's title is known; another site's is whatever its guide page names.
  await page.goto(GUIDE);
  const siteTitle = EXTERNAL ? (await page.locator('meta[property="og:site_name"]').getAttribute('content'))! : SITE_TITLE;
  expect(siteTitle).toBeTruthy();

  const direct = await request.get('/404.html');
  expect(direct.status()).toBe(200);
  const html = await direct.text();
  expect(html.includes(siteTitle) || html.includes(siteTitle.replace(/&/g, '&amp;'))).toBe(true);

  const response = await page.goto('/no-such-page/');
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle(new RegExp(siteTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
