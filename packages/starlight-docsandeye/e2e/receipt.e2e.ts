import { expect, test } from '@playwright/test';
import { STEP, STEP1, fixtureOnly, openReady, setUnits } from './helpers.ts';

test('expected quantities scale with the number of units', async ({ page }) => {
  await openReady(page, STEP);
  const receipt = page.locator('docsi-receipt');
  test.skip((await receipt.count()) === 0, 'this step has no receipt');
  const live = receipt.locator('.docsi-receipt-live');
  await expect(live).toBeVisible();
  // The profile question the receipt multiplies by (the fixture's is `units`).
  const field = (JSON.parse((await receipt.getAttribute('data-config'))!) as { multiply_by?: string }).multiply_by;
  test.skip(field === undefined, 'this receipt does not multiply by a number of units');

  const expectedByComponent = async (): Promise<Map<string, number>> => {
    const out = new Map<string, number>();
    for (const row of await live.locator('tr[data-component]').all()) {
      out.set((await row.getAttribute('data-component'))!, Number(await row.locator('.docsi-receipt-expected').textContent()));
    }
    return out;
  };
  await setUnits(page, 1, field);
  await expect(live.locator('.docsi-receipt-intro')).toContainText('For 1 unit');
  const one = await expectedByComponent();
  await setUnits(page, 3, field);
  await expect(live.locator('.docsi-receipt-intro')).toContainText('For 3 units');
  const three = await expectedByComponent();

  // Per-unit rows triple, per-kit rows stay; at least one row is per unit.
  let scaled = 0;
  for (const [component, qty] of one) {
    const now = three.get(component);
    if (now === undefined) continue;
    expect([qty, qty * 3], component).toContain(now);
    if (now === qty * 3 && qty > 0) scaled += 1;
  }
  expect(scaled).toBeGreaterThan(0);
});

test('fixture quantities; the missing-parts email lists a missing part', async ({ page }) => {
  fixtureOnly();
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
