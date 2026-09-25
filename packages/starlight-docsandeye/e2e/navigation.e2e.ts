import { expect, test } from '@playwright/test';
import { GUIDE, SITE_TITLE, STEP1, STEP2, STEP3, STEP4 } from './helpers.ts';

const prev = 'a[rel="prev"]';
const next = 'a[rel="next"]';

test('the guide page has no "Previous"; its "Next" is the first step', async ({ page }) => {
  await page.goto(GUIDE);
  await expect(page.locator(prev)).toHaveCount(0);
  await expect(page.locator(next)).toHaveAttribute('href', STEP1);
  await expect(page.locator(next)).toContainText('Unpack the kit');
  await page.locator(next).click();
  await expect(page).toHaveURL(STEP1);
});

test('a step links to its neighbours; the first step leads back to the guide', async ({ page }) => {
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
  await page.goto(STEP4);
  await expect(page.locator(next)).toHaveAttribute('href', '/protocol/');
});

test('an unknown URL gets 404.html, which carries the site title', async ({ page, request }) => {
  const direct = await request.get('/404.html');
  expect(direct.status()).toBe(200);
  expect(await direct.text()).toContain(SITE_TITLE);

  const response = await page.goto('/no-such-page/');
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle(new RegExp(SITE_TITLE));
});
