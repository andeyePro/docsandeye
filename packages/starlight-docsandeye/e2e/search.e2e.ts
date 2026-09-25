import { expect, test } from '@playwright/test';
import { GUIDE } from './helpers.ts';

test('Pagefind finds a glossary term used in a step', async ({ page }) => {
  await page.goto(GUIDE);
  const open = page.locator('site-search button[data-open-modal]');
  await expect(open).toBeEnabled();
  await open.click();
  const dialog = page.locator('site-search dialog');
  await expect(dialog).toBeVisible();

  // "tray" is a glossary term used only in step 1's body.
  const input = dialog.locator('#starlight__search input');
  await input.fill('tray');
  await expect(dialog.locator('.pagefind-ui__result-title', { hasText: 'Unpack the kit' }).first()).toBeVisible();
});
