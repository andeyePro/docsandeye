import { expect, test, type Page } from '@playwright/test';
import { STEP1, openReady } from './helpers.ts';

const bar = (page: Page) => page.locator('.docsi-consent-bar');
const yes = (page: Page) => page.locator('[data-check="count"]').getByLabel('Yes');

test('the consent bar waits for the first change; "Save" keeps the answer across a reload', async ({ page }) => {
  await openReady(page, STEP1);
  await expect(bar(page)).toBeHidden();

  await yes(page).check();
  await expect(bar(page)).toBeVisible();

  await bar(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(bar(page)).toBeHidden();

  await page.reload();
  await expect(page.locator('[data-enhanced]').first()).toBeAttached();
  await expect(yes(page)).toBeChecked();
  await expect(bar(page)).toBeHidden();
});

test('"Don\'t save" shows the not-saved notice and writes nothing', async ({ page }) => {
  await openReady(page, STEP1);
  await yes(page).check();
  await expect(bar(page)).toBeVisible();

  await bar(page).getByRole('button', { name: "Don't save" }).click();
  await expect(bar(page)).toBeHidden();
  await expect(page.locator('.docsi-consent-notice').first()).toBeVisible();
  await expect(page.locator('.docsi-consent-notice').first()).toContainText('Not saved');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);

  await page.reload();
  await expect(page.locator('[data-enhanced]').first()).toBeAttached();
  await expect(yes(page)).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
