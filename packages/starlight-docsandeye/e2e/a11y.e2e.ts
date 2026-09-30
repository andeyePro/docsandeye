import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { EXTERNAL, GUIDE, STEP, STEP3, openReady } from './helpers.ts';

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${colorScheme} colour scheme`, () => {
    test.use({ colorScheme });

    // STEP3's YouTube clip has a poster inside its play button (and a STALE "older video" one).
    const pages = [['guide page', GUIDE], ['step page', STEP], ...(EXTERNAL ? [] : [['YouTube poster step', STEP3]])] as const;
    for (const [name, path] of pages) {
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
