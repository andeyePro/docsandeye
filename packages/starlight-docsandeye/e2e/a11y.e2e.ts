import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { GUIDE, STEP, openReady } from './helpers.ts';

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${colorScheme} colour scheme`, () => {
    test.use({ colorScheme });

    for (const [name, path] of [['guide page', GUIDE], ['step page', STEP]] as const) {
      test(`${name} has no violations`, async ({ page }) => {
        await openReady(page, path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
        const results = await new AxeBuilder({ page }).analyze();
        const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
        expect(summary).toEqual([]);
      });
    }
  });
}
