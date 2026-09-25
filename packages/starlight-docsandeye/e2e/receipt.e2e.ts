import { expect, test } from '@playwright/test';
import { STEP1, openReady, setUnits } from './helpers.ts';

test('expected quantities multiply by units; the missing-parts email lists a missing part', async ({ page }) => {
  await openReady(page, STEP1);
  const live = page.locator('docsi-receipt .docsi-receipt-live');
  await expect(live).toBeVisible();
  const expected = (component: string) => live.locator(`tr[data-component="${component}"] .docsi-receipt-expected`);

  // Widget: 2 per unit; spares bag: 1 per kit.
  await expect(expected('widget')).toHaveText('2');
  await setUnits(page, 3);
  await expect(live.locator('.docsi-receipt-intro')).toContainText('For 3 units');
  await expect(expected('widget')).toHaveText('6');
  await expect(expected('spares-bag')).toHaveText('1');

  await expect(live.locator('.docsi-missing')).toBeHidden();
  await live.getByLabel('Received: Widget').fill('4');
  const missing = live.locator('.docsi-missing');
  await expect(missing).toBeVisible();
  await expect(missing).toContainText('Widget × 2');

  // The chosen supplier's (Shop A's) contact, as the page carries it.
  const contacts = JSON.parse((await page.locator('docsi-receipt').getAttribute('data-contacts'))!) as Record<string, { email: string }>;
  const href = (await missing.locator('a.docsi-missing-mailto').getAttribute('href'))!;
  expect(href.startsWith(`mailto:${contacts['shop-a']!.email}?`)).toBe(true);
  const decoded = decodeURIComponent(href);
  expect(decoded).toContain('- Widget × 2');
  expect(decoded).toContain('Units ordered: 3');
});
