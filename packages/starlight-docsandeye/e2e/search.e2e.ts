import { expect, test } from '@playwright/test';
import { EXTERNAL, GUIDE, SEARCH } from './helpers.ts';

test('Pagefind finds a term used in a step', async ({ page }) => {
  await page.goto(GUIDE);
  const open = page.locator('site-search button[data-open-modal]');
  await expect(open).toBeEnabled();
  await open.click();
  const dialog = page.locator('site-search dialog');
  await expect(dialog).toBeVisible();

  const input = dialog.locator('#starlight__search input');
  await input.fill(SEARCH);
  const results = dialog.locator('.pagefind-ui__result-title');
  // The fixture's "tray" is a glossary term used only in step 1's body.
  if (EXTERNAL) await expect(results.first()).toBeVisible();
  else await expect(results.filter({ hasText: 'Unpack the kit' }).first()).toBeVisible();
});
